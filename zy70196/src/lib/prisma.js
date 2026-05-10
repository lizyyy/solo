const { PrismaClient } = require('@prisma/client')

let prisma

if (process.env.NODE_ENV === 'test') {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || 'file:./test.db'
      }
    }
  })
} else {
  prisma = new PrismaClient()
}

module.exports = prisma
