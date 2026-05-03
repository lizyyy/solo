exports.up = function(knex) {
  return knex.schema.createTable('orders', function(table) {
    table.uuid('id').primary();
    table.string('order_number').unique().notNullable();
    table.uuid('buyer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('seller_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.decimal('final_price', 10, 2).notNullable();
    table.decimal('deposit_amount', 10, 2).notNullable();
    table.decimal('balance_amount', 10, 2).notNullable();
    table.enum('status', [
      'draft',
      'deposit_locked',
      'shipped',
      'buyer_inspecting',
      'released',
      'partially_refunded',
      'disputed',
      'completed',
      'closed'
    ]).notNullable().defaultTo('draft');
    table.text('notes');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('orders');
};
