exports.up = function(knex) {
  return knex.schema.createTable('products', function(table) {
    table.uuid('id').primary();
    table.uuid('seller_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('description');
    table.enum('category', ['phone', 'camera', 'headphone', 'laptop', 'tablet', 'other']).notNullable().defaultTo('other');
    table.string('brand');
    table.string('model');
    table.string('serial_number_suffix', 4);
    table.enum('condition', ['excellent', 'good', 'fair', 'poor']).notNullable().defaultTo('good');
    table.json('accessories');
    table.json('specs');
    table.decimal('price', 10, 2).notNullable();
    table.decimal('deposit_ratio', 3, 2).notNullable().defaultTo(0.3);
    table.enum('status', ['available', 'reserved', 'sold', 'removed']).notNullable().defaultTo('available');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('products');
};
