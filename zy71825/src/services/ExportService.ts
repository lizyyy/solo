import { PlayerRecord, LevelData, RecordHistory, ActivitySummary } from '../types';
import { StorageService } from './StorageService';

export class ExportService {
  static exportRecordsToCSV(records: PlayerRecord[]): void {
    const headers = [
      '记录ID', '玩家ID', '玩家名称', '关卡名称', '完成时间',
      '奖励状态', '实际奖励', '奖励数量', '数据来源', '处理人', '处理时间', '备注'
    ];
    
    const statusMap: { [key: string]: string } = {
      'pending': '待处理',
      'confirmed': '已确认',
      'corrected': '已修正',
      'topped_up': '已补发'
    };

    const sourceMap: { [key: string]: string } = {
      'game_data': '游戏数据',
      'player_feedback': '玩家反馈',
      'manual': '人工录入'
    };

    const rows = records.map(record => [
      record.id,
      record.playerId,
      record.playerName,
      record.levelName,
      new Date(record.completedAt).toLocaleString('zh-CN'),
      statusMap[record.rewardStatus] || record.rewardStatus,
      record.actualReward || '',
      record.actualAmount?.toString() || '',
      sourceMap[record.source] || record.source,
      record.handler || '',
      record.handledAt ? new Date(record.handledAt).toLocaleString('zh-CN') : '',
      record.correctionNote || record.feedbackNote || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    this.downloadFile(csvContent, `玩家记录_${new Date().toLocaleDateString('zh-CN')}.csv`, 'text/csv');
  }

  static exportLevelsToCSV(levels: LevelData[]): void {
    const headers = ['关卡ID', '关卡名称', '章节', '关卡', '预期奖励', '奖励数量', '数据来源', '导入时间'];
    
    const sourceMap: { [key: string]: string } = {
      'imported': '导入',
      'manual': '手动添加'
    };

    const rows = levels.map(level => [
      level.id,
      level.name,
      level.chapter.toString(),
      level.stage.toString(),
      level.expectedReward,
      level.rewardAmount.toString(),
      sourceMap[level.source] || level.source,
      level.importedAt ? new Date(level.importedAt).toLocaleString('zh-CN') : ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    this.downloadFile(csvContent, `关卡配置_${new Date().toLocaleDateString('zh-CN')}.csv`, 'text/csv');
  }

  static exportHistoryToCSV(history: RecordHistory[]): void {
    const headers = ['操作ID', '记录ID', '操作类型', '操作人', '操作时间', '备注'];
    
    const actionMap: { [key: string]: string } = {
      'created': '创建',
      'updated': '更新',
      'confirmed': '确认',
      'corrected': '修正',
      'topped_up': '补发'
    };

    const rows = history.map(h => [
      h.id,
      h.recordId,
      actionMap[h.action] || h.action,
      h.operator,
      new Date(h.timestamp).toLocaleString('zh-CN'),
      h.note || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    this.downloadFile(csvContent, `操作历史_${new Date().toLocaleDateString('zh-CN')}.csv`, 'text/csv');
  }

  static exportActivitySummary(summary: ActivitySummary): void {
    let content = `========================================\n`;
    content += `        植物温室守护 - 活动复盘报告\n`;
    content += `========================================\n\n`;
    content += `活动名称：${summary.activityName}\n`;
    content += `活动时间：${new Date(summary.startDate).toLocaleDateString('zh-CN')} 至 ${new Date(summary.endDate).toLocaleDateString('zh-CN')}\n`;
    content += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    
    content += `【处理口径说明】\n`;
    content += `${summary.handlingPolicy}\n\n`;
    
    content += `【统计概览】\n`;
    content += `  总记录数：${summary.stats.total}\n`;
    content += `  已确认：${summary.stats.confirmed}\n`;
    content += `  待处理：${summary.stats.pending}\n`;
    content += `  已修正：${summary.stats.corrected}\n`;
    content += `  待补发：${summary.stats.toBeSupplemented}\n\n`;

    content += `【详细记录分类】\n\n`;
    
    if (summary.breakdown.confirmedRecords.length > 0) {
      content += `1. 已确认记录 (${summary.breakdown.confirmedRecords.length}条)\n`;
      content += `----------------------------------------\n`;
      summary.breakdown.confirmedRecords.forEach(r => {
        content += `  ${r.playerName}(${r.playerId}) - ${r.levelName} - ${r.actualReward || '已发'}\n`;
      });
      content += '\n';
    }

    if (summary.breakdown.pendingRecords.length > 0) {
      content += `2. 待处理记录 (${summary.breakdown.pendingRecords.length}条) - 请优先处理\n`;
      content += `----------------------------------------\n`;
      summary.breakdown.pendingRecords.forEach(r => {
        const source = r.source === 'player_feedback' ? '玩家反馈' : '游戏数据';
        content += `  ${r.playerName}(${r.playerId}) - ${r.levelName} - 来源:${source}${r.feedbackNote ? ' - ' + r.feedbackNote : ''}\n`;
      });
      content += '\n';
    }

    if (summary.breakdown.correctedRecords.length > 0) {
      content += `3. 人工修正记录 (${summary.breakdown.correctedRecords.length}条) - 已人工介入\n`;
      content += `----------------------------------------\n`;
      summary.breakdown.correctedRecords.forEach(r => {
        content += `  ${r.playerName}(${r.playerId}) - ${r.levelName} - 处理人:${r.handler || '未知'}${r.correctionNote ? ' - ' + r.correctionNote : ''}\n`;
      });
      content += '\n';
    }

    if (summary.breakdown.toBeSupplementedRecords.length > 0) {
      content += `4. 待补发记录 (${summary.breakdown.toBeSupplementedRecords.length}条) - 需执行补发\n`;
      content += `----------------------------------------\n`;
      summary.breakdown.toBeSupplementedRecords.forEach(r => {
        content += `  ${r.playerName}(${r.playerId}) - ${r.levelName} - 应发:${r.actualReward} x${r.actualAmount}\n`;
      });
      content += '\n';
    }

    content += `========================================\n`;
    content += `        报告结束 - 请按处理口径执行\n`;
    content += `========================================\n`;

    this.downloadFile(content, `活动复盘_${summary.activityName}_${new Date().toLocaleDateString('zh-CN')}.txt`, 'text/plain');
  }

  static exportAllData(): void {
    const data = {
      levels: StorageService.getLevels(),
      records: StorageService.getRecords(),
      history: StorageService.getHistory(),
      exportedAt: Date.now(),
      exportedBy: '植物温室守护系统'
    };
    
    this.downloadFile(
      JSON.stringify(data, null, 2),
      `完整数据备份_${new Date().toLocaleDateString('zh-CN')}.json`,
      'application/json'
    );
  }

  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob(['\ufeff' + content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
