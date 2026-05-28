import { Router, type Request, type Response } from 'express'
import reportService from '../services/reportService.js'

const router = Router()

router.get('/export', (req: Request, res: Response): void => {
  try {
    const filter = {
      security_code: req.query.security_code as string | undefined,
      client_account: req.query.client_account as string | undefined,
      status: req.query.status as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
    }
    const csv = reportService.exportReservationsCsv(filter)
    const filename = `reservations_${new Date().toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.send('\uFEFF' + csv)
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

export default router
