const moment = require('moment');
const db = require('../database/database');

async function generateMarkdownHandover(artworkId) {
  const artwork = await db.get(`
    SELECT 
      id,
      order_number,
      client_name,
      artwork_name,
      type,
      description,
      start_date,
      expected_completion_date,
      status
    FROM artworks
    WHERE id = ?
  `, [artworkId]);

  if (!artwork) {
    throw new Error('作品不存在');
  }

  const layers = await db.all(`
    SELECT 
      id,
      layer_number,
      lacquer_type,
      thickness,
      color,
      notes,
      status
    FROM layers
    WHERE artwork_id = ?
    ORDER BY layer_number
  `, [artworkId]);

  const layerDetails = [];
  for (const layer of layers) {
    const processes = await db.all(`
      SELECT 
        process_type,
        start_time,
        end_time,
        duration_hours,
        status,
        operator_name,
        notes
      FROM processes
      WHERE layer_id = ?
      ORDER BY start_time
    `, [layer.id]);

    const reviews = await db.all(`
      SELECT 
        reviewer_name,
        review_date,
        signature,
        status,
        comments
      FROM reviews
      WHERE layer_id = ?
      ORDER BY review_date
    `, [layer.id]);

    layerDetails.push({
      ...layer,
      processes,
      reviews
    });
  }

  const handoverNotes = await db.all(`
    SELECT 
      from_apprentice,
      to_apprentice,
      handover_date,
      notes,
      layer_number,
      next_process,
      status
    FROM handover_notes
    WHERE artwork_id = ?
    ORDER BY handover_date
  `, [artworkId]);

  const violations = await db.all(`
    SELECT 
      type,
      severity,
      description,
      detected_at,
      resolved,
      resolution_notes
    FROM violations
    WHERE artwork_id = ?
    ORDER BY detected_at DESC
  `, [artworkId]);

  let markdown = `# 漆器作品交接单\n\n`;
  markdown += `> 生成时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
  
  markdown += `## 作品基本信息\n\n`;
  markdown += `| 项目 | 内容 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 订单号 | ${artwork.order_number || '-'} |\n`;
  markdown += `| 作品名称 | ${artwork.artwork_name || '-'} |\n`;
  markdown += `| 客户名称 | ${artwork.client_name || '-'} |\n`;
  markdown += `| 类型 | ${artwork.type || '-'} |\n`;
  markdown += `| 开始日期 | ${artwork.start_date || '-'} |\n`;
  markdown += `| 预计完成日期 | ${artwork.expected_completion_date || '-'} |\n`;
  markdown += `| 当前状态 | ${artwork.status || '-'} |\n`;
  if (artwork.description) {
    markdown += `| 描述 | ${artwork.description} |\n`;
  }
  markdown += `\n`;

  markdown += `## 漆层详情\n\n`;
  for (const layer of layerDetails) {
    markdown += `### 第 ${layer.layer_number} 层\n\n`;
    markdown += `| 项目 | 内容 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 漆型 | ${layer.lacquer_type || '-'} |\n`;
    markdown += `| 厚度 | ${layer.thickness || '-'} |\n`;
    markdown += `| 颜色 | ${layer.color || '-'} |\n`;
    markdown += `| 状态 | ${layer.status || '-'} |\n`;
    if (layer.notes) {
      markdown += `| 备注 | ${layer.notes} |\n`;
    }
    markdown += `\n`;

    if (layer.processes.length > 0) {
      markdown += `#### 工序记录\n\n`;
      markdown += `| 工序 | 开始时间 | 结束时间 | 时长(小时) | 状态 | 操作人 | 备注 |\n`;
      markdown += `|------|----------|----------|------------|------|--------|------|\n`;
      for (const process of layer.processes) {
        markdown += `| ${process.process_type || '-'} | ${process.start_time || '-'} | ${process.end_time || '-'} | ${process.duration_hours || '-'} | ${process.status || '-'} | ${process.operator_name || '-'} | ${process.notes || '-'} |\n`;
      }
      markdown += `\n`;
    }

    if (layer.reviews.length > 0) {
      markdown += `#### 复核记录\n\n`;
      for (const review of layer.reviews) {
        markdown += `- **复核人**: ${review.reviewer_name || '-'}\n`;
        markdown += `  - **复核日期**: ${review.review_date || '-'}\n`;
        markdown += `  - **状态**: ${review.status || '-'}\n`;
        markdown += `  - **签名**: ${review.signature ? '✓ 已签名' : '✗ 未签名'}\n`;
        if (review.comments) {
          markdown += `  - **意见**: ${review.comments}\n`;
        }
        markdown += `\n`;
      }
    }
  }

  if (handoverNotes.length > 0) {
    markdown += `## 交接记录\n\n`;
    for (const note of handoverNotes) {
      markdown += `### 交接记录 - ${note.handover_date || '-'}\n\n`;
      markdown += `- **交接人**: ${note.from_apprentice || '-'}\n`;
      markdown += `- **接收人**: ${note.to_apprentice || '-'}\n`;
      if (note.layer_number) {
        markdown += `- **当前层数**: 第 ${note.layer_number} 层\n`;
      }
      if (note.next_process) {
        markdown += `- **下一工序**: ${note.next_process}\n`;
      }
      if (note.notes) {
        markdown += `- **备注**: ${note.notes}\n`;
      }
      markdown += `\n`;
    }
  }

  if (violations.length > 0) {
    markdown += `## 违规/问题记录\n\n`;
    const unresolved = violations.filter(v => !v.resolved);
    const resolved = violations.filter(v => v.resolved);

    if (unresolved.length > 0) {
      markdown += `### 待解决问题 (${unresolved.length})\n\n`;
      for (const v of unresolved) {
        const severityIcon = v.severity === 'critical' ? '🔴' : '🟡';
        markdown += `${severityIcon} **[${v.type}]** ${v.description}\n`;
        markdown += `   - 检测时间: ${v.detected_at}\n\n`;
      }
    }

    if (resolved.length > 0) {
      markdown += `### 已解决问题 (${resolved.length})\n\n`;
      for (const v of resolved) {
        markdown += `✅ **[${v.type}]** ${v.description}\n`;
        if (v.resolution_notes) {
          markdown += `   - 解决说明: ${v.resolution_notes}\n`;
        }
        markdown += `\n`;
      }
    }
  }

  markdown += `\n---\n\n`;
  markdown += `> 本文档由湿房管理系统自动生成\n`;

  return markdown;
}

async function generateAuditPackage(artworkId = null) {
  const result = {
    generated_at: moment().toISOString(),
    version: '1.0',
    artworks: [],
    statistics: {}
  };

  let artworks;
  if (artworkId) {
    artworks = await db.all(`
      SELECT * FROM artworks WHERE id = ?
    `, [artworkId]);
  } else {
    artworks = await db.all(`SELECT * FROM artworks ORDER BY created_at`);
  }

  for (const artwork of artworks) {
    const layers = await db.all(`
      SELECT * FROM layers WHERE artwork_id = ? ORDER BY layer_number
    `, [artwork.id]);

    const layersWithDetails = [];
    for (const layer of layers) {
      const processes = await db.all(`
        SELECT * FROM processes WHERE layer_id = ? ORDER BY start_time
      `, [layer.id]);

      const reviews = await db.all(`
        SELECT * FROM reviews WHERE layer_id = ? ORDER BY review_date
      `, [layer.id]);

      layersWithDetails.push({
        ...layer,
        processes,
        reviews
      });
    }

    const handoverNotes = await db.all(`
      SELECT * FROM handover_notes WHERE artwork_id = ? ORDER BY handover_date
    `, [artwork.id]);

    const violations = await db.all(`
      SELECT * FROM violations WHERE artwork_id = ? ORDER BY detected_at
    `, [artwork.id]);

    result.artworks.push({
      ...artwork,
      layers: layersWithDetails,
      handover_notes: handoverNotes,
      violations: violations
    });
  }

  const wetroomReadings = await db.all(`
    SELECT * FROM wetroom_readings ORDER BY cabinet_id, reading_time
  `);
  result.wetroom_readings = wetroomReadings;

  const allViolations = await db.all(`
    SELECT * FROM violations ORDER BY detected_at DESC
  `);
  result.all_violations = allViolations;

  result.statistics = {
    total_artworks: artworks.length,
    total_layers: result.artworks.reduce((sum, a) => sum + (a.layers?.length || 0), 0),
    total_violations: allViolations.length,
    unresolved_violations: allViolations.filter(v => !v.resolved).length,
    critical_violations: allViolations.filter(v => v.severity === 'critical' && !v.resolved).length
  };

  return result;
}

async function generateAllHandoverNotes() {
  const artworks = await db.all(`SELECT id FROM artworks ORDER BY order_number`);
  
  let markdown = `# 湿房全部作品交接汇总\n\n`;
  markdown += `> 生成时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
  markdown += `---\n\n`;

  for (const artwork of artworks) {
    const artworkHandover = await generateMarkdownHandover(artwork.id);
    markdown += artworkHandover + '\n\n---\n\n';
  }

  return markdown;
}

module.exports = {
  generateMarkdownHandover,
  generateAuditPackage,
  generateAllHandoverNotes
};
