import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

beforeAll(async () => {
  process.env.DATABASE_URL = 'file:./test.db'
  execSync('npx prisma migrate reset --force', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  })
})

beforeEach(async () => {
  await prisma.$transaction([
    prisma.scanDetail.deleteMany(),
    prisma.statusHistory.deleteMany(),
    prisma.failedRecord.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.ledger.deleteMany(),
  ])
})

afterAll(async () => {
  await prisma.$disconnect()
})
