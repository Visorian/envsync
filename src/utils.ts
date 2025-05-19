import { createConsola } from 'consola'
import { createStorage } from 'unstorage'
import type { EnvsyncConfig } from './types'

export async function initializeStorage(config: EnvsyncConfig) {
  const { backend } = config
  switch (backend?.type) {
    case 'azure-storage': {
      const azureStorageBlobDriver = (
        await import('unstorage/drivers/azure-storage-blob')
      ).default
      return createStorage({
        driver: azureStorageBlobDriver({
          accountName: backend.config.accountName,
          containerName: backend.config.containerName,
        }),
      })
    }
    case 'azure-key-vault': {
      const azureKeyVault = (await import('unstorage/drivers/azure-key-vault'))
        .default
      return createStorage({
        driver: azureKeyVault({
          vaultName: backend.config.vaultName,
        }),
      })
    }
    case 'azure-app-config': {
      const azureAppConfiguration = (
        await import('unstorage/drivers/azure-app-configuration')
      ).default
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

export const consola = createConsola({})
