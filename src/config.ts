import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadConfig } from 'c12'
import defu from 'defu'
import type { EnvsyncConfig } from './types'
import { consola } from './utils'

const defaultConfig: EnvsyncConfig = {
  mergeEnvFiles: true,
  recursive: true,
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
    consola.error('No configuration found. Please run init first.')
    return { config: {}, valid: false }
  }
  return { config, valid: true }
}
export function createEnvsyncConfig(config: EnvsyncConfig, pwd?: string) {
  const configPath = path.join(pwd ?? process.cwd(), 'envsync.json')
  writeFileSync(
    configPath,
    JSON.stringify(defu(config, defaultConfig), null, 2),
    'utf8',
  )
  return config
}

export function updateEnvsyncConfig(
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

  writeFileSync(configPath, JSON.stringify(merged, null, 2))
  return merged
}
