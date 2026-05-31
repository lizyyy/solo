import { ActivitySummary, PlayerRecord, ReviewStats } from '../types';
import { StorageService } from './StorageService';

export class ActivityService {
  static getReviewStats(): ReviewStats {
    const records = StorageService.getRecords();
    return {
      total: records.length,
      confirmed: records.filter(r => r.rewardStatus === 'confirmed').length,
      pending: records.filter(r => r.rewardStatus === 'pending').length,
      corrected: records.filter(r => r.rewardStatus === 'corrected').length,
      toBeSupplemented: records.filter(r => r.rewardStatus === 'topped_up').length
    };
  }

  static generateActivitySummary(
    activityName: string,
    startDate: Date,
    endDate: Date,
    handlingPolicy: string
  ): ActivitySummary {
    const records = StorageService.getRecords();
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const filteredRecords = records.filter(r => 
      r.completedAt >= startTime && r.completedAt <= endTime
    );

    const confirmedRecords = filteredRecords.filter(r => r.rewardStatus === 'confirmed');
    const pendingRecords = filteredRecords.filter(r => r.rewardStatus === 'pending');
    const correctedRecords = filteredRecords.filter(r => r.rewardStatus === 'corrected');
    const toBeSupplementedRecords = filteredRecords.filter(r => r.rewardStatus === 'topped_up');

    return {
      activityName,
      startDate: startTime,
      endDate: endTime,
      handlingPolicy,
      stats: {
        total: filteredRecords.length,
        confirmed: confirmedRecords.length,
        pending: pendingRecords.length,
        corrected: correctedRecords.length,
        toBeSupplemented: toBeSupplementedRecords.length
      },
      breakdown: {
        confirmedRecords,
        pendingRecords,
        correctedRecords,
        toBeSupplementedRecords
      }
    };
  }

  static getRecordsByStatus(status: PlayerRecord['rewardStatus']): PlayerRecord[] {
    return StorageService.getRecords().filter(r => r.rewardStatus === status);
  }

  static getRecordsBySource(source: PlayerRecord['source']): PlayerRecord[] {
    return StorageService.getRecords().filter(r => r.source === source);
  }

  static searchRecords(keyword: string): PlayerRecord[] {
    const lowerKeyword = keyword.toLowerCase();
    return StorageService.getRecords().filter(r => 
      r.playerName.toLowerCase().includes(lowerKeyword) ||
      r.playerId.toLowerCase().includes(lowerKeyword) ||
      r.levelName.toLowerCase().includes(lowerKeyword)
    );
  }

  static getDefaultHandlingPolicy(): string {
    return `
1. 已确认记录：奖励已正常发放，无需额外操作
2. 待处理记录：请在24小时内完成复核，优先处理玩家反馈记录
3. 已修正记录：已人工介入，需跟踪玩家是否收到
4. 待补发记录：请走补发流程，补发后标记为"已补发"
5. 所有处理需在活动结束后7天内完成
    `.trim();
  }

  static addSampleData(): void {
    const sampleLevels = [
      { id: 'level_1_1', name: '阳光花房', chapter: 1, stage: 1, expectedReward: '钻石', rewardAmount: 100, source: 'imported' as const, importedAt: Date.now() },
      { id: 'level_1_2', name: '温室培育', chapter: 1, stage: 2, expectedReward: '金币', rewardAmount: 500, source: 'imported' as const, importedAt: Date.now() },
      { id: 'level_2_1', name: '雨林探险', chapter: 2, stage: 1, expectedReward: '钻石', rewardAmount: 150, source: 'imported' as const, importedAt: Date.now() },
      { id: 'level_2_2', name: '沙漠绿洲', chapter: 2, stage: 2, expectedReward: '能量', rewardAmount: 50, source: 'imported' as const, importedAt: Date.now() }
    ];
    StorageService.saveLevels(sampleLevels);

    const sampleRecords: Omit<PlayerRecord, 'id'>[] = [
      { playerId: 'P001', playerName: '小明', levelId: 'level_1_1', levelName: '阳光花房', completedAt: Date.now() - 86400000, rewardStatus: 'confirmed', actualReward: '钻石', actualAmount: 100, source: 'game_data', handler: '张三', handledAt: Date.now() - 80000000 },
      { playerId: 'P002', playerName: '小红', levelId: 'level_1_1', levelName: '阳光花房', completedAt: Date.now() - 72000000, rewardStatus: 'pending', source: 'game_data' },
      { playerId: 'P003', playerName: '小刚', levelId: 'level_1_2', levelName: '温室培育', completedAt: Date.now() - 60000000, rewardStatus: 'pending', source: 'player_feedback', feedbackNote: '通关后没收到奖励' },
      { playerId: 'P004', playerName: '小美', levelId: 'level_2_1', levelName: '雨林探险', completedAt: Date.now() - 50000000, rewardStatus: 'corrected', actualReward: '钻石', actualAmount: 150, source: 'manual', handler: '李四', handledAt: Date.now() - 40000000, correctionNote: '数据异常，手动补发' },
      { playerId: 'P005', playerName: '小华', levelId: 'level_2_2', levelName: '沙漠绿洲', completedAt: Date.now() - 36000000, rewardStatus: 'topped_up', actualReward: '能量', actualAmount: 50, source: 'player_feedback', handler: '王五', handledAt: Date.now() - 20000000 }
    ];

    sampleRecords.forEach(r => StorageService.addRecord(r));
  }
}
