process.once('SIGINT', () => {
  // Handle ctrl+c
  consola.error('Aborted by user.')
  process.exit(1)
})

import yargs from 'yargs'
import { envsyncConfig, verifyConfig } from './config'
import { clear, init, rescan, status, sync, update } from './envvfiles'
import type { Arguments } from './types'
import { consola } from './utils'

// Define common options for sync, status, and clear commands
const commonOptions = {
  directory: {
    alias: 'd',
    type: 'string',
    description: 'Specify the directory to sync environment files',
    demandOption: false,
  },
  'backend-type': {
    alias: 'b',
    type: 'string',
    description: 'Specify the backend type (e.g., s3, gcs, local)',
    demandOption: false,
  },
  'config-file': {
    alias: 'c',
    type: 'string',
    description: 'Path to the envsync configuration file',
    demandOption: false,
  },
  overwrite: {
    alias: 'o',
    type: 'boolean',
    description: 'Overwrite existing environment files in the remote location when running update',
    demandOption: false,
  },
  merge: {
    alias: 'm',
    type: 'boolean',
    description: 'Merge with existing local environment files',
    demandOption: false,
  },
  'remote-config': {
    alias: 'r',
    type: 'boolean',
    description: 'Use configuration stored in remote location',
    demandOption: false,
  },
  includeSuffixes: {
    alias: 'i',
    type: 'boolean',
    description:
      'Include .env files with suffixes like .env.sample, .env.template. Default false, these should better be managed with git.',
    demandOption: false,
  },
  'azure-storage-accountName': {
    type: 'string',
    description: 'Azure Storage Account Name',
    demandOption: false,
  },
  'azure-storage-containerName': {
    type: 'string',
    description: 'Azure Storage Container Name',
    demandOption: false,
  },
  'azure-key-vault-vaultName': {
    type: 'string',
    description: 'Azure Key Vault Name',
    demandOption: false,
  },
  'azure-app-config-appConfigName': {
    type: 'string',
    description: 'Azure App Configuration Name',
    demandOption: false,
  },
  'azure-app-config-endpoint': {
    type: 'string',
    description: 'Azure App Configuration Endpoint',
    demandOption: false,
  },
  'azure-app-config-prefix': {
    type: 'string',
    description: 'Azure App Configuration Key Prefix',
    demandOption: false,
  },
  'azure-app-config-label': {
    type: 'string',
    description: 'Azure App Configuration Label',
    demandOption: false,
  },
} as const

const logo = `
   ___          ___
  | __|_ ___ __/ __|_  _ _ _  __
 _| _|| ' \\ V /\\__ \\ || | ' \\/ _|
(_)___|_||_\\_/ |___/\\_, |_||_\\__|
                   |__/
`

async function runCli() {
  yargs(process.argv.slice(2))
    .scriptName('envsync')
    .options({
      'hide-logo': {
        alias: 'l',
        demandOption: false,
        type: 'boolean',
        describe: 'Suppress ASCII logo on startup',
        default: false,
      },
    })
    // Middleware runs once immediately after parse, before commands/help
    .middleware((argv) => {
      if (!argv.hideLogo) {
        console.log(logo)
      }
    })
    .usage('$0 <command> [options]')
    .command({
      command: 'sync',
      describe: 'Synchronize environment variables with the backend',
      builder: (yargs) => yargs.options(commonOptions),
      handler: async (argv) => {
        await sync(argv as Arguments)
      },
    })
    .command({
      command: 'status',
      describe: 'Show the current status of environment variables relative to the backend',
      builder: (yargs) => yargs.options(commonOptions),
      handler: async (argv) => {
        await status(argv as Arguments)
      },
    })
    .command({
      command: 'init',
      describe: 'Initialize a new environment sync configuration',
      builder: (yargs) => yargs.options(commonOptions),
      handler: async (argv) => {
        await init(argv as Arguments)
      },
    })
    .command({
      command: 'update',
      describe:
        'Updates the content of the configured .env files in the remote location from the current content on disk',
      builder: (yargs) => yargs.options(commonOptions),
      handler: async (argv) => {
        if (verifyConfig().valid) {
          update(argv as Arguments)
        }
      },
    })
    .command({
      command: 'clear',
      describe: 'Clear local environment variables',
      builder: (yargs) => yargs.options(commonOptions),
      handler: async (argv) => {
        if (verifyConfig().valid) {
          await clear(argv as Arguments)
        }
      },
    })
    .command({
      command: 'rescan',
      describe: 'Rescan for .env files and update configuration',
      builder: (yargs) => yargs.options(commonOptions),
      handler: async (argv) => {
        if (verifyConfig().valid) {
          await rescan(argv as Arguments)
        }
      },
    })
    .command({
      command: 'config',
      describe: 'Manage envsync configuration',
      builder: (yargs) => yargs, // No options for config command, return yargs directly
      handler: async () => {
        consola.info('Current configuration:')
        console.log(JSON.stringify(envsyncConfig, null, 2))
      },
    })
    .strict()
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .version()
    .parse()
}

runCli().catch((err) => {
  console.error('An error occurred:', err)
  process.exit(1)
})
