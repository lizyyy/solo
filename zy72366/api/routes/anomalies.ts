import { Router, type Request, type Response } from "express"
import db from "../db.js"

const router = Router()

router.get("/summary", (_req, res) => {
  res.json({ pending: 0, confirmed: 0, rolledBack: 0 })
})

router.get("/records", (_req, res) => { res.json([]) })
router.patch("/records/:id/confirm", (req, res) => { res.json({ success: true }) })
router.patch("/records/:id/rollback", (req, res) => { res.json({ success: true }) })
router.get("/export", (_req, res) => { res.send("") })

export default router
