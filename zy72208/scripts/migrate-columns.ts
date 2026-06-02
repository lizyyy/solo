import db from '../api/db/index.js';

const columns = [
  'source_file TEXT DEFAULT \'\'',
  'source_type TEXT DEFAULT \'SCREENSHOT\'',
  'imported_by TEXT',
  'imported_at TEXT',
  'risk_reviewed_by TEXT',
  'risk_reviewed_at TEXT',
  'audited_by TEXT',
  'audited_at TEXT',
  'warning_count INTEGER DEFAULT 0',
  'has_mixed_currency INTEGER DEFAULT 0',
  'total_commission_amount REAL DEFAULT 0',
  'total_tax_amount REAL DEFAULT 0',
  'total_net_amount REAL DEFAULT 0'
];

for (const col of columns) {
  try {
    db.prepare(`ALTER TABLE settlement_batches ADD COLUMN ${col}`).run();
    console.log('Added column:', col.split(' ')[0]);
  } catch (e: any) {
    console.log('Column exists:', col.split(' ')[0]);
  }
}

const tableInfo = db.prepare('PRAGMA table_info(settlement_batches)').all() as any[];
console.log('\nCurrent columns:', tableInfo.map(c => c.name).join(', '));

const batches = db.prepare('SELECT id FROM settlement_batches').all() as { id: string }[];
console.log('\nUpdating', batches.length, 'existing batches...');

for (const batch of batches) {
  const details = db.prepare(`
    SELECT 
      commission_amount,
      tax_rate,
      net_amount,
      has_mixed_currency,
      status
    FROM settlement_details 
    WHERE batch_id = ?
  `).all(batch.id) as any[];

  const totalCommission = details.reduce((sum, d) => sum + d.commission_amount, 0);
  const totalTax = details.reduce((sum, d) => sum + (d.tax_rate ? d.commission_amount * d.tax_rate : 0), 0);
  const totalNet = details.reduce((sum, d) => sum + d.net_amount, 0);
  const mixedCount = details.filter(d => d.has_mixed_currency).length;
  const warningCount = details.filter(d => d.status === 'EXCEPTION' || d.status === 'PENDING_REVIEW').length;

  db.prepare(`
    UPDATE settlement_batches 
    SET total_commission_amount = ?,
        total_tax_amount = ?,
        total_net_amount = ?,
        has_mixed_currency = ?,
        warning_count = ?,
        imported_by = import_operator,
        imported_at = import_date,
        source_file = '除权日截图.xlsx',
        source_type = 'SCREENSHOT'
    WHERE id = ?
  `).run(totalCommission, totalTax, totalNet, mixedCount, warningCount, batch.id);
  
  console.log(`  Updated batch ${batch.id.slice(0, 8)}...`);
}

console.log('\nMigration completed successfully!');
