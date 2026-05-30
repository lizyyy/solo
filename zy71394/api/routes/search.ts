import { Router } from 'express'
import * as ctrl from '../controllers/searchController.js'

const router = Router()

router.get('/fulltext', ctrl.fulltextSearch)
router.post('/similar', ctrl.similarSearch)
router.get('/reports', ctrl.getSearchReports)
router.get('/reports/:id', ctrl.getSearchReportById)

export default router
