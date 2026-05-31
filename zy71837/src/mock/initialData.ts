import type { BattleRecord, BatchTask } from '@/types';
import { generateRecordFingerprint } from '@/utils/fingerprint';

export function generateMockRecords(): BattleRecord[] {
  const playerNames = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '冯十二'];
  const records: BattleRecord[] = [];
  const now = new Date();
  
  for (let i = 0; i < 50; i++) {
    const battleTime = new Date(now.getTime() - (i * 3600000)).toISOString();
    const score = Math.floor(Math.random() * 80000) + 10000;
    const hasAnomaly = i % 7 === 0;
    const hasWarning = i % 5 === 0 && !hasAnomaly;
    
    let settlement = Math.floor(score * (0.48 + Math.random() * 0.04));
    if (hasAnomaly) {
      settlement = Math.floor(score * 0.3);
    }
    if (i === 15) {
      settlement = 0;
    }
    
    const baseRecord: Omit<BattleRecord, 'id' | 'dataFingerprint' | 'createdAt' | 'updatedAt'> = {
      battleId: `BATTLE-${String(i + 1).padStart(6, '0')}`,
      playerId: `PLAYER-${String((i % 10) + 1).padStart(4, '0')}`,
      playerName: playerNames[i % 10],
      score,
      settlement,
      status: hasAnomaly ? 'anomaly' : hasWarning ? 'warning' : 'normal',
      battleTime
    };
    
    const record: BattleRecord = {
      ...baseRecord,
      id: crypto.randomUUID(),
      dataFingerprint: '',
      createdAt: battleTime,
      updatedAt: battleTime
    };
    
    record.dataFingerprint = generateRecordFingerprint(record);
    records.push(record);
  }
  
  return records;
}

export function generateMockBatchTasks(): BatchTask[] {
  return [
    {
      id: crypto.randomUUID(),
      name: '批量重新计算结算值',
      operationType: 'batch',
      config: { formula: 'score * 0.5', round: true },
      idempotencyKey: 'recalc_settlement_v1',
      maxRuns: 3,
      isIdempotent: true,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: '批量修正异常数据',
      operationType: 'correct',
      config: { fixType: 'anomaly_only', autoMarkResolved: true },
      idempotencyKey: 'fix_anomalies_v1',
      maxRuns: 1,
      isIdempotent: true,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      name: '删除过期数据',
      operationType: 'delete',
      config: { daysToKeep: 30 },
      idempotencyKey: 'cleanup_expired_' + new Date().toISOString().split('T')[0],
      maxRuns: 1,
      isIdempotent: false,
      createdAt: new Date().toISOString()
    }
  ];
}

export function generateSampleCSV(): string {
  const headers = ['battleId', 'playerId', 'playerName', 'score', 'settlement', 'battleTime'];
  const rows = [
    headers.join(','),
    'BATTLE-000051,PLAYER-0001,陈十三,65000,32500,2024-01-15T10:00:00.000Z',
    'BATTLE-000052,PLAYER-0002,楚十四,72000,36000,2024-01-15T11:00:00.000Z',
    'BATTLE-000053,PLAYER-0003,魏十五,58000,29000,2024-01-15T12:00:00.000Z',
    'BATTLE-000054,PLAYER-0004,蒋十六,81000,40500,2024-01-15T13:00:00.000Z',
    'BATTLE-000055,PLAYER-0005,沈十七,45000,22500,2024-01-15T14:00:00.000Z'
  ];
  return rows.join('\n');
}
