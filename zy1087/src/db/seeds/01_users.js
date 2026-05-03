const bcrypt = require('bcryptjs');

const passwordHash = bcrypt.hashSync('Secure123!', 10);

exports.seed = function(knex) {
  return knex('users').del()
    .then(function () {
      return knex('users').insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: '张三（卖家）',
          email: 'seller@example.com',
          password_hash: passwordHash,
          phone: '13800138001',
          avatar_url: 'https://example.com/avatars/seller.jpg'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: '李四（买家）',
          email: 'buyer@example.com',
          password_hash: passwordHash,
          phone: '13800138002',
          avatar_url: 'https://example.com/avatars/buyer.jpg'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: '王五（管理员）',
          email: 'admin@example.com',
          password_hash: passwordHash,
          phone: '13800138003',
          avatar_url: 'https://example.com/avatars/admin.jpg'
        }
      ]);
    });
};
