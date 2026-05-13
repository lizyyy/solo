import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import historyRepository from '../database/repositories/historyRepository';
import db from '../database/connection';
import { formatErrorForUser } from '../utils/errors';

interface HistoryOptions {
  certificateId?: string;
  action?: string;
  limit?: number;
  days?: number;
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'IMPORT': '📥 导入',
    'UPDATE': '✏️  更新',
    'DELETE': '🗑️  删除',
    'MERGE': '🔀 合并',
    'STATUS_UPDATE': '🔄 状态更新',
    'OWNER_UPDATE': '👤 责任人更新',
    'EXPORT': '📤 导出'
  };
  return labels[action] || action;
}

function formatTimestamp(timestamp: string): string {
  try {
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
  } catch {
    return timestamp;
  }
}

export async function executeHistory(options: HistoryOptions): Promise<void> {
  console.log('\n📜 查看历史记录...\n');
  
  try {
    await db.init();
    
    let records;
    let title = '';
    
    if (options.certificateId) {
      records = await historyRepository.findByCertificateId(
        options.certificateId, 
        options.limit || 50
      );
      title = `证书 ${options.certificateId} 的操作记录`;
    } else if (options.action) {
      records = await historyRepository.findByAction(
        options.action.toUpperCase(),
        options.limit || 50
      );
      title = `类型为 ${options.action} 的操作记录`;
    } else if (options.days) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - options.days);
      
      records = await historyRepository.findByDateRange(
        startDate.toISOString(),
        endDate.toISOString()
      );
      title = `最近 ${options.days} 天的操作记录`;
    } else {
      records = await historyRepository.findAll(options.limit || 100);
      title = '最近操作记录';
    }
    
    if (records.length === 0) {
      console.log('⚠️  没有找到历史记录');
      return;
    }
    
    console.log(`📋 ${title} (共 ${records.length} 条)\n`);
    
    // 统计操作类型
    const actionStats: Record<string, number> = {};
    records.forEach(record => {
      actionStats[record.action] = (actionStats[record.action] || 0) + 1;
    });
    
    console.log('📊 操作类型统计:');
    Object.entries(actionStats).forEach(([action, count]) => {
      console.log(`   ${getActionLabel(action)}: ${count} 次`);
    });
    console.log('');
    
    // 显示记录详情
    console.log('📝 记录详情:\n');
    
    records.forEach((record, index) => {
      console.log(`${index + 1}. ${getActionLabel(record.action)}`);
      console.log(`   ⏰ 时间: ${formatTimestamp(record.timestamp)}`);
      console.log(`   🆔 证书ID: ${record.certificateId}`);
      
      if (record.details) {
        console.log(`   📝 详情: ${record.details}`);
      }
      
      if (record.actor) {
        console.log(`   👤 操作者: ${record.actor}`);
      }
      
      console.log('');
    });
    
    // 显示最近操作趋势（如果有足够数据）
    if (records.length > 0) {
      const recentActions = await historyRepository.getRecentActions(7);
      if (recentActions.length > 0) {
        console.log('📈 最近7天操作趋势:');
        recentActions.forEach(item => {
          console.log(`   ${getActionLabel(item.action)}: ${item.count} 次`);
        });
      }
    }
    
  } catch (error) {
    console.error(formatErrorForUser(error));
    process.exit(1);
  }
}
