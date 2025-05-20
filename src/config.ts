import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadConfig } from 'c12'
import defu from 'defu'
import type { CreateEnvsyncConfigOptions, EnvsyncConfig } from './types'
import { consola } from './utils'

export const defaultConfig: Required<EnvsyncConfig> = {
  mergeEnvFiles: true,
  recursive: true,
  includeSuffixes: false,
  backend: {
    name: 'unconfigured',
    type: 'local',
  },
  exclude: ['.git', 'node_modules', 'dist'],
  files: [],
}

export const { config, configFile, layers } = await loadConfig<EnvsyncConfig>({
  dotenv: false,
  giget: false,
  configFile: 'envsync',
  rcFile: false,
})

export const envsyncConfig = layers?.length ? config : undefined

export function verifyConfig(config: typeof envsyncConfig = envsyncConfig): {
  config: NonNullable<typeof envsyncConfig>
  valid: boolean
} {
  if (!config) {
    return { config: {}, valid: false }
  }
  return { config, valid: true }
}

export async function createEnvsyncConfig(
  config: EnvsyncConfig,
  options?: CreateEnvsyncConfigOptions,
) {
  if (options?.remote) {
    try {
      await options.storage?.setItem('envsync.json', config)
      consola.success('Updated remote: envsync.json')
    } catch (error) {
      consola.error('Failed to write envsync.json')
      process.exit(1)
    }
  } else {
    const configPath = path.join(options?.pwd ?? process.cwd(), 'envsync.json')
    writeFile(configPath, JSON.stringify(defu(config, defaultConfig), null, 2), 'utf8')
  }
}

export async function updateEnvsyncConfig(
  patch: Partial<EnvsyncConfig>,
  options: {
    configFile?: string
    cwd?: string
  } = {},
) {
  const cwd = options.cwd || process.cwd()
  const configPath = options.configFile || `${cwd}envsync.config.json`

  let existing: Partial<EnvsyncConfig> = {}
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8')
      existing = JSON.parse(content)
    } catch (e) {
      // If error reading/parsing, treat as empty config
      existing = {}
    }
  }

  const merged = defu(patch, existing)

  await writeFile(configPath, JSON.stringify(merged, null, 2))
  return merged
}
