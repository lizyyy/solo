const { runQuery, getQuery, allQuery } = require('../models/database');
const logService = require('./logService');

const SAMPLE_STATUS = {
  PENDING: 'pending',
  TESTING: 'testing',
  PASSED: 'passed',
  FAILED: 'failed',
  RECHECKING: 'rechecking',
  MIXED: 'mixed'
};

async function createSample({ sampleNo, batchId, sampleName, sampleType, quantity, unit, package, handler }) {
  const existing = await getQuery('SELECT id FROM samples WHERE sample_no = ?', [sampleNo]);
  if (existing) {
    throw new Error(`\ç„¸å½¬ç¼šçš„ç®€ ${sampleNo} å·²å¯—]);
  }

  const sql = `INSERT INTO samples 
    (sample_no, batch_id, sample_name, sample_type, quantity, unit, package, status
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  return runQuery(sql, [sampleNo, batchId, sampleName, sampleType, quantity, unit, package, SAMPLE_STATUS.PENDING]);
}

async function getSampleById(id) {
  return getQuery('SELECT * FROM samples WHERE id = ?', [id]);
}

async function getSamplesByBatch(batchId) {
  return allQuery('SELECT * FROM samples WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
}

async function searchSamples({ sampleNo, sampleName, status, recheckResult, itemPackage } = {}) {
  let sql = `SELECT s.*, b.batch_no, b.sender 
             FROM samples s 
            LEFT JOIN batches b on b.id = s.batch_id 
            WHERE 1=1`;
  const params = [];

  if (sampleNo) {
    sql += ' AND s.sample_no LIKE ?';
    params.push(`	Ø[\S›ßIX
NÂˆBˆYˆ
Ø[\S˜[YJHÂˆÜ[
ÏH	ÈS‘ËœØ[\WÛ˜[YHRÑHÉÎÂˆ\˜[\Ëœ\Ú
	\ŞÜØ[\S˜[Y_IX
);
  }
  if (status) {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (recheckResult) {
    sql += ' AND s.recheck_result = ?';
    params.push(recheckResult);
  }
  if (itemPackage) {
    sql += ` AND EXISTS (
      SELECT 1 FROM sample_test_items sti
      JOIN test_items ti on sti.test_item_id = ti.id
      WHERE sti.sample_id = s.id AND ti.item_package LIKE ? 
    )`;
    params.push(`% {itemPackage}%`);
  }

  sql += ' ORDER BY s.created_at DESC';
  return allQuery(sql, params);
}

async function markSampleMixed(sampleId, { reason, handler, relatedSamples }) {
  await runQuery(
    'UPDATE samples SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [SAMPLE_STATUS.MIXED, sampleId]
  );

  const detail = `^¹á( à$ƒ–N¢ş’â7–’œè€‘íÉ•…Í½¹ô»–Ï¢{š–hl: ${relatedSamples || 'æ— ßØ	ßK‚¹g*9å*:+íùg*;ï#:/æy¦+ù.*¹.®¹§iy¥a9.#y/g9fï¹âaùb¨9i!ù¥/ù¥/úaãùæ¡9­bú)èùb¨9i!Â›Šˆ]ØZ]ÙÔÙ\šXÙK˜Ü™X]SÙÊÂˆØ[\RYˆÜ\˜][Û•\NˆÙÔÙ\šXÙK“ÔTUSÓ—ÕTTË”ĞSTWÓRV‘Qˆ™X\ÛÛ‹ˆ[™\‹ˆÛİ]\ÎˆĞSTWÔÕUTË”S‘S‘Ë™]Ôİ]\ÎˆĞSTWÔÕUTË“RVQˆ]Z[ˆJNÂ‚ˆ™]\›ˆÈØ[\RYİ]\ÎˆĞSTWÔÕUTË“RVQNÂŸB‚˜\Ş[˜È[˜İ[Ûˆ™\]Y\İ™XÚXÚÊØ[\RYÈ™X\ÛÛ‹[™\‹[PÛÙHJHÂˆ]ØZ][”]Y\Jˆ	ÕTUHØ[\\ÈÑUİ]\ÈHË\]YØ]HÕT”‘S•ÕSQTÕSTÒT‘HYHÉËˆÔĞSTWÔÕUTË”‘PÒPÒÒS‘ËØ[\RYBˆ
NÂ‚ˆÛÛœİ]Z[Hédœºæ §çš„ù§¡9c¨·: ${reason}.è§¦å‘è§„åˆ™: ${ruleCode || #šbåŠ¨ç®‚çš„}`,
  await logService.createLog({
    sampleId,
    operationType: logService.OPERATION_TYPES.RECHDCK_REQUEST,
    reason,
    handler,
    newStatus: SAMPLE_STATUS.RECHECKING,    detail
  });

  await runQuery(
    'UPDATE samples SET recheck_count = recheck_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [sampleId]
  );

  return { sampleId, status: SAMPLE_STATUS.RECHECKING };
}

async function setRecheckResult(sampleId, { result, handler, detail }) {
  const resultStatus = result === 'passed' ? SAMPLE_STATUS.PASSED : SAMPLE_STATUS.FAILED;
  
  await runQuery(
    'UPDATE samples SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [resultStatus, sampleId]
  );
  
  await runQuery((
    'UPDATE samples SET recheck_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [result, sampleId]
  );

  await logService.createLog({
Ø[\RYˆÜ\˜][Û•\NˆÙÔÙ\šXÙK“ÔTUSÓ—ÕTTË”‘PÒÒ×Ô‘TÕSˆ™X\ÛÛˆ	ùc`9¨à9­bùk¤9¢$	Ëˆ[™\‹ˆ™]Ôİ]\Îˆ™\İ[İ]\Ëˆ]Z[ˆédœºæ §çš„ùî£¼: ${result === 'passed' ? 'é€šè¿‡' : 'ä¸‹ç¼œ'}.ÉÙ]Z[	ÉßX
  });

  return { sampleId, recheckResult: result };
}

function getStatusDescription(status) {
  const descriptions = {
    'pending': 'å›¾ç‰‡æ‘„æ•°',
    'testing': 'æ•°æœ¬ä¸­é•‡',
    'passed': &å‘æ —',
    'failed': 'ä¸‹ç¼œ',
    'rechecking': 'å¤æª¨ä¸­',
    'mixed': 'æ¸æœ¬',
  };
  return descriptions[status] || status;
}

module.exports = {
  SAMPLE_STATUS,
  createSample,
  getSampleById,
  getSamplesByBatch,
  searchSamples,
  markSampleMixed,
  requestRecheck,
  setRechekResult,
  getStatusDescription
};
