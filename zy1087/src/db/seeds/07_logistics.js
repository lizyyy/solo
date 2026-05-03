exports.seed = function(knex) {
  return knex('logistics').del()
    .then(function () {
      return knex('logistics').insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440601',
          order_id: '550e8400-e29b-41d4-a716-446655440203',
          type: 'shipping',
          logistics_company: '顺丰速运',
          tracking_number: 'SF1234567890123',
          status: 'delivered',
          sender_name: '张三',
          sender_phone: '13800138001',
          sender_address: '北京市朝阳区建国路88号',
          receiver_name: '李四',
          receiver_phone: '13800138002',
          receiver_address: '上海市浦东新区世纪大道100号',
          shipped_at: '2024-01-03 10:00:00',
          delivered_at: '2024-01-04 14:30:00',
          estimated_delivery_at: '2024-01-05 00:00:00',
          tracking_history: JSON.stringify([
            { time: '2024-01-03 10:00:00', status: '已揽收', location: '北京市朝阳区' },
            { time: '2024-01-03 15:00:00', status: '已发出', location: '北京转运中心' },
            { time: '2024-01-04 08:00:00', status: '到达目的地', location: '上海市浦东新区' },
            { time: '2024-01-04 14:30:00', status: '已签收', location: '上海市浦东新区' }
          ]),
          notes: '顺丰次日达，买家已签收'
        }
      ]);
    });
};
