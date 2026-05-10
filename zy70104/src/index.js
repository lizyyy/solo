const BatchService = require('./services/BatchService');
const ReviewService = require('./services/ReviewService');
const SettlementService = require('./services/SettlementService');
const ExportService = require('./services/ExportService');
const dataStore = require('./utils/dataStore');
const moistureCalculator = require('./utils/moistureCalculator');
const energyAllocator = require('./utils/energyAllocator');
const Batch = require('./models/Batch');

module.exports = {
  BatchService,
  ReviewService,
  SettlementService,
  ExportService,
  dataStore,
  moistureCalculator,
  energyAllocator,
  Batch,
  
  init: () => dataStore.init(),
  
  getServices: () => ({
    batch: new BatchService(),
    review: new ReviewService(),
    settlement: new SettlementService(),
    export: new ExportService()
  }),
  
  constants: {
    BatchStatus: Batch.STATUS,
    ReviewStatus: ReviewService.STATUS,
    SettlementStatus: SettlementService.STATUS
  }
};
