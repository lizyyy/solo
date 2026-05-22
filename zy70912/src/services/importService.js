const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../models/database');
const { applyBusinessRules } = require('./businessRuleService');

async function importClaimCSV(filePath, batchId) {
  const results = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const claims = [];
          for (const row of results) {
            const claimId = uuidv4();
            const claimData = {
              id: claimId,
              batch_id: batchId,
              baggage_tag_no: row['行李牌号'] || row['baggage_tag_no'] || row['tag_no'] || '',
              passenger_name: row['旅客姓名'] || row['passenger_name'] || '',
              passenger_phone: row['联系电话'] || row['phone'] || '',
              flight_no: row['航班号'] || row['flight_no'] || '',
              flight_date: row['航班日期'] || row['flight_date'] || null,
              route: row['航线'] || row['route'] || '',
              claim_type: row['申诉类型'] || row['claim_type'] || '',
              claim_amount: parseFloat(row['申诉金额'] || row['claim_amount'] || 0),
              photos: row['照片'] || row['photos'] || '',
              remark: row['备注'] || row['remark'] || ''
            };

            const finalData = await applyBusinessRules(claimData);
            await insertClaim(finalData);
            claims.push(finalData);
          }
          
          await updateBatchCount(batchId, results.length);
          resolve(claims);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function importFlightJSON(flightData, batchId) {
  const flights = Array.isArray(flightData) ? flightData : [flightData];
  
  for (const flight of flights) {
    const claim = await getQuery(
      'SELECT id FROM claims WHERE batch_id = ? AND baggage_tag_no = ? LIMIT 1',
      [batchId, flight.baggage_tag_no || flight.tag_no]
    );
    
    if (claim) {
      const segments = flight.segments || [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        await runQuery(
          `INSERT INTO flight_data (claim_id, flight_no, departure, arrival, 
           departure_time, arrival_time, segment_order, is_responsible)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [claim.id, seg.flight_no, seg.departure, seg.arrival,
           seg.departure_time, seg.arrival_time, i + 1, seg.is_responsible || 0]
        );
      }
      
      if (flight.responsible_segment) {
        await runQuery(
          'UPDATE claims SET responsible_segment = ? WHERE id = ?',
          [flight.responsible_segment, claim.id]
        );
      }
    }
  }
}

async function importPhotoIndex(photoData, batchId) {
  const photos = Array.isArray(photoData) ? photoData : [photoData];
  
  for (const photo of photos) {
    const claim = await getQuery(
      'SELECT id FROM claims WHERE batch_id = ? AND baggage_tag_no = ? LIMIT 1',
      [batchId, photo.baggage_tag_no || photo.tag_no]
    );
    
    if (claim) {
      await runQuery(
        'INSERT INTO photo_index (claim_id, photo_path, photo_type) VALUES (?, ?, ?)',
        [claim.id, photo.path, photo.type || 'evidence']
      );
    }
  }
}

async function insertClaim(claimData) {
  const sql = `INSERT INTO claims 
    (id, batch_id, baggage_tag_no, passenger_name, passenger_phone, flight_no, 
     flight_date, route, claim_type, claim_amount, compensation_level, 
     responsible_segment, is_overdue, needs_manual_review, review_reason, 
     status, photos, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  return runQuery(sql, [
    claimData.id, claimData.batch_id, claimData.baggage_tag_no,
    claimData.passenger_name, claimData.passenger_phone, claimData.flight_no,
    claimData.flight_date, claimData.route, claimData.claim_type,
    claimData.claim_amount, claimData.compensation_level,
    claimData.responsible_segment, claimData.is_overdue ? 1 : 0,
    claimData.needs_manual_review ? 1 : 0, claimData.review_reason,
    claimData.status || 'pending', claimData.photos, claimData.remark
  ]);
}

async function updateBatchCount(batchId, count) {
  await runQuery(
    'UPDATE batches SET total_claims = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [count, batchId]
  );
}

async function createBatch(batchNo, name, createdBy) {
  const batchId = uuidv4();
  await runQuery(
    'INSERT INTO batches (id, batch_no, name, created_by) VALUES (?, ?, ?, ?)',
    [batchId, batchNo, name, createdBy]
  );
  return batchId;
}

module.exports = {
  importClaimCSV,
  importFlightJSON,
  importPhotoIndex,
  createBatch,
  insertClaim
};
