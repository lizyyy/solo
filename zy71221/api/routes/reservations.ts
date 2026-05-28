import { Router, type Request, type Response } from 'express'
import reservationService, { BusinessError } from '../services/reservationService.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const filter = {
      security_code: req.query.security_code as string | undefined,
      client_account: req.query.client_account as string | undefined,
      status: req.query.status as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
    }
    const data = reservationService.getReservations(filter)
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const data = reservationService.createReservation(req.body)
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: { code: err.code, message: err.message, detail: err.detail } })
      return
    }
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id)
    const data = reservationService.updateReservation(id, req.body)
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: { code: err.code, message: err.message, detail: err.detail } })
      return
    }
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/:id/return', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id)
    const data = reservationService.returnReservation(id)
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: { code: err.code, message: err.message, detail: err.detail } })
      return
    }
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

router.post('/:id/cancel', (req: Request, res: Response): void => {
  try {
    const id = Number(req.params.id)
    const reason = req.body.reason
    const data = reservationService.cancelReservation(id, reason)
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof BusinessError) {
      res.status(400).json({ success: false, error: { code: err.code, message: err.message, detail: err.detail } })
      return
    }
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

export default router
