const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('\n❌ 配置文件缺失: .env');
  console.error('💡 请复制 .env.example 为 .env 并配置参数\n');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

const requiredConfigs = ['PORT', 'DB_PATH'];
const missingConfigs = requiredConfigs.filter(key => !process.env[key]);

if (missingConfigs.length > 0) {
  console.error('\n❌ 缺少必要配置项:', missingConfigs.join(', '));
  console.error('💡 请检查 .env 文件配置\n');
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || './data/pet_foster.db',
  nodeEnv: process.env.NODE_ENV || 'development'
};
