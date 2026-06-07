import { initDatabase, db } from './database';

initDatabase();

const stmt = db.prepare('SELECT * FROM annotation_records');
const records = stmt.all();
console.log('Records:', JSON.stringify(records, null, 2));
console.log('Count:', records.length);
