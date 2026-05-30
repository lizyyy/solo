import { Router } from 'express'
import * as ctrl from '../controllers/statsController.js'

const router = Router()

router.get('/overview', ctrl.getOverview)
router.get('/tech-stack', ctrl.getTechStack)
router.get('/rating', ctrl.getRating)
router.get('/failures', ctrl.getFailures)
router.get('/trend', ctrl.getTrend)

export default router
