import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

export const localEnvironment = {
  VITE_FIREBASE_MODE: 'emulator', VITE_FIREBASE_PROJECT_ID: 'demo-ats-loja-digital',
  VITE_FIREBASE_AUTH_HOST: '127.0.0.1', VITE_FIREBASE_AUTH_PORT: '9099',
  VITE_FIRESTORE_HOST: '127.0.0.1', VITE_FIRESTORE_PORT: '8180',
}
const action = process.argv[2]
if (!['dev', 'build', 'preview'].includes(action)) throw new Error('Use dev, build or preview')
const vite = resolve(dirname(fileURLToPath(import.meta.resolve('vite'))), '../../bin/vite.js')
const child = spawn(process.execPath, [vite, ...(action === 'dev' ? [] : [action]), ...process.argv.slice(3)], {
  env: { ...process.env, ...localEnvironment }, stdio: 'inherit',
})
child.on('exit', code => { process.exitCode = code ?? 1 })
