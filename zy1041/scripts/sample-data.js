const db = require('../src/config/database');
const Request = require('../src/models/Request');
const Trip = require('../src/models/Trip');

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(18, 0, 0, 0);

const afternoon = new Date();
afternoon.setHours(17, 0, 0, 0);

const evening = new Date();
evening.setHours(19, 0, 0, 0);

const sampleRequests = [
  {
    requester_id: 'user_alice',
    pickup_location: '星巴克',
    dropoff_location: '2号楼',
    item_type: '咖啡饮料',
    weight: 0.5,
    volume: 1,
    latest_delivery_time: afternoon.toISOString(),
    tip_amount: 8,
    notes: '需要热拿铁，少糖'
  },
  {
    requester_id: 'user_bob',
    pickup_location: '前台',
    dropoff_location: '1号楼',
    item_type: '文件快递',
    weight: 0.3,
    volume: 0.5,
    latest_delivery_time: tomorrow.toISOString(),
    tip_amount: 5,
    notes: '重要文件，请轻拿轻放'
  },
  {
    requester_id: 'user_charlie',
    pickup_location: '便利店',
    dropoff_location: '3号楼',
    item_type: '生鲜水果',
    weight: 3,
    volume: 5,
    latest_delivery_time: evening.toISOString(),
    tip_amount: 15,
    notes: '需要冷藏，尽快送达'
  },
  {
    requester_id: 'user_david',
    pickup_location: '快递柜',
    dropoff_location: '停车场',
    item_type: '大件包裹',
    weight: 15,
    volume: 30,
    latest_delivery_time: evening.toISOString(),
    tip_amount: 25,
    notes: '比较重，需要帮忙搬'
  }
];

const sampleTrips = [
  {
    traveler_id: 'user_tom',
    start_location: '1号楼',
    waypoints: ['星巴克', '前台'],
    destination: '地铁口',
    departure_time: afternoon.toISOString(),
    arrival_time: evening.toISOString(),
    available_capacity_weight: 5,
    available_capacity_volume: 10,
    forbidden_items: []
  },
  {
    traveler_id: 'user_jerry',
    start_location: '2号楼',
    waypoints: ['便利店', '快递柜'],
    destination: '3号楼',
    departure_time: new Date().toISOString(),
    arrival_time: evening.toISOString(),
    available_capacity_weight: 10,
    available_capacity_volume: 20,
    forbidden_items: ['生鲜', '易碎']
  },
  {
    traveler_id: 'user_sam',
    start_location: '地铁口',
    waypoints: ['园区东门', '前台'],
    destination: '1号楼',
    departure_time: new Date().toISOString(),
    arrival_time: evening.toISOString(),
    available_capacity_weight: 20,
    available_capacity_volume: 40,
    forbidden_items: []
  }
];

async function loadSampleData() {
  console.log('开始加载示例数据...\n');

  try {
    for (const req of sampleRequests) {
      const created = await Request.create(req);
      console.log(`✓ 创建请求单: ${created.id}`);
      console.log(`  发起人: ${req.requester_id}`);
      console.log(`  路线: ${req.pickup_location} → ${req.dropoff_location}`);
      console.log(`  物品: ${req.item_type} (${req.weight}kg/${req.volume}L)`);
      console.log(`  小费: ¥${req.tip_amount}\n`);
    }

    for (const trip of sampleTrips) {
      const created = await Trip.create(trip);
      console.log(`✓ 创建行程: ${created.id}`);
      console.log(`  顺路人: ${trip.traveler_id}`);
      console.log(`  路线: ${trip.start_location} → ${trip.waypoints.join(' → ')} → ${trip.destination}`);
      console.log(`  容量: ${trip.available_capacity_weight}kg/${trip.available_capacity_volume}L`);
      console.log(`  禁带品: ${trip.forbidden_items.length > 0 ? trip.forbidden_items.join(', ') : '无'}\n`);
    }

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║   🎉 示例数据加载完成！                                    ║');
    console.log('║                                                            ║');
    console.log('║   已创建:                                                  ║');
    console.log('║   - 4个请求单 (requests)                                   ║');
    console.log('║   - 3个行程 (trips)                                        ║');
    console.log('║                                                            ║');
    console.log('║   测试场景说明:                                             ║');
    console.log('║                                                            ║');
    console.log('║   1. 正常匹配:                                              ║');
    console.log('║      - Alice的咖啡请求 (星巴克→2号楼)                      ║');
    console.log('║      → 匹配 Tom的行程 (1号楼→星巴克→前台→地铁口)          ║');
    console.log('║      ✓ 路线匹配: 星巴克在Tom的路线上                        ║');
    console.log('║      ✓ 容量匹配: 0.5kg ≤ 5kg                               ║');
    console.log('║                                                            ║');
    console.log('║   2. 禁带品过滤:                                            ║');
    console.log('║      - Charlie的生鲜水果请求                                ║');
    console.log('║      → 被 Jerry的行程过滤 (禁带品包含"生鲜")                ║');
    console.log('║      → 但会匹配 Sam的行程 (无禁带品)                       ║');
    console.log('║                                                            ║');
    console.log('║   3. 容量限制:                                              ║');
    console.log('║      - David的大件包裹 (15kg)                               ║');
    console.log('║      → 被 Tom(5kg)和Jerry(10kg)过滤                       ║');
    console.log('║      → 只能匹配 Sam(20kg)                                  ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('加载示例数据失败:', error);
    process.exit(1);
  }
}

loadSampleData().then(() => {
  process.exit(0);
});
