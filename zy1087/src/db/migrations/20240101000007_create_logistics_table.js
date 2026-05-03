exports.up = function(knex) {
  return knex.schema.createTable('logistics', function(table) {
    table.uuid('id').primary();
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.enum('type', ['shipping', 'return']).notNullable().defaultTo('shipping');
    table.string('logistics_company');
    table.string('tracking_number');
    table.enum('status', ['pending', 'shipped', 'in_transit', 'delivered', 'returned', 'lost']).notNullable().defaultTo('pending');
    table.string('sender_name');
    table.string('sender_phone');
    table.text('sender_address');
    table.string('receiver_name');
    table.string('receiver_phone');
    table.text('receiver_address');
    table.datetime('shipped_at');
    table.datetime('delivered_at');
    table.datetime('estimated_delivery_at');
    table.json('tracking_history');
    table.text('notes');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('logistics');
};
