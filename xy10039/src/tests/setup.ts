import { sequelize, connectDatabase } from '../config/database';

export async function setupTestDatabase(): Promise<void> {
  await connectDatabase();
  await sequelize.sync({ force: true });
}

beforeAll(async () => {
  await setupTestDatabase();
});
