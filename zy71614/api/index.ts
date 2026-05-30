import type { VercelRequest, VercelResponse } from '@vercel/node'
import app, { initDatabase } from './app.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()
  return app(req, res)
}
