import { Router } from 'express'
import { TicketStatus } from '@prisma/client'
import * as ticketService from '../services/ticketService.js'
import type { CreateTicketInput, UpdateTicketInput, MaterialInput } from '../types.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { status, assignedToId, startDate, endDate } = req.query
    
    const filter: ticketService.TicketFilter = {}
    if (status && Object.values(TicketStatus).includes(status as TicketStatus)) {
      filter.status = status as TicketStatus
    }
    if (typeof assignedToId === 'string') {
      filter.assignedToId = assignedToId
    }
    if (typeof startDate === 'string') {
      filter.startDate = startDate
    }
    if (typeof endDate === 'string') {
      filter.endDate = endDate
    }
    
    const tickets = await ticketService.listTickets(filter)
    res.json(tickets)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id)
    if (!ticket) {
      res.status(404).json({ error: '工单不存在' })
      return
    }
    res.json(ticket)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { callerName, callerPhone, location, description, priority, expectedDueDate } = req.body
    
    const input: CreateTicketInput = {
      callerName: String(callerName),
      callerPhone: String(callerPhone),
      location: String(location),
      description: String(description),
      priority: typeof priority === 'number' ? priority : 1,
      expectedDueDate: typeof expectedDueDate === 'string' ? expectedDueDate : undefined,
    }
    
    const ticket = await ticketService.createTicket(input)
    res.status(201).json(ticket)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(400).json({ error: message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const {
      callerName,
      callerPhone,
      location,
      description,
      priority,
      expectedDueDate,
      assignedToId,
      result,
    } = req.body
    
    const input: UpdateTicketInput = {}
    
    if (callerName !== undefined) input.callerName = String(callerName)
    if (callerPhone !== undefined) input.callerPhone = String(callerPhone)
    if (location !== undefined) input.location = String(location)
    if (description !== undefined) input.description = String(description)
    if (typeof priority === 'number') input.priority = priority
    if (expectedDueDate !== undefined) {
      input.expectedDueDate = typeof expectedDueDate === 'string' ? expectedDueDate : undefined
    }
    if (assignedToId !== undefined) {
      input.assignedToId = typeof assignedToId === 'string' ? assignedToId : undefined
    }
    if (result !== undefined) input.result = typeof result === 'string' ? result : undefined
    
    const ticket = await ticketService.updateTicket(req.params.id, input)
    res.json(ticket)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(400).json({ error: message })
  }
})

router.post('/:id/transition', async (req, res) => {
  try {
    const { status } = req.body
    
    if (!status || !Object.values(TicketStatus).includes(status as TicketStatus)) {
      res.status(400).json({ error: '无效的状态值' })
      return
    }
    
    const ticket = await ticketService.transitionStatus(
      req.params.id,
      status as TicketStatus
    )
    res.json(ticket)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(400).json({ error: message })
  }
})

router.put('/:id/materials', async (req, res) => {
  try {
    const { materials } = req.body
    
    if (!Array.isArray(materials)) {
      res.status(400).json({ error: 'materials 必须是数组' })
      return
    }
    
    const validMaterials: MaterialInput[] = materials.map(m => ({
      name: String(m.name),
      quantity: Number(m.quantity),
    }))
    
    const ticket = await ticketService.updateMaterials(req.params.id, validMaterials)
    res.json(ticket)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(400).json({ error: message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await ticketService.deleteTicket(req.params.id)
    res.status(204).send()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(400).json({ error: message })
  }
})

export default router
