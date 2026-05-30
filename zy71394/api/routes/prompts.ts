import { Router } from 'express'
import * as ctrl from '../controllers/promptController.js'

const router = Router()

router.get('/', ctrl.getPrompts)
router.get('/tags', ctrl.getTags)
router.get('/tech-stacks', ctrl.getTechStacks)
router.get('/failure-reasons', ctrl.getFailureReasons)
router.get('/duplicates', ctrl.checkDuplicates)
router.post('/duplicates', ctrl.checkDuplicates)
router.post('/tags', ctrl.createTag)
router.get('/:id', ctrl.getPromptById)
router.get('/:id/versions', ctrl.getPromptVersions)
router.post('/', ctrl.createPrompt)
router.put('/:id', ctrl.updatePrompt)
router.delete('/:id', ctrl.deletePrompt)
router.post('/:promptId/versions/:version/confirm', ctrl.confirmVersion)

export default router
