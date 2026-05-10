const express = require('express')
const suppliersRouter = require('./routes/suppliers')
const productsRouter = require('./routes/products')
const deliveriesRouter = require('./routes/deliveries')
const inspectionsRouter = require('./routes/inspections')
const claimsRouter = require('./routes/claims')
const exceptionsRouter = require('./routes/exceptions')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/suppliers', suppliersRouter)
app.use('/api/products', productsRouter)
app.use('/api/deliveries', deliveriesRouter)
app.use('/api/inspections', inspectionsRouter)
app.use('/api/claims', claimsRouter)
app.use('/api/exceptions', exceptionsRouter)

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

module.exports = app
