import { differenceInDays } from 'date-fns';
import { Certificate, CertificateStatus, CheckResult, CertificateType } from '../types';
import certificateRepository from '../database/repositories/certificateRepository';
import historyRepository from '../database/repositories/historyRepository';
import db from '../database/connection';
import { formatErrorForUser } from '../utils/errors';

interface CheckOptions {
  merge?: boolean;
  autoMerge?: boolean;
  fix?: boolean;
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

function calculateDaysUntilExpiry(cert: Certificate): number {
  const expiryDate = new Date(cert.expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInDays(expiryDate, today);
}

function formatExpiryStatus(cert: Certificate): string {
  const days = calculateDaysUntilExpiry(cert);
  
  if (days < 0) {
    return `🔴 已过期 ${Math.abs(days)} 天`;
  } else if (days === 0) {
    return '🔴 今天到期';
  } else if (days <= 7) {
    return `🟠 ${days} 天后到期`;
  } else if (days <= 30) {
    return `🟡 ${days} 天后到期`;
  } else if (days <= 90) {
    return `🟢 ${days} 天后到期`;
  } else {
    return `✅ ${days} 天后到期`;
  }
}

function getTypeLabel(type: CertificateType): string {
  const labels: Record<CertificateType, string> = {
    [CertificateType.SSL]: '🔐 SSL证书',
    [CertificateType.DOMAIN]: '🌐 域名',
    [CertificateType.VENDOR]: '🏢 供应商资质',
    [CertificateType.EMPLOYEE]: '👤 员工证书'
  };
  return labels[type] || type;
}

export async function executeCheck(options: CheckOptions): Promise<void> {
  console.log('\n🔍 开始检查证书状态...\n');
  
  try {
    await db.init();
    
    const allCerts = await certificateRepository.findAll();
    const activeCerts = allCerts.filter(c => c.status !== CertificateStatus.MERGED);
    
    if (activeCerts.length === 0) {
      console.log('⚠️  没有证书数据，请先导入数据');
      return;
    }
    
    console.log(`📊 总证书数: ${activeCerts.length}\n`);
    
    const issues: CheckResult[] = [];
    
    // 1. 检查已过期证书
    const expiredCerts = await certificateRepository.findExpired();
    if (expiredCerts.length > 0) {
      expiredCerts.forEach(cert => {
        issues.push({
          id: cert.id,
          type: 'EXPIRED',
          severity: 'critical',
          message: `证书已过期: ${cert.name}`,
          certificateIds: [cert.id]
        });
      });
    }
    
    // 2. 检查即将到期证书（30天内）
    const expiringCerts = await certificateRepository.findExpiringWithin(30);
    const nonExpiredExpiring = expiringCerts.filter(c => !expiredCerts.find(e => e.id === c.id));
    if (nonExpiredExpiring.length > 0) {
      nonExpiredExpiring.forEach(cert => {
        const days = calculateDaysUntilExpiry(cert);
        issues.push({
          id: cert.id,
          type: 'EXPIRING',
          severity: days <= 7 ? 'high' : 'medium',
          message: `证书即将到期: ${cert.name} (${days}天后)`,
          certificateIds: [cert.id]
        });
      });
    }
    
    // 3. 检查重复证书
    const duplicates = await certificateRepository.findPotentialDuplicates();
    issues.push(...duplicates);
    
    // 4. 检查缺少责任人的证书
    const missingOwnerCerts = activeCerts.filter(c => !c.ownerName && !c.ownerEmail);
    if (missingOwnerCerts.length > 0) {
      missingOwnerCerts.forEach(cert => {
        issues.push({
          id: cert.id,
          type: 'MISSING_OWNER',
          severity: 'low',
          message: `缺少责任人: ${cert.name}`,
          certificateIds: [cert.id]
        });
      });
    }
    
    // 按严重程度排序
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    // 输出统计
    console.log('📋 问题统计:');
    const critical = issues.filter(i => i.severity === 'critical').length;
    const high = issues.filter(i => i.severity === 'high').length;
    const medium = issues.filter(i => i.severity === 'medium').length;
    const low = issues.filter(i => i.severity === 'low').length;
    
    console.log(`   🔴 严重: ${critical}`);
    console.log(`   🟠 高危: ${high}`);
    console.log(`   🟡 中等: ${medium}`);
    console.log(`   🟢 低危: ${low}`);
    console.log('');
    
    if (issues.length === 0) {
      console.log('✅ 没有发现问题，所有证书状态良好！');
      return;
    }
    
    // 分类展示问题
    const expiredIssues = issues.filter(i => i.type === 'EXPIRED');
    const expiringIssues = issues.filter(i => i.type === 'EXPIRING');
    const duplicateIssues = issues.filter(i => i.type === 'DUPLICATE');
    const missingOwnerIssues = issues.filter(i => i.type === 'MISSING_OWNER');
    
    // 1. 已过期证书
    if (expiredIssues.length > 0) {
      console.log('🔴 已过期证书:');
      for (const issue of expiredIssues) {
        const cert = activeCerts.find(c => c.id === issue.certificateIds[0]);
        if (cert) {
          console.log(`   ${getTypeLabel(cert.type)} ${cert.name}`);
          console.log(`      ${formatExpiryStatus(cert)}`);
          if (cert.ownerName) {
            console.log(`      责任人: ${cert.ownerName}${cert.ownerEmail ? ` <${cert.ownerEmail}>` : ''}`);
          }
        }
      }
      console.log('');
    }
    
    // 2. 即将到期证书
    if (expiringIssues.length > 0) {
      console.log('🟠 即将到期证书:');
      for (const issue of expiringIssues) {
        const cert = activeCerts.find(c => c.id === issue.certificateIds[0]);
        if (cert) {
          console.log(`   ${getTypeLabel(cert.type)} ${cert.name}`);
          console.log(`      ${formatExpiryStatus(cert)}`);
          if (cert.ownerName) {
            console.log(`      责任人: ${cert.ownerName}${cert.ownerEmail ? ` <${cert.ownerEmail}>` : ''}`);
          }
        }
      }
      console.log('');
    }
    
    // 3. 重复证书
    if (duplicateIssues.length > 0) {
      console.log('🟡 重复证书:');
      for (const issue of duplicateIssues) {
        console.log(`   ${getSeverityColor(issue.severity)} ${issue.message}`);
        console.log(`      涉及证书 ID: ${issue.certificateIds.join(', ')}`);
        
        for (const certId of issue.certificateIds) {
          const cert = activeCerts.find(c => c.id === certId);
          if (cert) {
            console.log(`        - ${cert.name} (来源: ${cert.source})`);
          }
        }
      }
      console.log('');
      
      // 合并重复证书
      if (options.merge || options.autoMerge) {
        console.log('🔄 开始合并重复证书...\n');
        
        for (const issue of duplicateIssues) {
          if (issue.certificateIds.length < 2) continue;
          
          const certs = issue.certificateIds
            .map(id => activeCerts.find(c => c.id === id))
            .filter(Boolean) as Certificate[];
          
          if (certs.length < 2) continue;
          
          // 选择保留的证书：优先选择过期时间晚的，信息更完整的
          const sortedCerts = certs.sort((a, b) => {
            const aScore = (a.issueDate ? 1 : 0) + (a.serialNumber ? 1 : 0) + (a.fingerprint ? 1 : 0);
            const bScore = (b.issueDate ? 1 : 0) + (b.serialNumber ? 1 : 0) + (b.fingerprint ? 1 : 0);
            if (aScore !== bScore) return bScore - aScore;
            return new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime();
          });
          
          const primaryCert = sortedCerts[0];
          const duplicatesToMerge = sortedCerts.slice(1);
          
          console.log(`   主证书: ${primaryCert.name} (ID: ${primaryCert.id})`);
          console.log(`   合并: ${duplicatesToMerge.map(c => `${c.name} (${c.id})`).join(', ')}`);
          
          await certificateRepository.mergeCertificates(
            primaryCert.id,
            duplicatesToMerge.map(c => c.id)
          );
          
          await historyRepository.addRecord(
            primaryCert.id,
            'MERGE',
            `合并了证书: ${duplicatesToMerge.map(c => c.id).join(', ')}`
          );
          
          console.log(`   ✅ 已合并\n`);
        }
        
        console.log('✅ 重复证书合并完成！\n');
      } else {
        console.log('💡 使用 --merge 或 --auto-merge 来合并重复证书\n');
      }
    }
    
    // 4. 缺少责任人
    if (missingOwnerIssues.length > 0) {
      console.log('🟢 缺少责任人的证书:');
      for (const issue of missingOwnerIssues) {
        const cert = activeCerts.find(c => c.id === issue.certificateIds[0]);
        if (cert) {
          console.log(`   ${getTypeLabel(cert.type)} ${cert.name}`);
          console.log(`      到期日期: ${cert.expiryDate}`);
        }
      }
      console.log('');
    }
    
    // 更新证书状态
    if (options.fix) {
      console.log('🔧 自动修复证书状态...\n');
      let updated = 0;
      
      for (const cert of activeCerts) {
        const days = calculateDaysUntilExpiry(cert);
        let newStatus: CertificateStatus | null = null;
        
        if (days < 0 && cert.status !== CertificateStatus.EXPIRED) {
          newStatus = CertificateStatus.EXPIRED;
        } else if (days >= 0 && days <= 30 && cert.status !== CertificateStatus.EXPIRING) {
          newStatus = CertificateStatus.EXPIRING;
        } else if (days > 30 && cert.status !== CertificateStatus.ACTIVE) {
          newStatus = CertificateStatus.ACTIVE;
        }
        
        if (newStatus && newStatus !== cert.status) {
          await certificateRepository.updateStatus(cert.id, newStatus);
          await historyRepository.addRecord(
            cert.id,
            'STATUS_UPDATE',
            `状态从 ${cert.status} 更新为 ${newStatus}`
          );
          updated++;
        }
      }
      
      console.log(`✅ 更新了 ${updated} 个证书的状态\n`);
    }
    
    console.log('💡 建议操作:');
    console.log('   1. 优先处理已过期和即将到期的证书');
    console.log('   2. 合并重复证书以减少管理负担');
    console.log('   3. 为所有证书添加责任人信息');
    console.log('   4. 生成详细报告: cert-audit report\n');
    
  } catch (error) {
    console.error(formatErrorForUser(error));
    process.exit(1);
  }
}
