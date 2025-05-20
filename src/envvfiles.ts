import type { Dirent } from 'node:fs'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import defu from 'defu'
import { hash } from 'ohash'
import { basename, dirname, extname, join, matchesGlob, relative } from 'pathe'
import { parse, serialize } from 'rc9'
import { withLeadingSlash } from 'ufo'
import type { Storage, StorageValue } from 'unstorage'
import { createEnvsyncConfig, defaultConfig, envsyncConfig, verifyConfig } from './config'
import type {
  Arguments,
  AzureAppConfigBackend,
  AzureKeyVaultBackend,
  AzureStorageBackend,
  EnvFile,
  EnvsyncConfig,
} from './types'
import { consola, initializeStorage, verifyArgs } from './utils'

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist'])

async function parseGitignore(gitignorePath: string): Promise<string[]> {
  try {
    const content = await readFile(gitignorePath, 'utf8')
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line !== '.env')
  } catch {
    return []
  }
}

function isIgnoredByPatterns(relPath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // If the pattern has no glob chars, match any segment in the path
    if (
      !pattern.includes('*') &&
      !pattern.includes('/') &&
      pattern === pattern.replace(/[^a-zA-Z0-9_.-]/g, '')
    ) {
      const segments = relPath.split(/[\\/]/)
      if (segments.includes(pattern)) return true
    }
    if (matchesGlob(relPath, pattern)) {
      return true
    }
  }
  return false
}

export async function findEnvFiles(
  dir: string,
  ignorePatterns: string[],
  recursive = true,
  includeSuffixes = false,
): Promise<string[]> {
  const gitignorePath = join(dir, '.gitignore')
  const gitignorePatterns = existsSync(gitignorePath)
    ? await parseGitignore(gitignorePath)
    : ignorePatterns

  const envFiles: string[] = []

  async function walk(currentDir: string) {
    let entries: Dirent<string>[]
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch {
      consola.warn(`Permission denied or error reading: ${currentDir}`)
      return
    }
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      const relPath = relative(dir, fullPath)
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) continue
        if (gitignorePatterns.length && isIgnoredByPatterns(relPath, gitignorePatterns)) continue
        if (recursive) await walk(fullPath)
      } else if (entry.isFile() && basename(entry.name).startsWith('.env')) {
        if (gitignorePatterns.length && isIgnoredByPatterns(relPath, gitignorePatterns)) continue

        const filename = basename(entry.name)
        if (!includeSuffixes && filename !== '.env' && filename.includes('.', 4)) continue

        envFiles.push(fullPath)
      }
    }
  }

  await walk(dir)
  return envFiles
}

export async function sync(argv: Arguments) {
  let storage: Storage<StorageValue>
  let config: EnvsyncConfig

  consola.start('Connecting to remote storage')

  try {
    const result = await verifyArgs(argv)
    storage = result.storage
    config = result.config
  } catch (error: unknown) {
    // @ts-expect-error
    if (error.cause !== 'internal') {
      // @ts-expect-error
      consola.debug('Name:', error.name, 'Details:', error.details)
      consola.error('Failed to connect to remote storage')
    }
    process.exit(1)
  }

  consola.start(`Running sync with backend ${config.backend?.name} (${config.backend?.type})...\n`)

  const files = config.files || []

  for (const file of files) {
    const remoteKey = hash(withLeadingSlash(file.path))
    const localPath = withLeadingSlash(file.path)
    const localFileExists = existsSync(file.path)

    let hasRemote: boolean
    try {
      hasRemote = await storage.hasItem(remoteKey)
      if (!hasRemote) {
        consola.warn(`Remote file not found for: ${localPath}`)
        continue
      }
    } catch (error) {
      consola.error(`Failed to connect to remote storage for: ${localPath}`)
      process.exit(1)
    }

    let localContent = ''
    try {
      localContent = await readFile(file.path, {
        encoding: 'utf-8',
      })
    } catch {
      consola.debug(`Local file missing: ${localPath}`)
    }

    let remoteContent: StorageValue
    try {
      remoteContent = await storage.getItem(remoteKey)
      if (remoteContent == null) {
        consola.warn(`Remote file could not be read: ${remoteKey}`)
        continue
      }
    } catch (error) {
      consola.error(`Failed to connect to remote storage for: ${localPath}`)
      process.exit(1)
    }

    const localHash = hash(localContent)
    const remoteHash = hash(remoteContent)

    if (localHash !== remoteHash || (!remoteContent && !localFileExists)) {
      const remoteContentObject = parse(remoteContent as string)
      let updatedContentObject = remoteContentObject
      if (argv?.merge || envsyncConfig?.mergeEnvFiles) {
        const localContentOject = parse(localContent)
        updatedContentObject = defu(remoteContentObject, localContentOject)
      }
      consola.info(`Updating local file from remote: ${localPath}`)
      try {
        await mkdir(dirname(file.path), { recursive: true })
        await writeFile(file.path, serialize(updatedContentObject), {
          encoding: 'utf8',
        })
        consola.success(`Updated: ${localPath}`)
      } catch {
        consola.error(`Failed to write file: ${localPath}`)
      }
    } else {
      consola.success(`Up-to-date: ${localPath}`)
    }
  }
}

export async function update(argv?: Arguments) {
  const { overwrite } = argv ?? {}
  const { config } = verifyConfig()

  consola.info(`Running update with backend ${config.backend?.name} (${config.backend?.type})...`)

  let storage: Storage<StorageValue>
  try {
    storage = await initializeStorage(config)
  } catch (error: unknown) {
    // @ts-expect-error
    if (error.cause !== 'internal') {
      // @ts-expect-error
      consola.debug('Name:', error.name, 'Details:', error.details)
      consola.error('Failed to connect to remote storage')
    }
    process.exit(1)
  }

  const files = config.files || []

  for (const file of files) {
    const localPath = withLeadingSlash(file.path)
    const remoteKey = hash(withLeadingSlash(file.path))

    let hasRemote: boolean
    try {
      hasRemote = await storage.hasItem(remoteKey)
    } catch (error) {
      consola.error(`Failed to connect to remote storage for: ${localPath}`)
      process.exit(1)
    }
    let shouldUpdate = true

    if (hasRemote && !overwrite) {
      shouldUpdate = await consola.prompt(`Remote already has ${localPath}. Overwrite?`, {
        type: 'confirm',
        initial: false,
      })
    }

    if (!shouldUpdate) {
      consola.info(`Skipped: ${localPath}`)
      continue
    }

    let localContent: string
    try {
      localContent = serialize(parse(await readFile(file.path, 'utf8')))
      if (localContent.length === 0) {
        consola.info(`Local file is empty: ${localPath}. Remote will be cleared.`)
      }
    } catch {
      consola.debug(`Local file missing: ${localPath}`)
      continue
    }

    try {
      await storage.setItem(remoteKey, localContent)
      consola.success(`Updated remote: ${localPath}`)
    } catch (error) {
      consola.error(`Failed to write .env file: ${localPath}`)
    }
  }
}

export async function clear(_argv: Arguments) {
  const { config } = verifyConfig()

  consola.info(
    `Running update with backend ${envsyncConfig?.backend?.name} (${envsyncConfig?.backend?.type})...`,
  )

  let storage: Storage<StorageValue>
  try {
    storage = await initializeStorage(config)
  } catch (error: unknown) {
    // @ts-expect-error
    if (error.cause !== 'internal') {
      // @ts-expect-error
      consola.debug('Name:', error.name, 'Details:', error.details)
      consola.error('Failed to connect to remote storage')
    }
    process.exit(1)
  }

  const confirm = await consola.prompt(
    'This will delete all .env files from the remote storage. Are you sure?',
    {
      type: 'confirm',
      initial: false,
    },
  )

  if (!confirm) {
    consola.info('Clear operation cancelled.')
    return
  }

  const files = config.files || []
  for (const file of files) {
    const localPath = withLeadingSlash(file.path)
    const remoteKey = hash(localPath)
    const hasRemote = await storage.hasItem(remoteKey)
    if (hasRemote) {
      await storage.removeItem(remoteKey)
      consola.success(`Deleted remote: ${localPath}`)
    }
  }
  consola.success('All remote .env files deleted.')
}

export async function rescan(argv: Arguments) {
  const { config } = verifyConfig()

  consola.start('Searching for .env files...')
  const rootDir = process.cwd()
  consola.debug(`Searching for .env files in ${rootDir}`)
  const foundFiles = await findEnvFiles(
    rootDir,
    config.exclude || defaultConfig.exclude,
    !!config.recursive,
    argv['include-suffixes'],
  )

  if (foundFiles.length === 0) {
    consola.info('No .env files found in the project.')
    return
  }

  consola.debug('Found the following .env files:')
  for (const file of foundFiles) {
    consola.debug(`- ${file}`)
  }

  const selectedFiles = await consola.prompt('Select .env files to add to config:', {
    type: 'multiselect',
    options: foundFiles.map((file) => ({ label: file, value: file })),
    initial: foundFiles,
    cancel: 'symbol',
  })

  if (selectedFiles === Symbol.for('cancel')) {
    consola.info('Initialization cancelled.')
    return
  }

  if (
    (
      selectedFiles as {
        label: string
        value: string
      }[]
    ).length === 0
  ) {
    consola.info('No files selected. Rescan cancelled.')
    return
  }

  const envFiles: EnvFile[] = (
    selectedFiles as {
      label: string
      value: string
    }[]
  ).map((file: string | { value: string }) => {
    const filePath = typeof file === 'string' ? file : file.value
    const name = basename(filePath)
    const extension = extname(filePath)
    const relPath = relative(rootDir, filePath)
    return {
      name,
      path: relPath,
      extension,
    }
  })

  const newConfig: EnvsyncConfig = {
    ...config,
    files: envFiles,
  }

  await createEnvsyncConfig(newConfig)

  consola.info('Selected files:')
  const fileList = envFiles
    .map((file) => {
      return `- ${withLeadingSlash(file.path)}`
    })
    .join('\n')
  consola.box(fileList)

  consola.success('Rescan complete!')
}

export async function status(argv: Arguments) {
  let storage: Storage<StorageValue>
  let config: EnvsyncConfig
  consola.start('Connecting to remote storage')
  try {
    const result = await verifyArgs(argv)
    storage = result.storage
    config = result.config
  } catch (error: unknown) {
    // @ts-expect-error
    if (error.cause !== 'internal') {
      // @ts-expect-error
      consola.debug('Name:', error.name, 'Details:', error.details)
      consola.error('Failed to connect to remote storage')
    }
    process.exit(1)
  }
  consola.start(
    `Running status with backend ${config.backend?.name} (${config.backend?.type})...\n`,
  )

  consola.info('Configured files:')
  const fileList = (config.files as EnvFile[])
    .map((file) => {
      return `- ${withLeadingSlash(file.path)}`
    })
    .join('\n')
  consola.box(fileList)

  const files = config.files || []
  let updateNeeded = false

  for (const file of files) {
    const remoteKey = hash(withLeadingSlash(file.path))
    const localPath = withLeadingSlash(file.path)

    try {
      const hasRemote = await storage.hasItem(remoteKey)
      if (!hasRemote) {
        consola.warn(`Remote file not found for: ${localPath}`)
        continue
      }
    } catch (error) {
      consola.error(`Failed to connect to remote storage for: ${localPath}`)
      process.exit(1)
    }

    let localContent = ''
    try {
      localContent = await readFile(file.path, 'utf8')
    } catch {
      consola.debug(`Local file missing: ${localPath}`)
      continue
    }

    let remoteContent: StorageValue
    try {
      remoteContent = await storage.getItem(remoteKey)
      if (remoteContent == null) {
        consola.warn(`Remote file could not be read: ${remoteKey}`)
        continue
      }
    } catch (error) {
      consola.error(`Failed to connect to remote storage for: ${localPath}`)
      process.exit(1)
    }

    const localHash = hash(localContent)
    const remoteHash = hash(remoteContent)

    if (localHash === remoteHash) {
      consola.success(`Up-to-date: ${localPath}`)
    } else {
      updateNeeded = true
      consola.info(`Out-of-date: ${localPath}`)
    }
  }
  if (updateNeeded) {
    const runSync = await consola.prompt(
      'Some files seem to be outdated. Do you want to run a sync now?',
      {
        type: 'confirm',
        initial: false,
      },
    )
    if (runSync) {
      await sync(argv)
    }
  }
}

export async function init(argv: Arguments) {
  let storage: Storage<StorageValue>
  let config: EnvsyncConfig = {}
  consola.start('Connecting to remote storage')
  try {
    const result = await verifyArgs(argv, true)
    storage = result.storage
    config = result.config
  } catch (error: unknown) {
    // @ts-expect-error
    if (error.cause !== 'internal') {
      // @ts-expect-error
      consola.debug('Name:', error.name, 'Details:', error.details)
      consola.error('Failed to connect to remote storage')
    }
    // @ts-expect-error
    if (error.message === 'No configuration found at remote') {
      consola.warn('No configuration found at remote')
    } else {
      process.exit(1)
    }
  }
  if (Object.keys(config).length > 0) {
    const confirmOverwrite = await consola.prompt(
      'A configuration file already exists. Do you want to overwrite it?',
      {
        type: 'confirm',
        initial: false,
      },
    )
    if (!confirmOverwrite) {
      consola.info('Initialization cancelled.')
      return
    }
  }

  consola.info('Searching for .env files...')
  const rootDir = process.cwd()
  consola.debug(`Searching for .env files in ${rootDir}`)
  const foundFiles = await findEnvFiles(
    rootDir,
    defaultConfig.exclude,
    true,
    argv['include-suffixes'],
  )

  if (foundFiles.length === 0) {
    consola.info('No .env files found in the project.')
    return
  }

  consola.debug('Found the following .env files:')
  for (const file of foundFiles) {
    consola.debug(`- ${file}`)
  }

  const selectedFiles = await consola.prompt('Select .env files to add to config:', {
    type: 'multiselect',
    options: foundFiles.map((file) => ({ label: file, value: file })),
    initial: foundFiles,
    cancel: 'symbol',
  })

  if (selectedFiles === Symbol.for('cancel')) {
    consola.info('Initialization cancelled.')
    return
  }

  if (
    (
      selectedFiles as {
        label: string
        value: string
      }[]
    ).length === 0
  ) {
    consola.info('No files selected. Initialization cancelled.')
    return
  }

  consola.success('File search complete.')

  const backendType =
    (argv['backend-type'] as string) ||
    (await consola.prompt('Select backend type:', {
      type: 'select',
      options: [
        { label: 'Azure Storage', value: 'azure-storage' },
        { label: 'Azure Key Vault', value: 'azure-key-vault' },
        { label: 'Azure App Configuration', value: 'azure-app-config' },
      ],
      initial: 'local',
    }))

  let backend: AzureStorageBackend | AzureKeyVaultBackend | AzureAppConfigBackend | undefined

  switch (backendType) {
    case 'azure-storage': {
      const accountName =
        (argv['azure-storage-accountName'] as string) ||
        (await consola.prompt('Azure Storage Account Name:', {
          type: 'text',
        }))
      const containerName =
        (argv['azure-storage-containerName'] as string) ||
        (await consola.prompt('Azure Storage Container Name:', {
          type: 'text',
        }))
      backend = {
        type: 'azure-storage',
        name: 'azure-storage',
        config: { accountName, containerName },
      }
      break
    }
    case 'azure-key-vault': {
      const vaultName =
        (argv['azure-key-vault-vaultName'] as string) ||
        (await consola.prompt('Azure Key Vault Name:', {
          type: 'text',
        }))
      const endpoint =
        (argv['azure-key-vault-endpoint'] as string) ||
        (await consola.prompt('Azure Key Vault Endpoint:', {
          type: 'text',
        }))
      backend = {
        type: 'azure-key-vault',
        name: 'azure-key-vault',
        config: { vaultName, endpoint },
      }
      break
    }
    case 'azure-app-config': {
      const appConfigName =
        (argv['azure-app-config-appConfigName'] as string) ||
        (await consola.prompt('Azure App Configuration Name:', {
          type: 'text',
        }))
      const endpoint =
        (argv['azure-app-config-endpoint'] as string) ||
        (await consola.prompt('Azure App Configuration Endpoint:', {
          type: 'text',
        }))
      const prefix =
        (argv['azure-app-config-prefix'] as string) ||
        (await consola.prompt('Azure App Configuration Key Prefix (optional):', {
          type: 'text',
          initial: '',
        }))
      const label =
        (argv['azure-app-config-label'] as string) ||
        (await consola.prompt('Azure App Configuration Label (optional):', {
          type: 'text',
          initial: '',
        }))

      const config: {
        appConfigName: string
        endpoint: string
        prefix?: string
        label?: string
      } = { appConfigName, endpoint }
      if (prefix) config.prefix = prefix
      if (label) config.label = label

      backend = {
        type: 'azure-app-config',
        name: 'azure-app-config',
        config,
      }
      break
    }
    default: {
      backend = undefined
    }
  }
  const envFiles: EnvFile[] = (
    selectedFiles as {
      label: string
      value: string
    }[]
  ).map((file: string | { value: string }) => {
    const filePath = typeof file === 'string' ? file : file.value
    const name = basename(filePath)
    const extension = extname(filePath)
    // Store only the relative path to the working directory
    const relPath = relative(rootDir, filePath)
    return {
      name,
      path: relPath,
      extension,
    }
  })

  const mergeEnvFiles = await consola.prompt('Merge environment files?', {
    type: 'confirm',
    initial: true,
  })

  const recursive = await consola.prompt('Enable recursive search for .env files?', {
    type: 'confirm',
    initial: true,
  })

  let exclude: string[] = []
  const gitignorePath = join(rootDir, '.gitignore')
  if (existsSync(gitignorePath)) {
    consola.debug(`Found .gitignore file at ${gitignorePath}`)
    // exclude = await parseGitignore(gitignorePath)
  } else {
    const excludePatterns = await consola.prompt(
      'Enter patterns to exclude (comma separated, e.g., node_modules,.git):',
      {
        type: 'text',
        initial: 'node_modules,.git,dist',
      },
    )
    exclude = excludePatterns.split(',').map((pattern: string) => pattern.trim())
  }

  const newConfig: EnvsyncConfig = {
    mergeEnvFiles,
    recursive,
    exclude,
    backend,
    files: envFiles,
  }
  // @ts-expect-error typescript doesn't understand init property
  if (argv['remote-config'] && storage) {
    await createEnvsyncConfig(newConfig, {
      remote: true,
      storage: storage as Storage,
    })
  } else {
    createEnvsyncConfig(newConfig)
  }

  consola.info('Configured .env files:')
  const fileList = envFiles
    .map((file) => {
      return `- ${withLeadingSlash(file.path)}`
    })
    .join('\n')
  consola.box(fileList)

  consola.success('Initialization complete!')
}
