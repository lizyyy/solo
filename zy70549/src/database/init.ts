import { initDatabase, initializeSchema } from './index';

async function main() {
  try {
    const db = await initDatabase();
    await initializeSchema(db);
    console.log('Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

main();
