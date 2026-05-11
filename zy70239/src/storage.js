const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const DATA_FILES = {
  goods: path.join(config.DATA_DIR, 'goods.json'),
  assignments: path.join(config.DATA_DIR, 'assignments.json'),
  validations: path.join(config.DATA_DIR, 'validations.json'),
  jobs: path.join(config.DATA_DIR, 'jobs.json'),
  corrections: path.join(config.DATA_DIR, 'corrections.json'),
  stats: path.join(config.DATA_DIR, 'stats.json'),
  exports: path.join(config.DATA_DIR, 'exports.json')
};

async function initStorage() {
  await fs.ensureDir(config.DATA_DIR);
  for (const file of Object.values(DATA_FILES)) {
    if (!await fs.pathExists(file)) {
      await fs.writeJson(file, [], { spaces: 2 });
    }
  }
}

async function readData(filePath) {
  if (!await fs.pathExists(filePath)) return [];
  try {
    return await fs.readJson(filePath);
  } catch (e) {
    return [];
  }
}

async function writeData(filePath, data) {
  await fs.writeJson(filePath, data, { spaces: 2 });
}

async function saveGoods(goods) {
  const data = await readData(DATA_FILES.goods);
  const existing = data.find(g => g.batchId === goods.batchId && g.goodsNo === goods.goodsNo);
  
  if (existing) {
    Object.assign(existing, goods, { updatedAt: new Date().toISOString() });
    await writeData(DATA_FILES.goods, data);
    return existing;
  }
  
  const newGoods = {
    ...goods,
    id: uuidv4(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.push(newGoods);
  await writeData(DATA_FILES.goods, data);
  return newGoods;
}

async function getGoodsByBatch(batchId) {
  const data = await readData(DATA_FILES.goods);
  return data.filter(g => g.batchId === batchId);
}

async function getGoodsById(id) {
  const data = await readData(DATA_FILES.goods);
  return data.find(g => g.id === id);
}

async function updateGoodsStatus(id, status) {
  const data = await readData(DATA_FILES.goods);
  const goods = data.find(g => g.id === id);
  if (goods) {
    goods.status = status;
    goods.updatedAt = new Date().toISOString();
    await writeData(DATA_FILES.goods, data);
  }
  return goods;
}

async function saveAssignment(assignment) {
  const data = await readData(DATA_FILES.assignments);
  const existing = data.find(a => a.batchId === assignment.batchId && a.goodsId === assignment.goodsId);
  
  if (existing) {
    Object.assign(existing, assignment, { updatedAt: new Date().toISOString() });
    await writeData(DATA_FILES.assignments, data);
    return existing;
  }
  
  const newAssignment = {
    ...assignment,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.push(newAssignment);
  await writeData(DATA_FILES.assignments, data);
  return newAssignment;
}

async function getAssignmentsByBatch(batchId) {
  const data = await readData(DATA_FILES.assignments);
  return data.filter(a => a.batchId === batchId);
}

async function saveValidation(validation) {
  const data = await readData(DATA_FILES.validations);
  const existing = data.find(v => v.batchId === validation.batchId && v.goodsId === validation.goodsId);
  
  if (existing) {
    Object.assign(existing, validation, { updatedAt: new Date().toISOString() });
    await writeData(DATA_FILES.validations, data);
    return existing;
  }
  
  const newValidation = {
    ...validation,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.push(newValidation);
  await writeData(DATA_FILES.validations, data);
  return newValidation;
}

async function getValidationsByBatch(batchId) {
  const data = await readData(DATA_FILES.validations);
  return data.filter(v => v.batchId === batchId);
}

async function saveJob(job) {
  const data = await readData(DATA_FILES.jobs);
  const existing = data.find(j => j.batchId === job.batchId && j.jobNo === job.jobNo);
  
  if (existing) {
    Object.assign(existing, job, { updatedAt: new Date().toISOString() });
    await writeData(DATA_FILES.jobs, data);
    return existing;
  }
  
  const newJob = {
    ...job,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.push(newJob);
  await writeData(DATA_FILES.jobs, data);
  return newJob;
}

async function getJobsByBatch(batchId) {
  const data = await readData(DATA_FILES.jobs);
  return data.filter(j => j.batchId === batchId);
}

async function saveCorrection(correction) {
  const data = await readData(DATA_FILES.corrections);
  const newCorrection = {
    ...correction,
    id: uuidv4(),
    createdAt: new Date().toISOString()
  };
  
  data.push(newCorrection);
  await writeData(DATA_FILES.corrections, data);
  return newCorrection;
}

async function getCorrectionsByBatch(batchId) {
  const data = await readData(DATA_FILES.corrections);
  return data.filter(c => c.batchId === batchId);
}

async function saveStats(batchId, stats) {
  const data = await readData(DATA_FILES.stats);
  const existing = data.find(s => s.batchId === batchId);
  
  if (existing) {
    Object.assign(existing, stats, { updatedAt: new Date().toISOString() });
    await writeData(DATA_FILES.stats, data);
    return existing;
  }
  
  const newStats = {
    ...stats,
    batchId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.push(newStats);
  await writeData(DATA_FILES.stats, data);
  return newStats;
}

async function getStatsByBatch(batchId) {
  const data = await readData(DATA_FILES.stats);
  return data.find(s => s.batchId === batchId);
}

async function saveExport(batchId, exportType, content) {
  const data = await readData(DATA_FILES.exports);
  const existing = data.find(e => e.batchId === batchId && e.type === exportType);
  
  if (existing) {
    Object.assign(existing, { content, updatedAt: new Date().toISOString() });
    await writeData(DATA_FILES.exports, data);
    return existing;
  }
  
  const newExport = {
    id: uuidv4(),
    batchId,
    type: exportType,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  data.push(newExport);
  await writeData(DATA_FILES.exports, data);
  return newExport;
}

async function getExportsByBatch(batchId) {
  const data = await readData(DATA_FILES.exports);
  return data.filter(e => e.batchId === batchId);
}

async function clearBatchData(batchId) {
  const goodsData = await readData(DATA_FILES.goods);
  const filteredGoods = goodsData.filter(g => g.batchId !== batchId);
  await writeData(DATA_FILES.goods, filteredGoods);
  
  const assignmentsData = await readData(DATA_FILES.assignments);
  const filteredAssignments = assignmentsData.filter(a => a.batchId !== batchId);
  await writeData(DATA_FILES.assignments, filteredAssignments);
  
  const validationsData = await readData(DATA_FILES.validations);
  const filteredValidations = validationsData.filter(v => v.batchId !== batchId);
  await writeData(DATA_FILES.validations, filteredValidations);
  
  const jobsData = await readData(DATA_FILES.jobs);
  const filteredJobs = jobsData.filter(j => j.batchId !== batchId);
  await writeData(DATA_FILES.jobs, filteredJobs);
  
  const correctionsData = await readData(DATA_FILES.corrections);
  const filteredCorrections = correctionsData.filter(c => c.batchId !== batchId);
  await writeData(DATA_FILES.corrections, filteredCorrections);
  
  const statsData = await readData(DATA_FILES.stats);
  const filteredStats = statsData.filter(s => s.batchId !== batchId);
  await writeData(DATA_FILES.stats, filteredStats);
  
  const exportsData = await readData(DATA_FILES.exports);
  const filteredExports = exportsData.filter(e => e.batchId !== batchId);
  await writeData(DATA_FILES.exports, filteredExports);
}

module.exports = {
  initStorage,
  saveGoods,
  getGoodsByBatch,
  getGoodsById,
  updateGoodsStatus,
  saveAssignment,
  getAssignmentsByBatch,
  saveValidation,
  getValidationsByBatch,
  saveJob,
  getJobsByBatch,
  saveCorrection,
  getCorrectionsByBatch,
  saveStats,
  getStatsByBatch,
  saveExport,
  getExportsByBatch,
  clearBatchData
};
