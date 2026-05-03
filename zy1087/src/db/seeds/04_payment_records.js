exports.seed = function(knex) {
  return knex('payment_records').del()
    .then(function () {
      return knex('payment_records').insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440301',
          order_id: '550e8400-e29b-41d4-a716-446655440202',
          type: 'deposit',
          amount: 2900.00,
          status: 'frozen',
          payment_method: 'wechat',
          transaction_id: 'wx_20240102_0001',
          reason: '订单订金锁定',
          created_by: '550e8400-e29b-41d4-a716-446655440002'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440302',
          order_id: '550e8400-e29b-41d4-a716-446655440203',
          type: 'deposit',
          amount: 360.00,
          status: 'released',
          payment_method: 'alipay',
          transaction_id: 'ali_20240103_0001',
          reason: '订单订金已释放给卖家',
          created_by: '550e8400-e29b-41d4-a716-446655440002'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440303',
          order_id: '550e8400-e29b-41d4-a716-446655440203',
          type: 'balance',
          amount: 840.00,
          status: 'released',
          payment_method: 'alipay',
          transaction_id: 'ali_20240103_0002',
          reason: '订单尾款已释放给卖家',
          created_by: '550e8400-e29b-41d4-a716-446655440002'
        }
      ]);
    });
};
