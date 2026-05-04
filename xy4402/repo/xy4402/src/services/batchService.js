const moment = require('moment');
const { Op } = require('sequelize');
const { 
  Batch, 
  Vehicle, 
  Store, 
  WeighingRecord, 
  Waybill, 
  GPSTrack,
  Review,
  RiskRecord
} = require('../models');
const { parseWeighingCSV, parseWaybillJSON, parseGPSTrack } = require('../utils/fileParser');
const { RiskEngine } = require('./riskEngine');

const generateBatchNumber = (date = new Date()) => {
  const dateStr = moment(date).format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `B${dateStr}-${random}`;
};

const createBatch = async (data) => {
  const { vehicleId, date, driverName } = data;
  
  const batchNumber = data.batchNumber || generateBatchNumber(date);
  const batchDate = date ? moment(date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
  
  const batch = await Batch.create({
    batchNumber,
    date: batchDate,
    vehicleId,
    status: 'pending',
    riskLevel: 'low',
    hasRisks: false
  });
  
  return batch;
};

const processBatchFiles = async (batchId, files) => {
  const batch = await Batch.findByPk(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const results = {
    weighingRecords: 0,
    waybills: 0,
    gpsTracks: 0,
    risks: []
  };

  if (files.weighingCSV && files.weighingCSV.length > 0) {
    for (const file of files.weighingCSV) {
      const records = await parseWeighingCSV(file.path);
      for (const record of records) {
        const store = await findOrCreateStoreByName(record.storeName);
        
        await WeighingRecord.create({
          ...record,
          batchId,
          storeId: store?.id,
          status: 'pending'
        });
        results.weighingRecords++;
      }
    }
  }

  if (files.waybillJSON && files.waybillJSON.length > 0) {
    for (const file of files.waybillJSON) {
      const waybills = await parseWaybillJSON(file.path);
      for (const waybill of waybills) {
        const store = await findOrCreateStore(waybill.storeName, waybill.storeCode);
        
        await Waybill.create({
          ...waybill,
          batchId,
          storeId: store?.id,
          status: 'pending'
        });
        results.waybills++;
      }
    }
  }

  if (files.gpsTrack && files.gpsTrack.length > 0) {
    for (const file of files.gpsTrack) {
      const tracks = await parseGPSTrack(file.path);
      for (const track of tracks) {
        await GPSTrack.create({
          ...track,
          batchId
        });
        results.gpsTracks++;
      }
    }
  }

  const [weighingCount, waybillCount] = await Promise.all([
    WeighingRecord.count({ where: { batchId } }),
    Waybill.count({ where: { batchId } })
  ]);

  const storeNames = new Set();
  const weighingRecords = await WeighingRecord.findAll({ where: { batchId } });
  const waybills = await Waybill.findAll({ where: { batchId } });
  
  weighingRecords.forEach(r => r.storeName && storeNames.add(r.storeName));
  waybills.forEach(w => w.storeName && storeNames.add(w.storeName));

  const totalWeight = weighingRecords.reduce((sum, r) => sum + (r.weight || 0), 0);

  await batch.update({
    storeCount: storeNames.size,
    waybillCount: waybillCount,
    totalWeight: totalWeight,
    status: 'processing'
  });

  const riskEngine = new RiskEngine(batchId);
  results.risks = await riskEngine.analyze();

  return results;
};

const findOrCreateStoreByName = async (storeName) => {
  if (!storeName) return null;
  
  let store = await Store.findOne({
    where: {
      name: { [Op.like]: storeName }
    }
  });
  
  if (!store) {
    store = await Store.findOne({
      where: {
        name: { [Op.like]: `%${storeName}%` }
      }
    });
  }
  
  return store;
};

const findOrCreateStore = async (storeName, storeCode) => {
  if (!storeName && !storeCode) return null;
  
  let store = null;
  
  if (storeCode) {
    store = await Store.findOne({
      where: { code: storeCode }
    });
  }
  
  if (!store && storeName) {
    store = await Store.findOne({
      where: {
        name: { [Op.like]: storeName }
      }
    });
  }
  
  if (!store && storeName) {
    store = await Store.findOne({
      where: {
        name: { [Op.like]: `%${storeName}%` }
      }
    });
  }
  
  return store;
};

const getBatchDetails = async (batchId) => {
  const batch = await Batch.findByPk(batchId, {
    include: [
      { model: Vehicle, as: 'vehicle' },
      { model: Review, as: 'reviews' },
      { model: RiskRecord, as: 'riskRecords' }
    ]
  });
  
  if (!batch) return null;
  
  const [weighingRecords, waybills, gpsTracks] = await Promise.all([
    WeighingRecord.findAll({ where: { batchId }, include: [{ model: Store, as: 'store' }] }),
    Waybill.findAll({ where: { batchId }, include: [{ model: Store, as: 'store' }] }),
    GPSTrack.findAll({ where: { batchId }, order: [['sequence', 'ASC']] })
  ]);
  
  return {
    ...batch.toJSON(),
    weighingRecords,
    waybills,
    gpsTracks
  };
};

const addReview = async (batchId, reviewData) => {
  const batch = await Batch.findByPk(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  const review = await Review.create({
    ...reviewData,
    batchId,
    reviewTime: reviewData.reviewTime || new Date()
  });
  
  if (reviewData.decision === 'approve') {
    await batch.update({ status: 'reviewed' });
  } else if (reviewData.decision === 'reject') {
    await batch.update({ status: 'flagged' });
  }
  
  return review;
};

const resolveRisk = async (riskId, resolutionData) => {
  const risk = await RiskRecord.findByPk(riskId);
  if (!risk) {
    throw new Error('风险记录不存在');
  }
  
  await risk.update({
    isResolved: true,
    resolvedAt: new Date(),
    resolvedBy: resolutionData.resolvedBy,
    resolutionNote: resolutionData.resolutionNote
  });
  
  return risk;
};

module.exports = {
  createBatch,
  processBatchFiles,
  getBatchDetails,
  addReview,
  resolveRisk,
  generateBatchNumber
};
