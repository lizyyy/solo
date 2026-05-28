import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, '..', 'data')
const DATA_FILE = join(DATA_DIR, 'game-state.json')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readData() {
  ensureDataDir()
  if (!existsSync(DATA_FILE)) {
    const initial = { profiles: [], activeProfileId: null }
    writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    const initial = { profiles: [], activeProfileId: null }
    writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
}

function writeData(data: any) {
  ensureDataDir()
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

app.get('/api/state', (_req, res) => {
  const data = readData()
  res.json(data)
})

app.put('/api/state', (req, res) => {
  const { profiles, activeProfileId } = req.body
  if (!Array.isArray(profiles)) {
    res.status(400).json({ error: 'profiles must be an array' })
    return
  }
  writeData({ profiles, activeProfileId: activeProfileId || null, updatedAt: Date.now() })
  res.json({ ok: true })
})

app.get('/api/profiles', (_req, res) => {
  const data = readData()
  res.json(data.profiles)
})

app.post('/api/profiles', (req, res) => {
  const data = readData()
  const profile = req.body
  if (!profile.profileId || !profile.profileName) {
    res.status(400).json({ error: 'profileId and profileName are required' })
    return
  }
  data.profiles.push(profile)
  data.activeProfileId = profile.profileId
  writeData(data)
  res.json({ ok: true, profile })
})

app.put('/api/profiles/:id', (req, res) => {
  const data = readData()
  const idx = data.profiles.findIndex((p: any) => p.profileId === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: 'profile not found' })
    return
  }
  data.profiles[idx] = req.body
  writeData(data)
  res.json({ ok: true })
})

app.delete('/api/profiles/:id', (req, res) => {
  const data = readData()
  data.profiles = data.profiles.filter((p: any) => p.profileId !== req.params.id)
  if (data.activeProfileId === req.params.id) {
    data.activeProfileId = null
  }
  writeData(data)
  res.json({ ok: true })
})

app.put('/api/active-profile', (req, res) => {
  const data = readData()
  data.activeProfileId = req.body.activeProfileId || null
  writeData(data)
  res.json({ ok: true })
})

app.post('/api/import', (req, res) => {
  const { profiles, activeProfileId } = req.body
  if (!Array.isArray(profiles)) {
    res.status(400).json({ error: 'invalid data format' })
    return
  }
  writeData({ profiles, activeProfileId: activeProfileId || null, updatedAt: Date.now() })
  res.json({ ok: true })
})

app.get('/api/export', (_req, res) => {
  const data = readData()
  res.json({ ...data, exportedAt: new Date().toISOString() })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.listen(PORT, () => {
  console.log(`Storage API running on http://localhost:${PORT}`)
  console.log(`Data file: ${DATA_FILE}`)
})
