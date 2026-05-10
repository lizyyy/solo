import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/exhibition-lead-platform';

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB 数据库连接成功');
  } catch (error) {
    console.error('MongoDB 数据库连接失败:', error);
    process.exit(1);
  }
};

export default mongoose;
