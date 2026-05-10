const store = require('../models/store');
const AppError = require('../utils/errors');

function getDoseReport() {
  const inventory = store.getAllInventory();
  const appointments = store.store.appointments;
  const exceptions = store.getAllExceptions();

  const vaccineStats = {};
  inventory.forEach(inv => {
    if (!vaccineStats[inv.vaccineId]) {
      const vaccine = store.getVaccineById(inv.vaccineId);
      vaccineStats[inv.vaccineId] = {
        vaccineId: inv.vaccineId,
        vaccineName: vaccine ? vaccine.name : 'Unknown',
        totalDoses: 0,
        availableDoses: 0,
        lockedDoses: 0,
        frozenDoses: 0,
        usedDoses: 0,
        batches: []
      };
    }
    
    const stats = vaccineStats[inv.vaccineId];
    stats.totalDoses += inv.totalDoses;
    stats.availableDoses += inv.availableDoses;
    stats.lockedDoses += inv.lockedDoses;
    stats.frozenDoses += inv.frozenDoses;
    
    stats.batches.push({
      batchNo: inv.batchNo,
      status: inv.status,
      totalDoses: inv.totalDoses,
      availableDoses: inv.availableDoses,
      lockedDoses: inv.lockedDoses,
      frozenDoses: inv.frozenDoses,
      coldBoxId: inv.coldBoxId
    });
  });

  const appointmentStats = {
    total: appointments.length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length
  };

  const exceptionStats = {
    total: exceptions.length,
    open: exceptions.filter(e => e.status === 'open').length,
    resolved: exceptions.filter(e => e.status === 'resolved').length,
    disposedBatches: inventory.filter(inv => inv.status === 'disposed').length
  };

  return {
    generatedAt: new Date().toISOString(),
    vaccineInventory: Object.values(vaccineStats),
    appointments: appointmentStats,
    exceptions: exceptionStats,
    summary: {
      totalInventoryDoses: inventory.reduce((sum, inv) => sum + inv.totalDoses + inv.lockedDoses + inv.frozenDoses, 0),
      totalAvailableDoses: inventory.reduce((sum, inv) => sum + inv.availableDoses, 0),
      totalLockedDoses: inventory.reduce((sum, inv) => sum + inv.lockedDoses, 0),
      totalFrozenDoses: inventory.reduce((sum, inv) => sum + inv.frozenDoses, 0),
      totalUsedDoses: appointments.filter(a => a.status === 'completed').length
    }
  };
}

function getBatchReport(batchNo) {
  const inventory = store.getAllInventory().find(inv => inv.batchNo === batchNo);
  if (!inventory) {
    throw new AppError('批次不存在', 404);
  }

  const vaccine = store.getVaccineById(inventory.vaccineId);
  const coldBox = store.getColdBoxById(inventory.coldBoxId);
  const appointments = store.getAppointmentsByInventoryId(inventory.id);
  const exceptions = store.getExceptionsByInventoryId(inventory.id);

  return {
    generatedAt: new Date().toISOString(),
    batch: {
      batchNo: inventory.batchNo,
      vaccine: vaccine ? vaccine.name : 'Unknown',
      coldBox: coldBox ? coldBox.name : 'Unknown',
      status: inventory.status,
      totalDoses: inventory.totalDoses,
      availableDoses: inventory.availableDoses,
      lockedDoses: inventory.lockedDoses,
      frozenDoses: inventory.frozenDoses
    },
    appointments: {
      total: appointments.length,
      scheduled: appointments.filter(a => a.status === 'scheduled').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      list: appointments
    },
    exceptions: exceptions
  };
}

function getSystemOverview() {
  const report = getDoseReport();
  const coldChain = require('./coldChainService').getColdChainStatus();

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalVaccines: store.store.vaccines.length,
      totalBatches: store.store.inventory.length,
      totalAppointments: report.appointments.total,
      activeExceptions: coldChain.openExceptions.length
    },
    coldChain: coldChain,
    doseReport: report
  };
}

module.exports = {
  getDoseReport,
  getBatchReport,
  getSystemOverview
};
