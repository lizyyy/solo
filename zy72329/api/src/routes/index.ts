import { Router } from 'express'
import authRoutes from './auth'
import importRoutes from './import'
import recordRoutes from './records'
import conflictRoutes from './conflicts'
import gapRoutes from './gaps'
import versionRoutes from './versions'
import historyRoutes from './history'
import exportRoutes from './export'

const router = Router()

router.use('/auth', authRoutes)
router.use('/import', importRoutes)
router.use('/records', recordRoutes)
router.use('/conflicts', conflictRoutes)
router.use('/gaps', gapRoutes)
router.use('/versions', versionRoutes)
router.use('/history', historyRoutes)
router.use('/export', exportRoutes)

export default router
