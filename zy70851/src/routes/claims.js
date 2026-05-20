const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db');

const router = express.Router();

router.post('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { claims } = req.body;

    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    if (!Array.isArray(claims) || claims.length === 0) {
      return res.status(400).json({ error: '理赔材料不能为空' });
    }

    const results = [];
    const errors = [];

    for (const claim of claims) {
      try {
        const claimId = uuidv4();
        const claimNo = claim.claim_no || `CLAIM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        await run(
          `INSERT INTO claim_materials 
           (id, batch_id, claim_no, policy_no, insured_name, insured_id_card, 
            accident_date, claim_amount, hospital, diagnosis, materials, raw_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            claimId,
            batchId,
            claimNo,
            claim.policy_no,
            claim.insured_name,
            claim.insured_id_card,
            claim.accident_date,
            claim.claim_amount,
            claim.hospital || '',
            claim.diagnosis || '',
            JSON.stringify(claim.materials || []),
            JSON.stringify(claim)
          ]
        );

        results.push({
          id: claimId,
          claim_no: claimNo,
          insured_name: claim.insured_name
        });
      } catch (err) {
        errors.push({
          claim_no: claim.claim_no,
          error: err.message
        });
      }
    }

    await run(
      'UPDATE batches SET total_count = total_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [results.length, batchId]
    );

    res.json({
      success: true,
      imported: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const claims = await all('SELECT * FROM claim_materials WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);

    const claimsWithResults = await Promise.all(
      claims.map(async (claim) => {
        const result = await get('SELECT * FROM precheck_results WHERE claim_id = ?', [claim.id]);
        return {
          ...claim,
          materials: JSON.parse(claim.materials || '[]'),
          raw_data: JSON.parse(claim.raw_data || '{}'),
          precheck_result: result || null
        };
      })
    );

    res.json(claimsWithResults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await get('SELECT * FROM claim_materials WHERE id = ?', [claimId]);
    if (!claim) {
      return res.status(404).json({ error: '理赔材料不存在' });
    }

    const result = await get('SELECT * FROM precheck_results WHERE claim_id = ?', [claimId]);

    res.json({
      ...claim,
      materials: JSON.parse(claim.materials || '[]'),
      raw_data: JSON.parse(claim.raw_data || '{}'),
      precheck_result: result ? {
        ...result,
        policy_responsibility: JSON.parse(result.policy_responsibility || '{}'),
        material_gaps: JSON.parse(result.material_gaps || '[]'),
        duplicate_claim: JSON.parse(result.duplicate_claim || '{}'),
        reasons: JSON.parse(result.reasons || '[]'),
        next_actions: JSON.parse(result.next_actions || '[]')
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
