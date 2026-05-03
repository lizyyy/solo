exports.up = function(knex) {
  return knex.schema.createTable('disputes', function(table) {
    table.uuid('id').primary();
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.uuid('raised_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('reason').notNullable();
    table.enum('responsibility', ['buyer', 'seller', 'mutual', 'undecided']).defaultTo('undecided');
    table.text('suggestion');
    table.enum('status', ['open', 'processing', 'resolved', 'closed']).notNullable().defaultTo('open');
    table.json('evidence_urls');
    table.text('resolution_details');
    table.decimal('refund_amount', 10, 2);
    table.integer('escalation_hours').defaultTo(48);
    table.datetime('escalated_at');
    table.datetime('resolved_at');
    table.uuid('assigned_to').references('id').inTable('users');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('disputes');
};
