import { createConsola } from 'consola'
import destr from 'destr'
import { type Storage, type StorageValue, createStorage } from 'unstorage'
import { verifyConfig } from './config'
import type { Arguments, EnvsyncConfig } from './types'

export async function initializeStorage(config: EnvsyncConfig) {
  const { backend } = config
  switch (backend?.type) {
    case 'azure-storage': {
      const azureStorageBlobDriver = (await import('unstorage/drivers/azure-storage-blob')).default
      return createStorage({
        driver: azureStorageBlobDriver({
          accountName: backend.config.accountName,
          containerName: backend.config.containerName,
        }),
      })
    }
    case 'azure-key-vault': {
      const azureKeyVault = (await import('unstorage/drivers/azure-key-vault')).default
      return createStorage({
        driver: azureKeyVault({
          vaultName: backend.config.vaultName,
        }),
      })
    }
    case 'azure-app-config': {
      const azureAppConfiguration = (await import('unstorage/drivers/azure-app-configuration'))
        .default
      return createStorage({
        driver: azureAppConfiguration({
          appConfigName: backend.config.appConfigName,
          endpoint: backend.config.endpoint,
          prefix: backend.config.prefix,
          label: backend.config.label,
        }),
      })
    }
    case 'local': {
      return createStorage({})
    }
    default:
      throw new Error('Unsupported backend type')
  }
}

export async function verifyArgs(argv: Arguments): Promise<{
  storage: Storage<StorageValue>
  config: EnvsyncConfig
}> {
  let config: EnvsyncConfig
  let storage: Storage<StorageValue>

  const { 'remote-config': useRemoteConfig, 'backend-type': backendType } = argv
  if (useRemoteConfig) {
    if (!backendType) {
      consola.error('Missing required argument for backend type')
      throw new Error('Missing required argument for backend type')
    }
    switch (backendType) {
      case 'azure-storage': {
        if (!argv['azure-storage-accountName'] || !argv['azure-storage-containerName']) {
          consola.error('Missing required arguments for Azure Storage backend')
          throw new Error('Missing required arguments for Azure Storage backend')
        }
        storage = await initializeStorage({
          backend: {
            type: 'azure-storage',
            name: backendType,
            config: {
              accountName: argv['azure-storage-accountName'] as string,
              containerName: argv['azure-storage-containerName'] as string,
            },
          },
        })
        break
      }
      case 'azure-key-vault': {
        if (!argv['azure-key-vault-endpoint'] || !argv['azure-key-vault-vaultName']) {
          consola.error('Missing required arguments for Azure Key Vault backend')
          throw new Error('Missing required arguments for Azure Key Vault backend')
        }
        storage = await initializeStorage({
          backend: {
            type: 'azure-key-vault',
            name: backendType,
            config: {
              vaultName: argv['azure-key-vault-vaultName'] as string,
              endpoint: argv['azure-key-vault-endpoint'] as string,
            },
          },
        })
        break
      }
      case 'azure-app-config': {
        if (!argv['azure-app-config-endpoint'] || !argv['azure-app-config-appConfigName']) {
          consola.error('Missing required arguments for Azure App Configuration backend')
          throw new Error('Missing required arguments for Azure App Configuration backend')
        }
        storage = await initializeStorage({
          backend: {
            type: 'azure-app-config',
            name: backendType,
            config: {
              appConfigName: argv['azure-app-config-appConfigName'] as string,
              endpoint: argv['azure-app-config-endpoint'] as string,
              label: argv['azure-app-config-label'] || '',
              prefix: argv['azure-app-config-prefix'] || '',
            },
          },
        })
        break
      }
      default: {
        throw new Error('Unsupported backend type')
      }
    }

    const hasConfig = await storage.hasItem('envsync.json')
    if (hasConfig) {
      config = destr(await storage.getItem('envsync.json'))
    } else {
      consola.error('No configuration found at remote')
      throw new Error('No configuration found at remote')
    }
  } else {
    if (verifyConfig().valid) {
      config = verifyConfig().config
      storage = await initializeStorage(config)
    } else throw new Error('Invalid configuration')
  }
  return {
    storage,
    config,
  }
}

export const consola = createConsola({
  level: 4,
  fancy: true,
  formatOptions: {
    colors: true,
    date: false,
    compact: false,
  },
})
