exports.up = function(knex) {
  return knex.schema.createTable('inspection_items', function(table) {
    table.uuid('id').primary();
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');
    table.enum('result', ['pass', 'fail', 'na', 'pending']).notNullable().defaultTo('pending');
    table.json('evidence_urls');
    table.text('notes');
    table.integer('sort_order').defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('inspection_items');
};
