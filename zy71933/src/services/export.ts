import { Material, MaterialStatus } from '../types';

const statusLabels: Record<MaterialStatus, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已拒绝',
  needs_revision: '需修改',
  auth_expired: '授权过期'
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const generateDeliveryNote = (materials: Material[], batchId?: string): string => {
  const lines: string[] = [];
  
  lines.push('========================================');
  lines.push('         品牌物料审稿 - 交付说明');
  lines.push('========================================');
  lines.push(`生成时间: ${formatDate(new Date().toISOString())}`);
  if (batchId) {
    lines.push(`批次号: ${batchId}`);
  }
  lines.push('----------------------------------------');
  lines.push('');

  materials.forEach((material, index) => {
    lines.push(`【物料 ${index + 1}】`);
    lines.push(`物料名称: ${material.name}`);
    lines.push(`物料来源: ${material.source}`);
    lines.push(`当前状态: ${statusLabels[material.currentStatus]}`);
    lines.push(`状态原因: ${material.statusReason || '无'}`);
    lines.push(`创建时间: ${formatDate(material.createdAt)}`);
    lines.push(`创建人: ${material.createdBy}`);
    lines.push(`最后修改: ${formatDate(material.lastModifiedAt)}`);
    lines.push(`修改人: ${material.lastModifiedBy}`);
    lines.push(`当前版本: v${material.currentVersion}`);
    lines.push(`批次号: ${material.batchId}`);
    
    if (material.authorizationFiles.length > 0) {
      lines.push('');
      lines.push('授权文件:');
      material.authorizationFiles.forEach(file => {
        const isExpired = new Date(file.expiryDate) < new Date();
        lines.push(`  - ${file.name}`);
        lines.push(`    上传人: ${file.uploadedBy}`);
        lines.push(`    到期日: ${file.expiryDate}${isExpired ? ' [已过期]' : ''}`);
      });
    }

    if (material.reviewComments) {
      lines.push('');
      lines.push(`审稿意见: ${material.reviewComments}`);
    }

    if (material.tags.length > 0) {
      lines.push('');
      lines.push(`标签: ${material.tags.join(', ')}`);
    }

    lines.push('');
    lines.push('--- 版本历史 ---');
    material.versionHistory.forEach(version => {
      lines.push(`v${version.version} | ${formatDate(version.timestamp)} | ${version.modifiedBy}`);
      lines.push(`    状态: ${statusLabels[version.status]}`);
      lines.push(`    备注: ${version.comment}`);
      version.changes.forEach(change => {
        lines.push(`    变更: ${change.field}: ${change.oldValue} -> ${change.newValue}`);
      });
    });

    lines.push('');
    lines.push('----------------------------------------');
    lines.push('');
  });

  lines.push('');
  lines.push('========================================');
  lines.push('         交接备注');
  lines.push('========================================');
  lines.push('下一班请重点关注:');
  lines.push('- 待处理状态的物料需要跟进');
  lines.push('- 授权过期的物料需要重新授权');
  lines.push('- 需修改的物料需要反馈给设计师');
  lines.push('========================================');

  return lines.join('\n');
};

export const downloadTextFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportDeliveryNote = (materials: Material[], batchId?: string): void => {
  const content = generateDeliveryNote(materials, batchId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `品牌物料交付说明_${timestamp}.txt`;
  downloadTextFile(content, filename);
};
