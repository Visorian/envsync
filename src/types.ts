export interface Arguments {
  directory?: string
  'backend-type'?: string
  'config-file'?: string
  overwrite?: boolean
  merge?: boolean
  'azure-storage-accountName'?: string
  'azure-storage-containerName'?: string
  'azure-key-vault-vaultName'?: string
  'azure-key-vault-endpoint'?: string
  'azure-app-config-appConfigName'?: string
  'azure-app-config-endpoint'?: string
  'azure-app-config-prefix'?: string
  'azure-app-config-label'?: string
}

export interface AzureStorageOptions {
  accountName: string
  containerName: string
}

export interface AzureKeyVaultOptions {
  vaultName: string
}

export interface AzureAppConfigOptions {
  appConfigName: string
  endpoint: string
  prefix?: string
  label?: string
}

export type LocalOptions = {}

export interface BaseBackendConfig {
  name: string
}

export interface AzureStorageBackend extends BaseBackendConfig {
  type: 'azure-storage'
  config: AzureStorageOptions
}

export interface AzureKeyVaultBackend extends BaseBackendConfig {
  type: 'azure-key-vault'
  config: AzureKeyVaultOptions
}

export interface AzureAppConfigBackend extends BaseBackendConfig {
  type: 'azure-app-config'
  config: AzureAppConfigOptions
}

export interface LocalBackend extends BaseBackendConfig {
  type: 'local'
  config?: LocalOptions
}

export interface EnvsyncConfig {
  mergeEnvFiles?: boolean
  recursive?: boolean
  exclude?: string[]
  backend?:
    | AzureStorageBackend
    | AzureKeyVaultBackend
    | AzureAppConfigBackend
    | LocalBackend
  files?: EnvFile[]
}

export interface EnvFile {
  name: string
  path: string
  extension: string
}
