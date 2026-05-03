exports.up = function(knex) {
  return knex.schema.createTable('inspection_reports', function(table) {
    table.uuid('id').primary();
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.uuid('submitted_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('overall_result', ['pass', 'partial', 'fail']).notNullable();
    table.text('notes');
    table.json('additional_evidence_urls');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('inspection_reports');
};
