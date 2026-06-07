const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const DATA_DIR = path.join(__dirname, '../data')

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

const readJsonFile = (filename) => {
  ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return []
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    return []
  }
}

const writeJsonFile = (filename, data) => {
  ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

const getBatches = () => readJsonFile('batches.json')
const saveBatches = (batches) => writeJsonFile('batches.json', batches)

const getSamples = () => readJsonFile('samples.json')
const saveSamples = (samples) => writeJsonFile('samples.json', samples)

const getOperationLogs = () => readJsonFile('operation_logs.json')
const saveOperationLogs = (logs) => writeJsonFile('operation_logs.json', logs)

const createBatch = (batchData) => {
  const batches = getBatches()
  const batch = {
    id: uuidv4(),
    ...batchData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  batches.push(batch)
  saveBatches(batches)
  return batch
}

const createSample = (sampleData) => {
  const samples = getSamples()
  const sample = {
    id: uuidv4(),
    ...sampleData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  samples.push(sample)
  saveSamples(samples)
  return sample
}

const updateSample = (sampleId, updateData) => {
  const samples = getSamples()
  const index = samples.findIndex(s => s.id === sampleId)
  if (index === -1) return null
  samples[index] = {
    ...samples[index],
    ...updateData,
    updatedAt: new Date().toISOString()
  }
  saveSamples(samples)
  return samples[index]
}

const addOperationLog = (logData) => {
  const logs = getOperationLogs()
  const log = {
    id: uuidv4(),
    ...logData,
    createdAt: new Date().toISOString()
  }
  logs.push(log)
  saveOperationLogs(logs)
  return log
}

module.exports = {
  getBatches,
  saveBatches,
  getSamples,
  saveSamples,
  getOperationLogs,
  saveOperationLogs,
  createBatch,
  createSample,
  updateSample,
  addOperationLog
}
