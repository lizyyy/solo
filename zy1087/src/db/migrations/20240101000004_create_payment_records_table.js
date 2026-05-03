exports.up = function(knex) {
  return knex.schema.createTable('payment_records', function(table) {
    table.uuid('id').primary();
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.enum('type', ['deposit', 'balance', 'refund']).notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.enum('status', ['pending', 'frozen', 'released', 'refunded']).notNullable().defaultTo('pending');
    table.enum('payment_method', ['wechat', 'alipay', 'bank_transfer', 'cash', 'other']).defaultTo('other');
    table.string('transaction_id');
    table.text('reason').notNullable();
    table.json('evidence_urls');
    table.uuid('created_by').references('id').inTable('users');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('payment_records');
};
