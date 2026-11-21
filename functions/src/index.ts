import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { DomainError } from '../../src/shared/domain/DomainError'
import { executeCommand } from './commands'
import { assertLocalEnvironment } from './localEnvironment'

export const commerce = onRequest({ cors: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/], invoker: 'public' }, async (request, response) => {
  try {
    assertLocalEnvironment(process.env)
    process.env.METADATA_SERVER_DETECTION = 'none'
    if (request.method !== 'POST' || !request.is('application/json') || Number(request.headers['content-length'] ?? 0) > 24000) {
      response.status(400).json({ code: 'INVALID_INPUT' }); return
    }
    const app = getApps()[0] ?? initializeApp({ projectId: 'demo-ats-loja-digital' })
    const token = request.headers.authorization
    let uid: string | undefined
    if (token) {
      try { uid = (await getAuth(app).verifyIdToken(token.replace(/^Bearer /, ''), true)).uid }
      catch { response.status(403).json({ code: 'ACCESS_DENIED' }); return }
    }
    const body = request.body as Record<string, unknown>
    if (!body || Object.keys(body).some(key => !['command', 'input'].includes(key)) || typeof body.command !== 'string') {
      response.status(400).json({ code: 'INVALID_INPUT' }); return
    }
    const result = await executeCommand(getFirestore(app), body.command, body.input, uid)
    response.set('Cache-Control', 'no-store').json({ result })
  } catch (error) {
    // No request bodies, customer information or tokens in logs/errors.
    response.status(error instanceof DomainError ? 400 : 503).json({ code: error instanceof DomainError ? error.code : 'SERVICE_UNAVAILABLE' })
  }
})
