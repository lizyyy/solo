const fs = require('fs');
const path = require('path');
const store = require('../data/store');
const { createBusCardPeriod, WORKFLOW_STAGE } = require('../data/models');

const samplePoints = [
  {
    name: '文化路-新华路口（照片0张）',
    lat: 39.9042,
    lng: 116.4074,
    streets: ['文化路街道'],
    notes: '阿宁备注：这是一个照片数为0的样例点位，保留不删除。\n现场情况：路口西北角有小学，早高峰送孩子的车特别多。',
    createdBy: '阿宁'
  },
  {
    name: '和平路-建设大街交口（边界待复核）',
    lat: 39.9123,
    lng: 116.4156,
    streets: ['和平街道', '建设街道'],
    notes: '阿宁备注：点位正好在两个街道的边界线上。\n现场照片显示路口归属牌两边都有，需要和两个街道主任确认。',
    createdBy: '阿宁'
  },
  {
    name: '人民路-中山路口（有公交刷卡数据）',
    lat: 39.9201,
    lng: 116.4234,
    streets: ['人民路街道'],
    notes: '阿宁初始备注：2026年5月现场踏勘，人流量大，公交站有3条线路。',
    createdBy: '阿宁',
    busCards: [
      {
        period: '早高峰 7:00-9:00',
        passengerVolume: '1850人次',
        rawText: '阿宁备注：早高峰7-9点刷卡量最大，主要是上班族和买菜老人。\n建议：和路口东侧的阳光小区错峰共享，他们7-9点是出车高峰，可以反向利用。',
        notes: '阿宁备注：早高峰7-9点刷卡量最大，主要是上班族和买菜老人。\n建议：和路口东侧的阳光小区错峰共享，他们7-9点是出车高峰，可以反向利用。'
      },
      {
        period: '晚高峰 17:30-19:30',
        passengerVolume: '2100人次',
        rawText: '阿宁备注：晚高峰比早高峰还堵！\n接孩子的家长集中在17:30-18:30，然后是下班族18:30-19:30。\n和路口南侧的第一小学停车场可以错峰。',
        notes: '阿宁备注：晚高峰比早高峰还堵！\n接孩子的家长集中在17:30-18:30，然后是下班族18:30-19:30。\n和路口南侧的第一小学停车场可以错峰。'
      }
    ]
  },
  {
    name: '解放路-胜利街口（边界已确认）',
    lat: 39.9289,
    lng: 116.4312,
    streets: ['解放路街道', '胜利街道'],
    assignedStreet: '解放路街道',
    notes: '阿宁备注：边界点位，已与两个街道主任开会确认归属解放路街道。\n胜利街道同意共同管理停车资源。',
    createdBy: '阿宁',
    overrideBoundary: 'boundary_confirmed'
  },
  {
    name: '朝阳路-工农路口（照片数0，待补）',
    lat: 39.9356,
    lng: 116.4398,
    streets: ['朝阳路街道'],
    notes: '阿宁备注：这个点位还没去现场拍照片，先占位。\n现场预计有一个大型超市，停车需求大。',
    createdBy: '阿宁'
  }
];

function initSampleData() {
  console.log('🚀 开始初始化现场样例数据...\n');
  
  const existingPoints = store.listPoints();
  if (existingPoints.length > 0) {
    console.log(`⚠️  已有 ${existingPoints.length} 个点位数据，跳过初始化。`);
    console.log('   如需重置，请先删除 data/points.json 文件。\n');
    return;
  }
  
  for (const sp of samplePoints) {
    const addResult = store.addPoint({
      name: sp.name,
      lat: sp.lat,
      lng: sp.lng,
      streets: sp.streets,
      notes: sp.notes,
      createdBy: sp.createdBy
    });
    
    const pointId = addResult.point.id;
    console.log(`✅ 创建点位: ${sp.name}`);
    console.log(`   边界状态: ${addResult.point.boundaryStatus}`);
    
    if (sp.overrideBoundary) {
      store.updatePoint(pointId, {
        boundaryStatus: sp.overrideBoundary,
        assignedStreet: sp.assignedStreet || null
      }, {
        action: 'sample_data_init',
        reason: '初始化样例数据，模拟边界已确认状态',
        modifiedBy: '系统初始化'
      });
      console.log(`   → 覆盖边界状态为: ${sp.overrideBoundary}`);
    }
    
    if (sp.busCards && sp.busCards.length > 0) {
      for (const bc of sp.busCards) {
        const busCardPeriod = createBusCardPeriod(bc, pointId, '阿宁');
        store.addBusCardPeriod(pointId, busCardPeriod);
        console.log(`   → 补充公交刷卡: ${bc.period}`);
      }
      store.updatePoint(pointId, {
        workflowStage: WORKFLOW_STAGE.BUS_CARD_SUPPLEMENTED
      }, {
        action: 'sample_data_init',
        reason: '初始化样例数据，补充公交刷卡后推进工作流',
        modifiedBy: '系统初始化'
      });
      console.log(`   → 工作流推进到: ${WORKFLOW_STAGE.BUS_CARD_SUPPLEMENTED}`);
    }
    
    console.log();
  }
  
  console.log('🎉 样例数据初始化完成！');
  console.log(`   共创建 ${samplePoints.length} 个点位：`);
  console.log(`   - 照片数为0的点位：2 个（验证保留显示）`);
  console.log(`   - 边界待复核点位：1 个（验证边界规则）`);
  console.log(`   - 边界已确认点位：1 个（验证地图导出）`);
  console.log(`   - 有公交刷卡数据：1 个（验证备注保留）`);
  console.log();
  console.log('📝 接下来可以：');
  console.log('   1. 启动服务器 npm start');
  console.log('   2. 访问 http://localhost:3000');
  console.log('   3. 按普通使用者路线走三步工作流');
}

initSampleData();
