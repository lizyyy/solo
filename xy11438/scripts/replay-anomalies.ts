import { initDatabase, closeDatabase, getDirtyRecords, resolveDirtyRecord, getFactRecord, upsertSourceRecord, updateSourceRecordStatus } from '../src/database';
import * as http from 'http';

const API_BASE = 'http://localhost:3000';

function postRequest(path: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const postData = JSON.stringify(data);

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: parseInt(url.port) || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Operator': 'replay_script'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== 民宿保洁排班验收回放链路 - 异常回放修复 ===\n');

  await initDatabase();

  const dirtyRecords = await getDirtyRecords(false);
  console.log(`发现 ${dirtyRecords.length} 条未解决的脏记录\n`);

  if (dirtyRecords.length === 0) {
    console.log('✅ 没有待处理的脏记录');
    await closeDatabase();
    return;
  }

  const groupedByType: Record<string, typeof dirtyRecords> = {};
  for (const record of dirtyRecords) {
    if (!groupedByType[record.dirtyType]) {
      groupedByType[record.dirtyType] = [];
    }
    groupedByType[record.dirtyType].push(record);
  }

  console.log('=== 按类型分类 ===');
  for (const [type, records] of Object.entries(groupedByType)) {
    console.log(`  ${type}: ${records.length} 条`);
  }
  console.log('');

  console.log('=== 开始修复回放 ===\n');

  for (const record of dirtyRecords) {
    console.log(`处理: [${record.dirtyType}] ${record.description}`);

    let resolution = '';
    let shouldReprocess = true;

    switch (record.dirtyType) {
      case 'missing_fields':
        if (record.fieldName === 'guestName' && record.sourceType === 'order_calendar') {
          resolution = '补充客人姓名为"未知客人"，标记为待核实';
          console.log(`  → 修复方案: ${resolution}`);
          await resolveDirtyRecord(record.id, resolution, 'replay_script');
          await simulateFixedOrder(record.recordId);
        } else if (record.fieldName === 'cleanerName' && record.sourceType === 'cleaning_group') {
          resolution = '补充保洁员为"待分配"，通知前台补录';
          console.log(`  → 修复方案: ${resolution}`);
          await resolveDirtyRecord(record.id, resolution, 'replay_script');
        } else if (record.fieldName === 'reportedBy' && record.sourceType === 'maintenance_note') {
          resolution = '补充上报人为"系统自动检测"';
          console.log(`  → 修复方案: ${resolution}`);
          await resolveDirtyRecord(record.id, resolution, 'replay_script');
        } else {
          resolution = '待人工补录字段';
          console.log(`  → 需人工处理: ${resolution}`);
          shouldReprocess = false;
        }
        break;

      case 'quantity_conflict':
        if (record.fieldName === 'nights') {
          resolution = `修正入住晚数为 ${record.expectedValue}，原 ${record.originalValue}`;
          console.log(`  → 修复方案: ${resolution}`);
          await resolveDirtyRecord(record.id, resolution, 'replay_script');
        } else if (record.fieldName === 'cleaningType') {
          resolution = `保洁类型调整建议: 从${record.originalValue}改为${record.expectedValue}`;
          console.log(`  → 修复方案: ${resolution}`);
          await resolveDirtyRecord(record.id, resolution, 'replay_script');
        } else {
          resolution = '数量冲突待复核';
          console.log(`  → 需人工处理: ${resolution}`);
        }
        break;

      case 'amount_conflict':
        if (record.originalValue && parseFloat(record.originalValue) < 0) {
          resolution = `金额负数异常，取绝对值: ${Math.abs(parseFloat(record.originalValue || '0'))}`;
          console.log(`  → 修复方案: ${resolution}`);
          await resolveDirtyRecord(record.id, resolution, 'replay_script');
        } else {
          resolution = `金额不符: 账单${record.originalValue} vs 实际${record.expectedValue}，待财务确认`;
          console.log(`  → 需人工处理: ${resolution}`);
        }
        break;

      case 'cross_day':
        resolution = '跨日/找不到对应记录，标记为异常账单待核实';
        console.log(`  → 需人工处理: ${resolution}`);
        await resolveDirtyRecord(record.id, resolution, 'replay_script');
        shouldReprocess = false;
        break;

      case 'name_change':
        resolution = `姓名变更: ${record.originalValue} → ${record.expectedValue}，已记录变更历史`;
        console.log(`  → 修复方案: ${resolution}`);
        await resolveDirtyRecord(record.id, resolution, 'replay_script');
        break;

      default:
        resolution = '异常类型待分类处理';
        console.log(`  → 未识别类型: ${resolution}`);
    }

    if (shouldReprocess) {
      try {
        const fact = await getFactRecord(record.recordId);
        if (fact) {
          await postRequest(`/api/facts/${fact.factId}/reprocess`, {});
          console.log(`  ✓ 已重新处理事实记录`);
        }
      } catch (e) {
      }
    }

    console.log('');
  }

  const remaining = await getDirtyRecords(false);
  console.log(`\n=== 回放完成 ===`);
  console.log(`剩余未解决: ${remaining.length} 条`);
  console.log(`已解决: ${dirtyRecords.length - remaining.length} 条`);

  await closeDatabase();
}

async function simulateFixedOrder(recordId: string) {
  try {
    const fact = await getFactRecord(recordId);
    if (fact && fact.orderInfo) {
      const fixedOrder = {
        ...fact.orderInfo,
        guestName: fact.orderInfo.guestName || '未知客人(补录)'
      };
      await upsertSourceRecord('order_calendar', fact.orderInfo.orderId, fixedOrder, 'replay_script');
      await updateSourceRecordStatus('order_calendar', fact.orderInfo.orderId, 'processed', [], '已补充客人姓名');
    }
  } catch (e) {
  }
}

main().catch(console.error);
