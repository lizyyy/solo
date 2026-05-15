const { allQuery } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

function generateMarkdown(data, title = '导出报告') {
  let markdown = `# ${title}\n\n`;
  markdown += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0]);
    
    markdown += '| ' + headers.join(' | ') + ' |\n';
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    for (const row of data) {
      const values = headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val).replace(/\|/g, '\\|');
      });
      markdown += '| ' + values.join(' | ') + ' |\n';
    }
  }
  
  markdown += `\n共 ${Array.isArray(data) ? data.length : 0} 条记录`;
  return markdown;
}

async function exportExceptionSamples(req, res) {
  try {
    const { format = 'json', type = 'all' } = req.query;
    
    let sql = `
      SELECT 
        'renewal' as record_type,
        rt.id,
        m.name as subject_name,
        rt.status,
        rt.remark,
        rt.boundary_input,
        rt.processed_result,
        rt.created_at
      FROM renewal_transactions rt
      LEFT JOIN members m ON rt.member_id = m.id
      WHERE 1=1
        AND (rt.processed_result LIKE '%reviewRequired%true%'
             OR (rt.status = 'rolled_back' AND rt.rollback_evidence IS NULL))
    `;
    
    if (type === 'renewal') {
    } else if (type === 'sample') {
      sql = `
        SELECT 
          'sample' as record_type,
          ls.id,
          m.name as subject_name,
          ls.status,
          ls.manual_remark as remark,
          null as boundary_input,
          null as processed_result,
          ls.created_at
        FROM lab_samples ls
        LEFT JOIN members m ON ls.member_id = m.id
        WHERE ls.manual_remark IS NOT NULL
      `;
    } else {
      sql += `
        UNION ALL
        SELECT 
          'sample' as record_type,
          ls.id,
          m.name as subject_name,
          ls.status,
          ls.manual_remark as remark,
          null as boundary_input,
          null as processed_result,
          ls.created_at
        FROM lab_samples ls
        LEFT JOIN members m ON ls.member_id = m.id
        WHERE ls.manual_remark IS NOT NULL
      `;
    }
    
    const samples = await allQuery(sql);
    
    const parsedSamples = samples.map(s => ({
      ...s,
      boundary_input: s.boundary_input ? JSON.parse(s.boundary_input) : null,
      processed_result: s.processed_result ? JSON.parse(s.processed_result) : null
    }));
    
    if (format === 'markdown') {
      const markdown = generateMarkdown(parsedSamples, '异常样本复核报告');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=exception-samples.md');
      res.send(markdown);
    } else if (format === 'csv') {
      const { Parser } = require('json2csv');
      const parser = new Parser({ withBOM: true });
      const csv = parser.parse(parsedSamples);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=exception-samples.csv');
      res.send(csv);
    } else {
      res.json(successResponse({
        records: parsedSamples,
        totalCount: parsedSamples.length,
        exportFormat: format
      }, '异常样本导出成功'));
    }
  } catch (error) {
    res.status(500).json(errorResponse('导出异常样本失败', error.message));
  }
}

async function exportBatchOperationDetails(req, res) {
  try {
    const { batch_id, format = 'json' } = req.query;
    
    let sql = `
      SELECT 
        bo.id,
        bo.operation_name,
        bo.operation_type,
        bo.total_count,
        bo.success_count,
        bo.failed_count,
        bo.status,
        bo.operator_name,
        bo.created_at,
        bo.completed_at,
        bo.item_details
      FROM batch_operations bo
    `;
    const params = [];
    
    if (batch_id) {
      sql += ' WHERE bo.id = ?';
      params.push(batch_id);
    }
    
    sql += ' ORDER BY bo.created_at DESC';
    
    const operations = await allQuery(sql, params);
    
    const parsedOperations = operations.map(o => ({
      ...o,
      item_details: o.item_details ? JSON.parse(o.item_details) : null,
      candidate_list: o.candidate_list ? JSON.parse(o.candidate_list) : null
    }));
    
    if (format === 'markdown') {
      const markdown = generateMarkdown(parsedOperations, '批量操作明细报告');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=batch-operations.md');
      res.send(markdown);
    } else {
      res.json(successResponse(parsedOperations, '批量操作明细导出成功'));
    }
  } catch (error) {
    res.status(500).json(errorResponse('导出批量操作明细失败', error.message));
  }
}

async function getReviewStatistics(req, res) {
  try {
    const [rollbackNoEvidence, boundaryRecords, manualRemarkSamples] = await Promise.all([
      allQuery(`
        SELECT COUNT(*) as count FROM renewal_transactions 
        WHERE status = 'rolled_back' AND rollback_evidence IS NULL
      `),
      allQuery(`
        SELECT COUNT(*) as count FROM renewal_transactions 
        WHERE boundary_input IS NOT NULL
      `),
      allQuery(`
        SELECT COUNT(*) as count FROM lab_samples 
        WHERE manual_remark IS NOT NULL
      `)
    ]);
    
    res.json(successResponse({
      rollbackNoEvidenceCount: rollbackNoEvidence[0].count,
      boundaryInputCount: boundaryRecords[0].count,
      manualRemarkCount: manualRemarkSamples[0].count,
      reviewRequiredTotal: rollbackNoEvidence[0].count + boundaryRecords[0].count
    }, '复核统计获取成功'));
  } catch (error) {
    res.status(500).json(errorResponse('获取复核统计失败', error.message));
  }
}

module.exports = {
  exportExceptionSamples,
  exportBatchOperationDetails,
  getReviewStatistics,
  generateMarkdown
};