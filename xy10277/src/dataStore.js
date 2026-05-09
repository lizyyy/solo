const database = {
  babies: {
    B001: {
      babyId: 'B001',
      memberId: 'M001',
      memberName: '张小宝',
      motherName: '李妈妈',
      birthDate: '2025-02-15',
      months: 3,
      allergies: ['牛奶蛋白'],
      isActive: true,
      createdAt: new Date('2025-03-01'),
      history: []
    },
    B002: {
      babyId: 'B002',
      memberId: 'M002',
      memberName: '王乐乐',
      motherName: '王妈妈',
      birthDate: '2024-06-10',
      months: 11,
      allergies: [],
      isActive: true,
      createdAt: new Date('2024-07-01'),
      history: []
    },
    B003: {
      babyId: 'B003',
      memberId: 'M003',
      memberName: '刘甜甜',
      motherName: '刘妈妈',
      birthDate: '2025-04-20',
      months: 1,
      allergies: ['乳糖不耐受'],
      isActive: true,
      createdAt: new Date('2025-05-01'),
      history: []
    },
    B004: {
      babyId: 'B004',
      memberId: 'M004',
      memberName: '陈萌萌',
      motherName: '陈妈妈',
      birthDate: '2024-01-05',
      months: 16,
      allergies: [],
      isActive: true,
      createdAt: new Date('2024-02-01'),
      history: []
    }
  },
  batches: {
    BT20260501: {
      batchId: 'BT20260501',
      milkBrand: '爱他美',
      milkType: '普通配方',
      stage: '1段',
      monthRange: { min: 0, max: 6 },
      allergenRisk: ['牛奶蛋白', '乳糖'],
      totalQuantity: 100,
      distributed: 15,
      recallStatus: 'normal',
      isActive: true,
      createdAt: new Date('2026-05-01'),
      expiryDate: '2027-05-01'
    },
    BT20260502: {
      batchId: 'BT20260502',
      milkBrand: '雀巢',
      milkType: '适度水解',
      stage: '1段',
      monthRange: { min: 0, max: 6 },
      allergenRisk: [],
      totalQuantity: 80,
      distributed: 8,
      recallStatus: 'normal',
      isActive: true,
      createdAt: new Date('2026-05-01'),
      expiryDate: '2027-05-01'
    },
    BT20260401: {
      batchId: 'BT20260401',
      milkBrand: '美赞臣',
      milkType: '普通配方',
      stage: '2段',
      monthRange: { min: 6, max: 12 },
      allergenRisk: ['牛奶蛋白'],
      totalQuantity: 120,
      distributed: 45,
      recallStatus: 'recalled',
      isActive: true,
      createdAt: new Date('2026-04-01'),
      expiryDate: '2027-04-01'
    },
    BT20260503: {
      batchId: 'BT20260503',
      milkBrand: '伊利',
      milkType: '普通配方',
      stage: '3段',
      monthRange: { min: 12, max: 36 },
      allergenRisk: ['牛奶蛋白'],
      totalQuantity: 150,
      distributed: 20,
      recallStatus: 'normal',
      isActive: true,
      createdAt: new Date('2026-05-01'),
      expiryDate: '2027-05-01'
    }
  },
  claims: {},
  claimHistory: {}
};

let nextClaimId = 1;
let nextHistoryId = 1;

module.exports = {
  getBaby(babyId) {
    return database.babies[babyId];
  },

  getAllBabies() {
    return Object.values(database.babies);
  },

  addBaby(baby) {
    database.babies[baby.babyId] = baby;
    return baby;
  },

  updateBaby(babyId, updates) {
    if (!database.babies[babyId]) return null;
    const before = JSON.stringify(database.babies[babyId]);
    Object.assign(database.babies[babyId], updates);
    database.babies[babyId].history.push({
      historyId: nextHistoryId++,
      updatedAt: new Date(),
      before: JSON.parse(before),
      after: JSON.parse(JSON.stringify(database.babies[babyId]))
    });
    return database.babies[babyId];
  },

  getBatch(batchId) {
    return database.batches[batchId];
  },

  getAllBatches() {
    return Object.values(database.batches);
  },

  addBatch(batch) {
    database.batches[batch.batchId] = batch;
    return batch;
  },

  updateBatch(batchId, updates) {
    if (!database.batches[batchId]) return null;
    Object.assign(database.batches[batchId], updates);
    return database.batches[batchId];
  },

  getClaim(claimId) {
    return database.claims[claimId];
  },

  getClaimByRequestId(requestId) {
    return Object.values(database.claims).find(c => c.requestId === requestId);
  },

  getAllClaims() {
    return Object.values(database.claims);
  },

  addClaim(claim) {
    const claimId = 'C' + (nextClaimId++).toString().padStart(6, '0');
    database.claims[claimId] = { ...claim, claimId, createdAt: new Date() };
    return database.claims[claimId];
  },

  updateClaim(claimId, updates) {
    if (!database.claims[claimId]) return null;
    Object.assign(database.claims[claimId], updates);
    return database.claims[claimId];
  },

  addClaimHistory(claimId, eventType, details) {
    const history = {
      historyId: nextHistoryId++,
      claimId,
      eventType,
      details,
      timestamp: new Date()
    };
    if (!database.claimHistory[claimId]) {
      database.claimHistory[claimId] = [];
    }
    database.claimHistory[claimId].push(history);
    return history;
  },

  getClaimHistory(claimId) {
    return database.claimHistory[claimId] || [];
  },

  getClaimsByBaby(babyId) {
    return Object.values(database.claims).filter(c => c.babyId === babyId);
  },

  hasBabyClaimedBatch(babyId, batchId) {
    return Object.values(database.claims).some(
      c => c.babyId === babyId &&
        c.batchId === batchId &&
        ['approved', 'completed'].includes(c.status)
    );
  },

  hasBabyClaimed(babyId) {
    return Object.values(database.claims).some(
      c => c.babyId === babyId && ['approved', 'completed'].includes(c.status)
    );
  },

  getClaimsSummary() {
    const claims = this.getAllClaims();
    return {
      total: claims.length,
      pending: claims.filter(c => c.status === 'pending').length,
      approved: claims.filter(c => c.status === 'approved').length,
      completed: claims.filter(c => c.status === 'completed').length,
      rejected: claims.filter(c => c.status === 'rejected').length,
      withdrawn: claims.filter(c => c.status === 'withdrawn').length,
      failed: claims.filter(c => c.status === 'failed').length
    };
  }
};
