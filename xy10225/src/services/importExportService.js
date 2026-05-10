const fs = require('fs-extra');
const path = require('path');
const csvParser = require('csv-parser');
const { loadStore, saveStore } = require('../storage/dataStore');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const parseJSON = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
};

const importFromFile = async (filePath, type) => {
  const ext = path.extname(filePath).toLowerCase();
  let data;

  try {
    if (ext === '.csv') {
      data = await parseCSV(filePath);
    } else if (ext === '.json') {
      data = parseJSON(filePath);
      if (!Array.isArray(data)) {
        throw new Error('JSON 文件必须是数组格式');
      }
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }

    return {
      success: true,
      data: data,
      format: ext.substring(1)
    };
  } catch (error) {
    return {
      success: false,
      errors: [error.message]
    };
  }
};

const exportToCSV = (data, filePath, columns) => {
  if (!data || data.length === 0) {
    return { success: false, errors: ['没有数据可导出'] };
  }

  const headers = columns || Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  data.forEach(item => {
    const row = headers.map(header => {
      let value = item[header];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(row.join(','));
  });

  fs.writeFileSync(filePath, csvRows.join('\n'), 'utf-8');
  return { success: true, filePath, rowCount: data.length };
};

const exportToJSON = (data, filePath) => {
  if (!data) {
    return { success: false, errors: ['没有数据可导出'] };
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { success: true, filePath, itemCount: Array.isArray(data) ? data.length : 1 };
};

const exportExceptions = (options = {}) => {
  const store = loadStore();
  let exceptions = [...store.exceptions];

  if (options.status) {
    exceptions = exceptions.filter(e => e.status === options.status);
  }

  if (options.type) {
    exceptions = exceptions.filter(e => e.type === options.type);
  }

  const exportData = exceptions.map(e => {
    const delivery = store.deliveries.find(d => d.id === e.deliveryId);
    const volunteer = store.volunteers.find(v => v.id === e.relatedVolunteerId);
    
    return {
      exceptionId: e.id,
      exceptionType: e.type,
      exceptionStatus: e.status,
      description: e.description,
      deliveryId: e.deliveryId,
      householdName: delivery ? delivery.householdName : '未知',
      volunteerId: e.relatedVolunteerId,
      volunteerName: volunteer ? volunteer.name : '未知',
      itemName: e.itemName || '',
      expectedQuantity: e.expectedQuantity || '',
      receivedQuantity: e.receivedQuantity || '',
      createdAt: e.createdAt,
      resolvedBy: e.resolvedBy || '',
      resolvedAt: e.resolvedAt || '',
      resolutionNotes: e.resolutionNotes || ''
    };
  });

  return exportData;
};

const exportVerificationReport = () => {
  const store = loadStore();
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalHouseholds: store.households.length,
      totalVolunteers: store.volunteers.length,
      totalDonations: store.donations.length,
      totalDeliveries: store.deliveries.length,
      completedDeliveries: store.deliveries.filter(d => d.status === 'completed').length,
      pendingDeliveries: store.deliveries.filter(d => d.status === 'pending_verification').length,
      verifyingDeliveries: store.deliveries.filter(d => d.status === 'verifying').length,
      exceptionDeliveries: store.deliveries.filter(d => d.status === 'exception').length,
      needsReviewDeliveries: store.deliveries.filter(d => d.status === 'needs_review').length,
      totalExceptions: store.exceptions.length,
      openExceptions: store.exceptions.filter(e => e.status === 'open').length,
      resolvedExceptions: store.exceptions.filter(e => e.status === 'resolved').length
    },
    details: {
      volunteers: store.volunteers.map(v => {
        const deliveries = store.deliveries.filter(d => d.volunteerId === v.id);
        const exceptions = store.exceptions.filter(e => e.relatedVolunteerId === v.id);
        return {
          volunteerId: v.id,
          volunteerName: v.name,
          organization: v.organization,
          totalDeliveries: deliveries.length,
          completedDeliveries: deliveries.filter(d => d.status === 'completed').length,
          exceptionCount: exceptions.length,
          openExceptionCount: exceptions.filter(e => e.status === 'open').length
        };
      }),
      deliveries: store.deliveries.map(d => {
        const household = store.households.find(h => h.id === d.householdId);
        const volunteer = store.volunteers.find(v => v.id === d.volunteerId);
        const signature = store.signatures.find(s => s.id === d.signatureId);
        const exceptions = store.exceptions.filter(e => e.deliveryId === d.id);
        
        return {
          deliveryId: d.id,
          householdName: household ? household.name : '未知',
          volunteerName: volunteer ? volunteer.name : '未知',
          deliveryDate: d.deliveryDate,
          status: d.status,
          items: d.items,
          signatureType: signature ? signature.signatureType : 'none',
          hasPhotoEvidence: signature ? !!signature.photoEvidence : false,
          exceptionCount: exceptions.length,
          exceptionIds: d.exceptionIds
        };
      }),
      exceptions: store.exceptions.map(e => {
        const delivery = store.deliveries.find(d => d.id === e.deliveryId);
        const volunteer = store.volunteers.find(v => v.id === e.relatedVolunteerId);
        
        return {
          exceptionId: e.id,
          type: e.type,
          status: e.status,
          description: e.description,
          deliveryId: e.deliveryId,
          householdName: delivery ? delivery.householdName : '未知',
          volunteerName: volunteer ? volunteer.name : '未知',
          itemName: e.itemName,
          expectedQuantity: e.expectedQuantity,
          receivedQuantity: e.receivedQuantity,
          createdAt: e.createdAt
        };
      })
    }
  };

  return report;
};

module.exports = {
  parseCSV,
  parseJSON,
  importFromFile,
  exportToCSV,
  exportToJSON,
  exportExceptions,
  exportVerificationReport
};
