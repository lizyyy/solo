import express from 'express';
import cors from 'cors';
import { getState, setState } from './data/store';
import { Aunt, Customer } from './types';

import auntsRouter from './routes/aunts';
import customersRouter from './routes/customers';
import ordersRouter from './routes/orders';
import assignmentsRouter from './routes/assignments';
import leavesRouter from './routes/leaves';
import historyRouter from './routes/history';
import dashboardRouter from './routes/dashboard';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const initializeSampleData = () => {
  const sampleAunts: Aunt[] = [
    {
      id: 'aunt_sample_1',
      name: '张阿姨',
      phone: '13800138001',
      skills: ['cleaning', 'cooking', 'laundry'],
      taboos: ['no_dogs'],
      location: {
        lat: 39.9042,
        lng: 116.4074,
        address: '北京市朝阳区建国路88号'
      },
      rating: 4.8,
      experienceYears: 8,
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'aunt_sample_2',
      name: '李阿姨',
      phone: '13800138002',
      skills: ['childcare', 'cooking', 'cleaning'],
      taboos: ['no_smoking'],
      location: {
        lat: 39.9142,
        lng: 116.4174,
        address: '北京市朝阳区建国路99号'
      },
      rating: 4.6,
      experienceYears: 5,
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'aunt_sample_3',
      name: '王阿姨',
      phone: '13800138003',
      skills: ['eldercare', 'cleaning', 'cooking'],
      taboos: ['no_pork'],
      location: {
        lat: 39.9242,
        lng: 116.4274,
        address: '北京市朝阳区建国路100号'
      },
      rating: 4.9,
      experienceYears: 12,
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'aunt_sample_4',
      name: '赵阿姨',
      phone: '13800138004',
      skills: ['cleaning', 'organizing', 'ironing'],
      taboos: ['no_cats'],
      location: {
        lat: 39.8942,
        lng: 116.3974,
        address: '北京市海淀区中关村大街1号'
      },
      rating: 4.5,
      experienceYears: 3,
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const sampleCustomers: Customer[] = [
    {
      id: 'cust_sample_1',
      name: '陈先生',
      phone: '13900139001',
      location: {
        lat: 39.9052,
        lng: 116.4084,
        address: '北京市朝阳区建国路90号'
      },
      taboos: [],
      notes: '家里有一只狗，需要阿姨不怕狗',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cust_sample_2',
      name: '刘女士',
      phone: '13900139002',
      location: {
        lat: 39.9152,
        lng: 116.4184,
        address: '北京市朝阳区建国路101号'
      },
      taboos: ['no_dogs'],
      notes: '需要照顾2岁的宝宝',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  setState({
    aunts: sampleAunts,
    customers: sampleCustomers
  });

  console.log('已初始化示例数据');
};

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '家政阿姨技能派单台 API 服务运行中' });
});

app.get('/api/state', (req, res) => {
  res.json({ success: true, data: getState() });
});

app.use('/api/aunts', auntsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/history', historyRouter);
app.use('/api/dashboard', dashboardRouter);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`家政阿姨技能派单台 API 服务已启动: http://localhost:${PORT}`);
  initializeSampleData();
});
