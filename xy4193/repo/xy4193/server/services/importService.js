const csv = require('csv-parser');
const fs = require('fs');
const Donor = require('../models/donor');
const BloodBag = require('../models/bloodBag');
const SampleTube = require('../models/sampleTube');
const { logAudit } = require('../middleware/auditMiddleware');

const importService = {
  importDonorsFromCSV: async (filePath, operator) => {
    const results = [];
    const errors = [];
    let successCount = 0;
    let failCount = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (data) => {
          try {
            if (!data.donor_code) {
              errors.push({ row: data, error: '缺少献血者条码' });
              failCount++;
              return;
            }

            const existingDonor = await Donor.findByCode(data.donor_code);
            if (existingDonor) {
              errors.push({ row: data, error: `献血者条码 ${data.donor_code} 已存在` });
              failCount++;
              return;
            }

            const donor = await Donor.create({
              donor_code: data.donor_code,
              name: data.name || null,
              id_card: data.id_card || null,
              blood_type: data.blood_type || null
            });

            await logAudit('CREATE', 'donors', donor.id, operator, null, donor, '从CSV导入');
            
            results.push(donor);
            successCount++;
          } catch (err) {
            errors.push({ row: data, error: err.message });
            failCount++;
          }
        })
        .on('end', () => {
          resolve({
            success: true,
            total: successCount + failCount,
            successCount,
            failCount,
            imported: results,
            errors
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  },

  importBloodBagsFromCSV: async (filePath, operator) => {
    const results = [];
    const errors = [];
    let successCount = 0;
    let failCount = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (data) => {
          try {
            if (!data.bag_code) {
              errors.push({ row: data, error: '缺少血袋编号' });
              failCount++;
              return;
            }

            const existingBag = await BloodBag.findByCode(data.bag_code);
            if (existingBag) {
              errors.push({ row: data, error: `血袋编号 ${data.bag_code} 已存在` });
              failCount++;
              return;
            }

            let donorId = null;
            if (data.donor_code) {
              const donor = await Donor.findByCode(data.donor_code);
              if (donor) {
                donorId = donor.id;
              } else {
                errors.push({ row: data, error: `献血者条码 ${data.donor_code} 不存在` });
                failCount++;
                return;
              }
            }

            const bag = await BloodBag.create({
              bag_code: data.bag_code,
              donor_id: donorId,
              volume: data.volume ? parseInt(data.volume) : 400,
              blood_type: data.blood_type || null,
              collection_time: data.collection_time || new Date().toISOString()
            });

            await logAudit('CREATE', 'blood_bags', bag.id, operator, null, bag, '从CSV导入');
            
            results.push(bag);
            successCount++;
          } catch (err) {
            errors.push({ row: data, error: err.message });
            failCount++;
          }
        })
        .on('end', () => {
          resolve({
            success: true,
            total: successCount + failCount,
            successCount,
            failCount,
            imported: results,
            errors
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  },

  importSampleTubesFromCSV: async (filePath, operator) => {
    const results = [];
    const errors = [];
    let successCount = 0;
    let failCount = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (data) => {
          try {
            if (!data.tube_code) {
              errors.push({ row: data, error: '缺少样本管编号' });
              failCount++;
              return;
            }

            const existingTube = await SampleTube.findByCode(data.tube_code);
            if (existingTube) {
              errors.push({ row: data, error: `样本管编号 ${data.tube_code} 已存在` });
              failCount++;
              return;
            }

            let donorId = null;
            if (data.donor_code) {
              const donor = await Donor.findByCode(data.donor_code);
              if (donor) {
                donorId = donor.id;
              } else {
                errors.push({ row: data, error: `献血者条码 ${data.donor_code} 不存在` });
                failCount++;
                return;
              }
            }

            const tube = await SampleTube.create({
              tube_code: data.tube_code,
              donor_id: donorId,
              tube_type: data.tube_type || 'standard'
            });

            await logAudit('CREATE', 'sample_tubes', tube.id, operator, null, tube, '从CSV导入');
            
            results.push(tube);
            successCount++;
          } catch (err) {
            errors.push({ row: data, error: err.message });
            failCount++;
          }
        })
        .on('end', () => {
          resolve({
            success: true,
            total: successCount + failCount,
            successCount,
            failCount,
            imported: results,
            errors
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  },

  validateCSVFormat: (filePath, expectedHeaders) => {
    return new Promise((resolve, reject) => {
      const headers = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headerList.forEach(h => headers.push(h));
        })
        .on('data', () => {})
        .on('end', () => {
          const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
          resolve({
            valid: missingHeaders.length === 0,
            headers,
            missingHeaders,
            message: missingHeaders.length === 0 ? 'CSV格式有效' : `缺少必需列: ${missingHeaders.join(', ')}`
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }
};

module.exports = importService;
