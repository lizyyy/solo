import { Router } from 'express'
import * as ctrl from '../controllers/issueController.js'

const router = Router()

router.get('/', ctrl.getIssues)
router.post('/', ctrl.createIssue)
router.post('/auto-detect', ctrl.autoDetectIssues)
router.get('/:id', ctrl.getIssueById)
router.get('/:id/log', ctrl.getIssueLogs)
router.post('/:id/submit-fix', ctrl.submitFix)
router.post('/:id/confirm-fix', ctrl.confirmFix)
router.post('/:id/reject-fix', ctrl.rejectFix)
router.post('/:id/close', ctrl.closeIssue)

export default router
