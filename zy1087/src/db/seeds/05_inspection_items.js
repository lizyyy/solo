exports.seed = function(knex) {
  return knex('inspection_items').del()
    .then(function () {
      return knex('inspection_items').insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440401',
          order_id: '550e8400-e29b-41d4-a716-446655440203',
          name: '外观成色检查',
          description: '检查耳机本体和充电盒是否有明显划痕、磕碰',
          result: 'pass',
          evidence_urls: JSON.stringify(['https://example.com/inspection/photo1.jpg', 'https://example.com/inspection/photo2.jpg']),
          notes: '充电盒有轻微划痕，与描述一致',
          sort_order: 1
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440402',
          order_id: '550e8400-e29b-41d4-a716-446655440203',
          name: '功能测试',
          description: '测试连接、降噪、通透模式、触控操作',
          result: 'pass',
          evidence_urls: JSON.stringify(['https://example.com/inspection/video1.mp4']),
          notes: '所有功能正常，降噪效果良好',
          sort_order: 2
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440403',
          order_id: '550e8400-e29b-41d4-a716-446655440203',
          name: '配件检查',
          description: '确认所有配件齐全（耳塞S/M/L、充电线）',
          result: 'pass',
          evidence_urls: JSON.stringify(['https://example.com/inspection/photo3.jpg']),
          notes: '三副耳塞都有，充电线原装',
          sort_order: 3
        }
      ]);
    });
};
