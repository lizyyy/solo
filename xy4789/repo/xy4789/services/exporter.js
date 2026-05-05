// 生成Markdown交接单
function generateMarkdown(batch, artifacts) {
  // 统计信息
  const totalItems = batch.total_items || artifacts.length;
  const confirmedItems = artifacts.filter(a => a.status === 'confirmed').length;
  const returnedItems = artifacts.filter(a => a.status === 'returned').length;
  const missingCertificates = artifacts.filter(a => a.has_certificate === 0 || a.hasCertificate === false).length;
  const totalInsuranceValue = artifacts.reduce((sum, a) => sum + (a.insurance_value || a.insuranceValue || 0), 0);
  
  // 生成Markdown内容
  let markdown = `# 文物交接单\n\n`;
  
  // 基本信息
  markdown += `## 基本信息\n\n`;
  markdown += `- **批次名称**: ${batch.batch_name}\n`;
  markdown += `- **批次ID**: ${batch.id}\n`;
  markdown += `- **入库时间**: ${batch.upload_date || batch.created_at}\n`;
  markdown += `- **状态**: ${batch.status === 'confirmed' ? '已确认' : batch.status}\n`;
  markdown += `- **总件数**: ${totalItems}\n`;
  markdown += `- **确认入库**: ${confirmedItems}\n`;
  markdown += `- **退回**: ${returnedItems}\n`;
  markdown += `- **缺证数量**: ${missingCertificates}\n`;
  markdown += `- **总保险值**: ¥${formatCurrency(totalInsuranceValue)}\n`;
  
  if (batch.notes) {
    markdown += `- **备注**: ${batch.notes}\n`;
  }
  
  markdown += `\n`;
  
  // 藏品列表
  markdown += `## 藏品明细\n\n`;
  
  // 确认入库的藏品
  const confirmedArtifacts = artifacts.filter(a => a.status === 'confirmed');
  if (confirmedArtifacts.length > 0) {
    markdown += `### 已确认入库 (${confirmedArtifacts.length}件)\n\n`;
    markdown += `| 序号 | 箱号 | 藏品号 | 保险值 | 库位 | 状态 | 有证 | 备注 |\n`;
    markdown += `|------|------|--------|--------|------|------|------|------|\n`;
    
    confirmedArtifacts.forEach((artifact, index) => {
      const row = [
        artifact.original_row || index + 1,
        artifact.box_number || artifact.boxNumber || '-',
        artifact.artifact_number || artifact.artifactNumber || '-',
        `¥${formatCurrency(artifact.insurance_value || artifact.insuranceValue || 0)}`,
        artifact.location || '-',
        getStatusText(artifact.status),
        (artifact.has_certificate || artifact.hasCertificate) ? '是' : '否',
        artifact.notes || '-'
      ].map(cell => cell.toString().replace(/\n/g, ' '));
      
      markdown += `| ${row.join(' | ')} |\n`;
    });
    
    markdown += `\n`;
  }
  
  // 退回的藏品
  const returnedArtifacts = artifacts.filter(a => a.status === 'returned');
  if (returnedArtifacts.length > 0) {
    markdown += `### 已退回 (${returnedArtifacts.length}件)\n\n`;
    markdown += `| 序号 | 箱号 | 藏品号 | 保险值 | 库位 | 状态 | 有证 | 备注 |\n`;
    markdown += `|------|------|--------|--------|------|------|------|------|\n`;
    
    returnedArtifacts.forEach((artifact, index) => {
      const row = [
        artifact.original_row || index + 1,
        artifact.box_number || artifact.boxNumber || '-',
        artifact.artifact_number || artifact.artifactNumber || '-',
        `¥${formatCurrency(artifact.insurance_value || artifact.insuranceValue || 0)}`,
        artifact.location || '-',
        getStatusText(artifact.status),
        (artifact.has_certificate || artifact.hasCertificate) ? '是' : '否',
        artifact.notes || '-'
      ].map(cell => cell.toString().replace(/\n/g, ' '));
      
      markdown += `| ${row.join(' | ')} |\n`;
    });
    
    markdown += `\n`;
  }
  
  // 验证问题汇总
  const validationIssues = [];
  artifacts.forEach(artifact => {
    const errors = artifact.validation_errors ? JSON.parse(artifact.validation_errors) : (artifact.validationErrors || []);
    if (errors.length > 0) {
      validationIssues.push({
        artifactNumber: artifact.artifact_number || artifact.artifactNumber,
        errors: errors
      });
    }
  });
  
  if (validationIssues.length > 0) {
    markdown += `## 验证问题汇总\n\n`;
    
    validationIssues.forEach(issue => {
      markdown += `### 藏品号: ${issue.artifactNumber}\n\n`;
      issue.errors.forEach(error => {
        const type = error.type === 'error' ? '❌ 错误' : '⚠️ 警告';
        markdown += `- ${type}: ${error.message}\n`;
      });
      markdown += `\n`;
    });
  }
  
  // 交接签字
  markdown += `\n---\n\n`;
  markdown += `## 交接确认\n\n`;
  markdown += `| 交接方 | 签字 | 日期 |\n`;
  markdown += `|--------|------|------|\n`;
  markdown += `| 移交方 |      |      |\n`;
  markdown += `| 接收方 |      |      |\n`;
  markdown += `| 监交方 |      |      |\n`;
  
  markdown += `\n---\n\n`;
  markdown += `*此交接单由系统自动生成，生成时间: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}*\n`;
  
  return markdown;
}

// 生成JSON明细
function generateJSON(batch, artifacts) {
  return {
    batch: {
      id: batch.id,
      batchName: batch.batch_name,
      uploadDate: batch.upload_date || batch.created_at,
      status: batch.status,
      totalItems: batch.total_items || artifacts.length,
      confirmedItems: batch.confirmed_items || artifacts.filter(a => a.status === 'confirmed').length,
      cancelledItems: batch.cancelled_items || artifacts.filter(a => a.status === 'returned').length,
      notes: batch.notes,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at
    },
    artifacts: artifacts.map(artifact => ({
      id: artifact.id,
      batchId: artifact.batch_id,
      boxNumber: artifact.box_number || artifact.boxNumber,
      artifactNumber: artifact.artifact_number || artifact.artifactNumber,
      insuranceValue: artifact.insurance_value || artifact.insuranceValue,
      location: artifact.location,
      status: artifact.status,
      hasCertificate: artifact.has_certificate !== undefined ? artifact.has_certificate : artifact.hasCertificate,
      originalRow: artifact.original_row || artifact.originalRow,
      notes: artifact.notes,
      validationErrors: artifact.validation_errors ? JSON.parse(artifact.validation_errors) : (artifact.validationErrors || []),
      createdAt: artifact.created_at,
      updatedAt: artifact.updated_at
    })),
    summary: {
      totalItems: artifacts.length,
      confirmedItems: artifacts.filter(a => a.status === 'confirmed').length,
      returnedItems: artifacts.filter(a => a.status === 'returned').length,
      missingCertificates: artifacts.filter(a => a.has_certificate === 0 || a.hasCertificate === false).length,
      totalInsuranceValue: artifacts.reduce((sum, a) => sum + (a.insurance_value || a.insuranceValue || 0), 0)
    },
    generatedAt: new Date().toISOString()
  };
}

// 辅助函数：格式化货币
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00';
  }
  return parseFloat(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// 辅助函数：获取状态文本
function getStatusText(status) {
  const statusMap = {
    'pending': '待确认',
    'confirmed': '已确认',
    'returned': '已退回',
    'missing': '缺失'
  };
  return statusMap[status] || status;
}

module.exports = {
  generateMarkdown,
  generateJSON
};
