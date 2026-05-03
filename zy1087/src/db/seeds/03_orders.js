exports.seed = function(knex) {
  return knex('orders').del()
    .then(function () {
      return knex('orders').insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440201',
          order_number: 'ORD-20240101-0001',
          buyer_id: '550e8400-e29b-41d4-a716-446655440002',
          seller_id: '550e8400-e29b-41d4-a716-446655440001',
          product_id: '550e8400-e29b-41d4-a716-446655440101',
          final_price: 5800.00,
          deposit_amount: 1740.00,
          balance_amount: 4060.00,
          status: 'draft',
          notes: '买家希望当面验货后再确认尾款'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440202',
          order_number: 'ORD-20240102-0002',
          buyer_id: '550e8400-e29b-41d4-a716-446655440002',
          seller_id: '550e8400-e29b-41d4-a716-446655440001',
          product_id: '550e8400-e29b-41d4-a716-446655440102',
          final_price: 14500.00,
          deposit_amount: 2900.00,
          balance_amount: 11600.00,
          status: 'deposit_locked',
          notes: '订金已锁定，等待卖家发货'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440203',
          order_number: 'ORD-20240103-0003',
          buyer_id: '550e8400-e29b-41d4-a716-446655440002',
          seller_id: '550e8400-e29b-41d4-a716-446655440001',
          product_id: '550e8400-e29b-41d4-a716-446655440103',
          final_price: 1200.00,
          deposit_amount: 360.00,
          balance_amount: 840.00,
          status: 'completed',
          notes: '交易已完成，双方满意'
        }
      ]);
    });
};
