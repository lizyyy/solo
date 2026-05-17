import db from '../models/database';
import { initDatabase } from '../models/database';

beforeAll(() => {
  initDatabase();
});

beforeEach(() => {
  db.exec('DELETE FROM match_histories');
  db.exec('DELETE FROM match_records');
  db.exec('DELETE FROM entry_records');
  db.exec('DELETE FROM payment_records');
});

afterAll(() => {
  db.close();
});
