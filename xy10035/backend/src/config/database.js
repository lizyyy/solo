const mongoose = require('mongoose');

let isConnected = false;
let fallbackMode = false;
let inMemoryLogs = [];
let inMemorySessions = [];
let inMemoryReports = [];
let logIdCounter = 1;
let sessionIdCounter = 1;
let reportIdCounter = 1;

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/log_analyzer';
  const skipMongo = process.env.SKIP_MONGO === 'true' || process.env.SKIP_MONGO === '1';
  
  if (skipMongo) {
    console.log('⚠️  SKIP_MONGO 环境变量已设置，启用内存降级模式');
    fallbackMode = true;
    isConnected = true;
    console.log('✅  内存存储模式启动成功');
    return;
  }

  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    
    isConnected = true;
    console.log('✅  MongoDB 连接成功');
  } catch (error) {
    console.warn('⚠️  MongoDB 连接失败:', error.message);
    console.warn('⚠️  正在切换到内存降级模式...');
    
    fallbackMode = true;
    isConnected = true;
    
    console.log('✅  已切换到内存降级模式。注意：重启后数据将丢失。');
    console.log('   如需使用 MongoDB，请启动 MongoDB 后重启服务，');
    console.log('   或设置环境变量 MONGO_URI 指定 MongoDB 地址。');
  }
};

const isInFallbackMode = () => fallbackMode;
const isDBConnected = () => isConnected;

const getInMemoryLogs = () => inMemoryLogs;
const getInMemorySessions = () => inMemorySessions;
const getInMemoryReports = () => inMemoryReports;

const addInMemoryLog = (log) => {
  const newLog = {
    ...log,
    _id: `log-${logIdCounter++}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject: function() { return this; }
  };
  inMemoryLogs.push(newLog);
  return newLog;
};

const addInMemorySession = (session) => {
  const newSession = {
    ...session,
    _id: `session-${sessionIdCounter++}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject: function() { return this; }
  };
  inMemorySessions.push(newSession);
  return newSession;
};

const addInMemoryReport = (report) => {
  const newReport = {
    ...report,
    _id: `report-${reportIdCounter++}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject: function() { return this; }
  };
  inMemoryReports.push(newReport);
  return newReport;
};

module.exports = {
  connectDB,
  isInFallbackMode,
  isDBConnected,
  getInMemoryLogs,
  getInMemorySessions,
  getInMemoryReports,
  addInMemoryLog,
  addInMemorySession,
  addInMemoryReport
};
