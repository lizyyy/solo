import prisma from '../lib/prisma.js'
import type { Technician } from '@prisma/client'

export async function listTechnicians(): Promise<Technician[]> {
  return prisma.technician.findMany({
    orderBy: { createdAt: 'asc' },
  })
}

export async function getTechnicianById(id: string): Promise<Technician | null> {
  return prisma.technician.findUnique({ where: { id } })
}

export async function createTechnician(name: string): Promise<Technician> {
  if (!name?.trim()) {
    throw new Error('师傅姓名不能为空')
  }
  
  const existing = await prisma.technician.findUnique({
    where: { name: name.trim() },
  })
  
  if (existing) {
    throw new Error('师傅姓名已存在')
  }
  
  return prisma.technician.create({
    data: { name: name.trim() },
  })
}

export async function deleteTechnician(id: string): Promise<void> {
  const tech = await prisma.technician.findUnique({
    where: { id },
    include: { tickets: true },
  })
  
  if (!tech) {
    throw new Error('师傅不存在')
  }
  
  if (tech.tickets.length > 0) {
    throw new Error('该师傅有关联工单，无法删除')
  }
  
  await prisma.technician.delete({ where: { id } })
}
