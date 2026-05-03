exports.seed = function(knex) {
  return knex('products').del()
    .then(function () {
      return knex('products').insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440101',
          seller_id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'iPhone 13 Pro Max 256GB 远峰蓝',
          description: '自用一年，保养良好，无磕碰，屏幕轻微划痕，电池健康89%。原装配件齐全，带原包装盒。',
          category: 'phone',
          brand: 'Apple',
          model: 'iPhone 13 Pro Max',
          serial_number_suffix: '2345',
          condition: 'good',
          accessories: JSON.stringify(['charger', 'cable', 'case', 'original_box']),
          specs: JSON.stringify({
            battery_health: 89,
            storage: '256GB',
            color: '远峰蓝',
            network: '全网通5G'
          }),
          price: 5999.00,
          deposit_ratio: 0.3,
          status: 'available'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440102',
          seller_id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Sony A7M4 全画幅微单相机',
          description: '98新，快门次数约12000次，自用拍摄vlog，无维修记录。带原装电池2块，充电器，相机包。',
          category: 'camera',
          brand: 'Sony',
          model: 'Alpha 7 IV (A7M4)',
          serial_number_suffix: '7890',
          condition: 'excellent',
          accessories: JSON.stringify(['battery_x2', 'charger', 'camera_bag', 'strap']),
          specs: JSON.stringify({
            shutter_count: 12000,
            sensor: '全画幅',
            megapixels: '3300万',
            video: '4K 60fps'
          }),
          price: 14999.00,
          deposit_ratio: 0.2,
          status: 'available'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440103',
          seller_id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'AirPods Pro 2 代 USB-C 版本',
          description: '使用半年，功能完好，降噪正常，续航约6小时。充电盒有轻微划痕，耳塞齐全。',
          category: 'headphone',
          brand: 'Apple',
          model: 'AirPods Pro 2 (USB-C)',
          serial_number_suffix: '4567',
          condition: 'good',
          accessories: JSON.stringify(['charging_case', 'ear_tips_s', 'ear_tips_m', 'ear_tips_l']),
          specs: JSON.stringify({
            battery_life: '6小时',
            charging: 'USB-C',
            features: ['主动降噪', '空间音频', '通透模式']
          }),
          price: 1299.00,
          deposit_ratio: 0.3,
          status: 'available'
        }
      ]);
    });
};
