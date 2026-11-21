import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const projectIndex = args.indexOf('--project')
if (!['emulators:start', 'emulators:exec'].includes(args[0]) ||
    projectIndex < 0 || args[projectIndex + 1] !== 'demo-ats-loja-digital') {
  throw new Error('This public snapshot allows only the local demo emulator project')
}

const firebaseEntry = join(dirname(fileURLToPath(import.meta.resolve('firebase-tools'))), 'bin', 'firebase.js')
const environment = { ...process.env }

// Keep all service discovery local; allow slower Windows devices to initialize.
environment.METADATA_SERVER_DETECTION = 'none'
environment.FUNCTIONS_DISCOVERY_TIMEOUT = '60'
environment.TEMP = ''
environment.TMP = ''

const result = spawnSync(process.execPath, [firebaseEntry, ...args], {
  cwd: process.cwd(),
  env: environment,
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
