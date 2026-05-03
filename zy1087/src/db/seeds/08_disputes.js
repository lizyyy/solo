exports.seed = function(knex) {
  return knex('disputes').del()
    .then(function () {
      return knex('disputes').insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440701',
          order_id: '550e8400-e29b-41d4-a716-446655440201',
          raised_by: '550e8400-e29b-41d4-a716-446655440002',
          reason: '买家发现屏幕有一道明显划痕，但卖家描述中只说是"轻微划痕"，认为成色描述不符，要求降价500元或退货。',
          responsibility: 'undecided',
          suggestion: '建议双方提供更多照片证据，管理员将根据证据判断责任归属。',
          status: 'open',
          evidence_urls: JSON.stringify(['https://example.com/dispute/photo1.jpg', 'https://example.com/dispute/photo2.jpg']),
          escalation_hours: 48,
          assigned_to: '550e8400-e29b-41d4-a716-446655440003'
        }
      ]);
    });
};
