import app from './app.js'
import { initDb, db } from './db/index.js'
import { SEED_BATCHES } from './db/seed.js'
import { importBatch } from './services/batches.js'

async function startServer() {
  await initDb()

  for (const batchInput of SEED_BATCHES) {
    await db.read()
    const exists = db.data.batches.some((b) => b.id === batchInput.batchId)
    if (!exists) {
      try {
        await importBatch(batchInput, '知识库编辑小乔')
        console.log(`Seeded batch: ${batchInput.batchId}`)
      } catch (err) {
        console.error(`Failed to seed batch ${batchInput.batchId}:`, (err as Error).message)
      }
    }
  }

  const PORT = process.env.PORT || 3001

  const server = app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`)
  })

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received')
    server.close(() => {
      console.log('Server closed')
      process.exit(0)
    })
  })

  process.on('SIGINT', () => {
    console.log('SIGINT signal received')
    server.close(() => {
      console.log('Server closed')
      process.exit(0)
    })
  })
}

startServer()

export default app
