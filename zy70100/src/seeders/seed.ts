import { initializeDb, getDb, closeDb } from '../database';
import { ChargingSessionRepository } from '../repositories/ChargingSessionRepository';
import { BillingSegmentRepository } from '../repositories/BillingSegmentRepository';
import { ChargeType, InterruptionReason } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface SampleSession {
  id: string;
  userId: string;
  stationId: string;
  connectorId: string;
  chargeType: ChargeType;
  status: 'INTERRUPTED' | 'COMPLETED' | 'ACTIVE';
  segments: {
    type: 'ENERGY' | 'SERVICE';
    startTime: Date;
    endTime: Date;
    kwh: number;
    price: number;
    amount: number;
    isRefundable: boolean;
    refundPercentage: number;
  }[];
}

const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

const sampleSessions: SampleSession[] = [
  {
    id: 'session-normal-001',
    userId: 'user-1001',
    stationId: 'station-a-01',
    connectorId: 'conn-001',
    chargeType: ChargeType.FAST,
    status: 'INTERRUPTED',
    segments: [
      {
        type: 'ENERGY',
        startTime: threeHoursAgo,
        endTime: twoHoursAgo,
        kwh: 30,
        price: 1.2,
        amount: 36,
        isRefundable: true,
        refundPercentage: 100,
      },
      {
        type: 'ENERGY',
        startTime: twoHoursAgo,
        endTime: oneHourAgo,
        kwh: 20,
        price: 1.5,
        amount: 30,
        isRefundable: true,
        refundPercentage: 100,
      },
      {
        type: 'SERVICE',
        startTime: threeHoursAgo,
        endTime: oneHourAgo,
        kwh: 0,
        price: 0,
        amount: 10,
        isRefundable: true,
        refundPercentage: 100,
      },
    ],
  },
  {
    id: 'session-vehicle-issue-001',
    userId: 'user-1002',
    stationId: 'station-a-02',
    connectorId: 'conn-002',
    chargeType: ChargeType.SLOW,
    status: 'INTERRUPTED',
    segments: [
      {
        type: 'ENERGY',
        startTime: threeHoursAgo,
        endTime: oneHourAgo,
        kwh: 15,
        price: 1.0,
        amount: 15,
        isRefundable: true,
        refundPercentage: 100,
      },
      {
        type: 'SERVICE',
        startTime: threeHoursAgo,
        endTime: oneHourAgo,
        kwh: 0,
        price: 0,
        amount: 5,
        isRefundable: true,
        refundPercentage: 100,
      },
    ],
  },
  {
    id: 'session-partial-refund-001',
    userId: 'user-1003',
    stationId: 'station-b-01',
    connectorId: 'conn-003',
    chargeType: ChargeType.ULTRA_FAST,
    status: 'INTERRUPTED',
    segments: [
      {
        type: 'ENERGY',
        startTime: threeHoursAgo,
        endTime: twoHoursAgo,
        kwh: 40,
        price: 1.8,
        amount: 72,
        isRefundable: false,
        refundPercentage: 0,
      },
      {
        type: 'ENERGY',
        startTime: twoHoursAgo,
        endTime: oneHourAgo,
        kwh: 20,
        price: 1.8,
        amount: 36,
        isRefundable: true,
        refundPercentage: 50,
      },
      {
        type: 'SERVICE',
        startTime: threeHoursAgo,
        endTime: oneHourAgo,
        kwh: 0,
        price: 0,
        amount: 15,
        isRefundable: true,
        refundPercentage: 100,
      },
    ],
  },
  {
    id: 'session-completed-001',
    userId: 'user-1004',
    stationId: 'station-c-01',
    connectorId: 'conn-004',
    chargeType: ChargeType.FAST,
    status: 'COMPLETED',
    segments: [
      {
        type: 'ENERGY',
        startTime: threeHoursAgo,
        endTime: oneHourAgo,
        kwh: 50,
        price: 1.2,
        amount: 60,
        isRefundable: true,
        refundPercentage: 100,
      },
    ],
  },
  {
    id: 'session-active-001',
    userId: 'user-1005',
    stationId: 'station-d-01',
    connectorId: 'conn-005',
    chargeType: ChargeType.FAST,
    status: 'ACTIVE',
    segments: [],
  },
];

function clearExistingData(): void {
  const db = getDb();
  db.run('DELETE FROM refund_history');
  db.run('DELETE FROM refund_records');
  db.run('DELETE FROM refund_requests');
  db.run('DELETE FROM billing_segments');
  db.run('DELETE FROM charging_sessions');
  console.log('已清除现有数据');
}

function createSessions(): void {
  console.log('开始创建样例会话...');
  
  const sessionRepo = new ChargingSessionRepository();
  const segmentRepo = new BillingSegmentRepository();
  
  sampleSessions.forEach((sample, index) => {
    const session = sessionRepo.create({
      id: sample.id,
      userId: sample.userId,
      stationId: sample.stationId,
      connectorId: sample.connectorId,
      chargeType: sample.chargeType,
      startTime: threeHoursAgo,
      endTime: sample.status === 'ACTIVE' ? null : oneHourAgo,
      totalRequestedKwh: 100,
      status: sample.status,
    });

    sample.segments.forEach(seg => {
      segmentRepo.create({
        sessionId: session.id,
        segmentType: seg.type,
        startTime: seg.startTime,
        endTime: seg.endTime,
        actualKwh: seg.kwh,
        rateId: `rate-${uuidv4().substring(0, 8)}`,
        unitPrice: seg.price,
        amount: seg.amount,
        isRefundable: seg.isRefundable,
        refundPercentage: seg.refundPercentage,
      });
    });

    console.log(`会话 ${index + 1}: ${session.id} (${sample.status}) - ${sample.segments.length} 个计费片段`);
  });
}

function printUsage(): void {
  console.log('\n==============================');
  console.log('样例数据已创建完成！');
  console.log('==============================');
  console.log('\n可用测试请求 ID:');
  console.log('  1. 正常流程 (设备故障，全额退款):');
  console.log('     REQ-001 (session-normal-001)');
  console.log(`     中断原因: ${InterruptionReason.EQUIPMENT_FAULT}`);
  console.log('\n  2. 异常拦截 (车辆问题，无退款):');
  console.log('     REQ-002 (session-vehicle-issue-001)');
  console.log(`     中断原因: ${InterruptionReason.VEHICLE_ISSUE}`);
  console.log('\n  3. 部分退款 (用户停止，部分片段不可退):');
  console.log('     REQ-003 (session-partial-refund-001)');
  console.log(`     中断原因: ${InterruptionReason.USER_STOP}`);
  console.log('\n  4. 验证失败 (会话已完成):');
  console.log('     REQ-004 (session-completed-001)');
  console.log('\n  5. 验证失败 (会话仍在进行):');
  console.log('     REQ-005 (session-active-001)');
  console.log('\n==============================');
  console.log('测试命令示例:');
  console.log(`  curl -X POST http://localhost:3000/api/v1/refunds/requests \\
    -H "Content-Type: application/json" \\
    -d '{
      "requestId": "REQ-001",
      "sessionId": "session-normal-001",
      "interruptionReason": "EQUIPMENT_FAULT",
      "interruptionTime": "${oneHourAgo.toISOString()}",
      "description": "设备故障导致充电中断"
    }'`);
  console.log('==============================');
}

async function main(): Promise<void> {
  try {
    console.log('开始数据库初始化...');
    await initializeDb();
    
    clearExistingData();
    createSessions();
    printUsage();
    
    closeDb();
    console.log('\n数据初始化完成！');
  } catch (error) {
    console.error('数据初始化失败:', error);
    process.exit(1);
  }
}

main();
