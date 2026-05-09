import { Router, Request, Response, NextFunction } from 'express'
import { createDevice, updateDevice, deleteDevice, getDeviceById, getDevices } from '../services/device'
import { cacheIdempotentResponse, getEndpointKey } from '../middleware/idempotency'

const router = Router()

const CURRENT_USER = {
  id: 'demo-user-id',
  name: '演示用户'
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const status = req.query.status as string | undefined
    const type = req.query.type as string | undefined
    const search = req.query.search as string | undefined

    const result = await getDevices({
      page,
      pageSize,
      status: status as any,
      type,
      search
    })

    res.json({
      success: true,
      data: result,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device = await getDeviceById(req.params.id)

    if (!device) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '设备不存在'
        },
        requestId: req.idempotency.requestId,
        timestamp: new Date().toISOString()
      })
      return
    }

    res.json({
      success: true,
      data: device,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
      res.json(req.idempotency.cachedResponse)
      return
    }

    const device = await createDevice({
      name: req.body.name,
      code: req.body.code,
      type: req.body.type,
      model: req.body.model,
      serialNumber: req.body.serialNumber,
      description: req.body.description,
      operatorId: CURRENT_USER.id,
      operatorName: CURRENT_USER.name,
      requestId: req.idempotency.requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    const response = {
      success: true,
      data: device,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    }

    await cacheIdempotentResponse(
      req.idempotency.requestId,
      getEndpointKey(req.method, req.originalUrl),
      response
    )

    res.status(201).json(response)
  } catch (error) {
    next(error)
  }
})

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
      res.json(req.idempotency.cachedResponse)
      return
    }

    const device = await updateDevice({
      id: req.params.id,
      name: req.body.name,
      code: req.body.code,
      type: req.body.type,
      model: req.body.model,
      serialNumber: req.body.serialNumber,
      description: req.body.description,
      status: req.body.status,
      operatorId: CURRENT_USER.id,
      operatorName: CURRENT_USER.name,
      requestId: req.idempotency.requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    const response = {
      success: true,
      data: device,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    }

    await cacheIdempotentResponse(
      req.idempotency.requestId,
      getEndpointKey(req.method, req.originalUrl),
      response
    )

    res.json(response)
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.idempotency.isRetry && req.idempotency.cachedResponse) {
      res.json(req.idempotency.cachedResponse)
      return
    }

    await deleteDevice(
      req.params.id,
      CURRENT_USER.id,
      CURRENT_USER.name,
      req.idempotency.requestId,
      req.ip,
      req.headers['user-agent']
    )

    const response = {
      success: true,
      data: null,
      requestId: req.idempotency.requestId,
      timestamp: new Date().toISOString()
    }

    await cacheIdempotentResponse(
      req.idempotency.requestId,
      getEndpointKey(req.method, req.originalUrl),
      response
    )

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
