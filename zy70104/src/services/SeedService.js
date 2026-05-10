const BatchService = require('./BatchService');
const ReviewService = require('./ReviewService');
const SettlementService = require('./SettlementService');

const GRAIN_TYPES = ['玉米', '小麦', '水稻', '大豆', '高粱'];

class SeedService {
  
  constructor() {
    this.batchService = new BatchService();
    this.reviewService = new ReviewService();
    this.settlementService = new SettlementService();
  }
  
  generateBatches(count = 5) {
    const batches = [];
    
    for (let i = 0; i < count; i++) {
      const batchNo = `BATCH-${20260510}-${String(i + 1).padStart(3, '0')}`;
      const grainType = GRAIN_TYPES[Math.floor(Math.random() * GRAIN_TYPES.length)];
      
      const inWeight = 5000 + Math.random() * 15000;
      const inMoisture = 22 + Math.random() * 10;
      const inTemp = 18 + Math.random() * 15;
      
      const batch = this.batchService.createBatch({
        batchNo,
        grainType,
        inWeight,
        inMoisture,
        inTemp
      });
      
      batches.push(batch);
    }
    
    return batches;
  }
  
  async generateCompleteScenario() {
    const results = {
      created: [],
      dataComplete: [],
      pendingReview: [],
      approved: [],
      settled: []
    };
    
    const batch1 = this.batchService.createBatch({
      batchNo: 'DEMO-CREATED-001',
      grainType: '玉米',
      inWeight: 10000,
      inMoisture: 28.5,
      inTemp: 22
    });
    results.created.push(batch1);
    
    const batch2 = this.batchService.createBatch({
      batchNo: 'DEMO-DATA-001',
      grainType: '小麦',
      inWeight: 8000,
      inMoisture: 25.2,
      inTemp: 20
    });
    const updated2 = this.batchService.updateBatch('DEMO-DATA-001', {
      outWeight: 7200,
      outMoisture: 13.8,
      outTemp: 35,
      dryingTime: 420,
      fuelUsed: 420,
      powerUsed: 280
    });
    results.dataComplete.push(updated2);
    
    const batch3 = this.batchService.createBatch({
      batchNo: 'DEMO-PENDING-001',
      grainType: '水稻',
      inWeight: 12000,
      inMoisture: 30.1,
      inTemp: 24
    });
    this.batchService.updateBatch('DEMO-PENDING-001', {
      outWeight: 10000,
      outMoisture: 14.5,
      outTemp: 38,
      dryingTime: 540,
      fuelUsed: 550,
      powerUsed: 380
    });
    const review = await this.reviewService.submitReview('DEMO-PENDING-001');
    results.pendingReview.push({ batch: batch3, review });
    
    const batch4 = this.batchService.createBatch({
      batchNo: 'DEMO-APPROVED-001',
      grainType: '大豆',
      inWeight: 6000,
      inMoisture: 22.8,
      inTemp: 19
    });
    this.batchService.updateBatch('DEMO-APPROVED-001', {
      outWeight: 5400,
      outMoisture: 12.5,
      outTemp: 32,
      dryingTime: 360,
      fuelUsed: 320,
      powerUsed: 220
    });
    const review4 = await this.reviewService.submitReview('DEMO-APPROVED-001');
    const approvedReview = this.reviewService.approveReview(review4.id);
    results.approved.push({ batch: batch4, review: approvedReview });
    
    const batch5 = this.batchService.createBatch({
      batchNo: 'DEMO-SETTLED-001',
      grainType: '高粱',
      inWeight: 15000,
      inMoisture: 29.5,
      inTemp: 26
    });
    this.batchService.updateBatch('DEMO-SETTLED-001', {
      outWeight: 12800,
      outMoisture: 14.2,
      outTemp: 36,
      dryingTime: 600,
      fuelUsed: 620,
      powerUsed: 420
    });
    const review5 = await this.reviewService.submitReview('DEMO-SETTLED-001');
    this.reviewService.approveReview(review5.id);
    const settlement = await this.settlementService.calculateSettlement('DEMO-SETTLED-001');
    results.settled.push({ batch: batch5, review: review5, settlement });
    
    return results;
  }
  
  generateAnomalousBatch() {
    const batch = this.batchService.createBatch({
      batchNo: `ANOMALY-${Date.now().toString().slice(-6)}`,
      grainType: '玉米',
      inWeight: 10000,
      inMoisture: 28.5,
      inTemp: 22
    });
    
    const updated = this.batchService.updateBatch(batch.batchNo, {
      outWeight: 5000,
      outMoisture: 14.5,
      outTemp: 35,
      dryingTime: 0,
      fuelUsed: 500,
      powerUsed: 0
    });
    
    return updated;
  }
}

module.exports = new SeedService();
