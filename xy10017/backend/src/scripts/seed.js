const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const User = require('../models/User');
const PushMessage = require('../models/PushMessage');

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/live_push');
    console.log('Connected to MongoDB');

    console.log('Checking for existing admin user...');
    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (!existingAdmin) {
      console.log('Creating default admin user: admin / admin123');
      const admin = new User({
        username: 'admin',
        password: 'admin123',
        role: 'admin',
      });
      await admin.save();
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }

    console.log('Checking for existing operator user...');
    const existingOperator = await User.findOne({ username: 'operator' });
    
    if (!existingOperator) {
      console.log('Creating default operator user: operator / operator123');
      const operator = new User({
        username: 'operator',
        password: 'operator123',
        role: 'operator',
      });
      await operator.save();
      console.log('Operator user created successfully');
    } else {
      console.log('Operator user already exists');
    }

    console.log('Checking for existing viewer user...');
    const existingViewer = await User.findOne({ username: 'viewer' });
    
    if (!existingViewer) {
      console.log('Creating default viewer user: viewer / viewer123');
      const viewer = new User({
        username: 'viewer',
        password: 'viewer123',
        role: 'viewer',
      });
      await viewer.save();
      console.log('Viewer user created successfully');
    } else {
      console.log('Viewer user already exists');
    }

    console.log('\nDefault users:');
    console.log('  admin    / admin123    (管理员)');
    console.log('  operator / operator123 (操作员)');
    console.log('  viewer   / viewer123   (查看者)');

    const adminUser = await User.findOne({ username: 'admin' });
    
    const messageCount = await PushMessage.countDocuments();
    if (messageCount === 0) {
      console.log('\nCreating sample push messages...');
      
      const sampleMessages = [
        {
          title: '欢迎使用直播推送系统',
          content: '这是一个示例消息，展示系统功能。',
          pushType: 'broadcast',
          priority: 0,
          status: 'sent',
          sentAt: new Date(),
          totalRecipients: 1000,
          deliveredCount: 985,
          failedCount: 15,
          createdBy: adminUser._id,
        },
        {
          title: '重要公告：系统维护通知',
          content: '系统将于本周日凌晨2:00-4:00进行维护升级。',
          pushType: 'system',
          priority: 5,
          status: 'queued',
          createdBy: adminUser._id,
        },
        {
          title: '定向测试消息',
          content: '这是一条定向推送测试消息。',
          pushType: 'targeted',
          targetUsers: ['user001', 'user002'],
          priority: 0,
          status: 'sent',
          sentAt: new Date(),
          totalRecipients: 2,
          deliveredCount: 2,
          failedCount: 0,
          createdBy: adminUser._id,
        },
        {
          title: '失败重试示例',
          content: '这条消息模拟了发送失败的场景。',
          pushType: 'broadcast',
          priority: 0,
          status: 'failed',
          failedAt: new Date(),
          retryCount: 1,
          maxRetries: 3,
          errorMessage: 'Simulated delivery failure',
          createdBy: adminUser._id,
        },
      ];

      for (const msg of sampleMessages) {
        const push = new PushMessage({
          ...msg,
          idempotencyKey: `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        await push.save();
      }
      
      console.log('Sample messages created');
    }

    await mongoose.disconnect();
    console.log('\nSeeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
