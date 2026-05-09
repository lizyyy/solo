exports.up = function(knex) {
  return knex.schema
    .createTable('departments', function(table) {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.string('code').notNullable().unique();
      table.uuid('parent_id').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('budgets', function(table) {
      table.uuid('id').primary();
      table.uuid('department_id').notNullable().references('id').inTable('departments');
      table.string('budget_type').notNullable();
      table.string('fiscal_year').notNullable();
      table.decimal('total_amount', 15, 2).notNullable().defaultTo(0);
      table.decimal('used_amount', 15, 2).notNullable().defaultTo(0);
      table.decimal('locked_amount', 15, 2).notNullable().defaultTo(0);
      table.decimal('available_amount', 15, 2).notNullable().defaultTo(0);
      table.timestamp('start_date').notNullable();
      table.timestamp('end_date').notNullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('version').notNullable().defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['department_id', 'budget_type', 'fiscal_year']);
    })
    .createTable('budget_locks', function(table) {
      table.uuid('id').primary();
      table.uuid('budget_id').notNullable().references('id').inTable('budgets');
      table.uuid('department_id').notNullable().references('id').inTable('departments');
      table.string('application_id').notNullable().unique();
      table.string('application_type').notNullable();
      table.decimal('amount', 15, 2).notNullable();
      table.enum('status', ['ACTIVE', 'RELEASED', 'COMMITTED']).notNullable().defaultTo('ACTIVE');
      table.timestamp('expires_at').notNullable();
      table.string('created_by').notNullable();
      table.string('reason').nullable();
      table.integer('version').notNullable().defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['budget_id', 'status']);
      table.index(['application_id']);
      table.index(['department_id', 'status']);
    })
    .createTable('approval_records', function(table) {
      table.uuid('id').primary();
      table.uuid('budget_lock_id').nullable().references('id').inTable('budget_locks');
      table.string('application_id').notNullable();
      table.enum('status', ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).notNullable().defaultTo('PENDING');
      table.string('current_approver').nullable();
      table.string('approval_level').nullable();
      table.text('reject_reason').nullable();
      table.string('approved_by').nullable();
      table.timestamp('approved_at').nullable();
      table.integer('version').notNullable().defaultTo(1);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['application_id']);
      table.index(['status']);
    })
    .createTable('transaction_logs', function(table) {
      table.uuid('id').primary();
      table.string('operation_type').notNullable();
      table.uuid('reference_id').nullable();
      table.string('reference_type').nullable();
      table.uuid('budget_id').nullable();
      table.uuid('department_id').nullable();
      table.decimal('amount', 15, 2).nullable();
      table.string('old_status').nullable();
      table.string('new_status').nullable();
      table.string('operator').notNullable();
      table.text('details').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['reference_id', 'reference_type']);
      table.index(['budget_id', 'operation_type']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('transaction_logs')
    .dropTableIfExists('approval_records')
    .dropTableIfExists('budget_locks')
    .dropTableIfExists('budgets')
    .dropTableIfExists('departments');
};
