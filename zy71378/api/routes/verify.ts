import { Router } from 'express'
import { verifySignature } from '../services/signatureVerifier.js'

const router = Router()

router.post('/signature', (req, res) => {
  try {
    const { payload, signature_header, secret } = req.body

    if (!payload) {
      res.status(400).json({ success: false, error: 'payload is required' })
      return
    }

    const result = verifySignature(payload, signature_header, secret)
    res.json({
      success: true,
      valid: result.valid,
      expired: result.expired,
      signature_header: signature_header || null,
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Signature verification failed' })
  }
})

export default router
