import { runQuery } from '../database';
import { createExternalSystem } from '../services/externalSystem.service';
import { pullSlotsFromSystem } from '../services/slot.service';

async function seed() {
  console.log('开始初始化数据...');
  
  const systems = [
    { name: 'HIS系统A', code: 'HIS_A', config: JSON.stringify({ endpoint: 'http://his-a.example.com' }) },
    { name: 'HIS系统B', code: 'HIS_B', config: JSON.stringify({ endpoint: 'http://his-b.example.com' }) },
    { name: '预约平台', code: 'APPT_PLATFORM', config: JSON.stringify({ endpoint: 'http://appt.example.com' }) }
  ];
  
  for (const system of systems) {
    try {
      await createExternalSystem(system);
      console.log(`创建外部系统: ${system.name}`);
    } catch (error: any) {
      console.log(`外部系统已存在: ${system.name}`);
    }
  }
  
  const { allQuery } = await import('../database');
  const systemIds = await allQuery('SELECT id FROM external_systems LIMIT 1');
  
  if (systemIds.length > 0) {
    const dates = ['2024-01-15', '2024-01-16', '2024-01-17'];
    for (const date of dates) {
      await pullSlotsFromSystem(systemIds[0].id, date);
      console.log(`拉取号源数据: ${date}`);
    }
  }
  
  console.log('数据初始化完成!');
}

seed().catch(console.error);
