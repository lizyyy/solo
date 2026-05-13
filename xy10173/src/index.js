const createApp = require('./app');
const { getDbPath } = require('./config/database');

async function start() {
  const app = await createApp();
  
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`Points Freeze API is running on http://localhost:${PORT}`);
    console.log(`Database: ${getDbPath()}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
