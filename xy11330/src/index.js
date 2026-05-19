const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const tasksRouter = require('./routes/tasks');
const escortsRouter = require('./routes/escorts');
const appointmentsRouter = require('./routes/appointments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: '陪检员调度系统',
    version: '1.0.0',
    description: '门诊陪检服务管理后端系统',
    endpoints: {
      tasks: '/api/tasks',
      escorts: '/api/escorts',
      appointments: '/api/appointments',
      docs: '/api/docs'
    }
  });
});

app.get('/api/docs', (req, res) => {
  res.json({
    message: '接口文档',
    endpoints: {
      tasks: {
        list: 'GET /api/tasks - 查询任务列表',
        detail: 'GET /api/tasks/:id - 查询任务详情',
        logs: 'GET /api/tasks/:id/logs - 查询任务日志',
        assign: 'POST /api/tasks/:id/assign - 派单',
        accept: 'POST /api/tasks/:id/accept - 接单',
        start: 'POST /api/tasks/:id/start - 开始陪检',
        complete: 'POST /api/tasks/:id/complete - 完成陪检',
        cancel: 'POST /api/tasks/:id/cancel - 取消任务',
        insert: 'POST /api/tasks/:id/insert - 插队处理',
        checkOverdue: 'POST /api/tasks/:id/check-overdue - 检查超时'
      },
      escorts: {
        list: 'GET /api/escorts - 查询陪检员列表',
        available: 'GET /api/escorts/available - 查询可用陪检员',
        detail: 'GET /api/escorts/:id - 查询陪检员详情',
        schedules: 'GET /api/escorts/:id/schedules - 查询陪检员班表',
        create: 'POST /api/escorts - 创建陪检员',
        addSchedule: 'POST /api/escorts/:id/schedules - 添加班表'
      },
      appointments: {
        list: 'GET /api/appointments - 查询预约单列表',
        detail: 'GET /api/appointments/:id - 查询预约单详情',
        create: 'POST /api/appointments - 创建预约单'
      }
    },
    filters: {
      tasks: ['escort_id', 'status', 'start_date', 'end_date', 'is_overdue', 'is_inserted'],
      appointments: ['date', 'status', 'department']
    }
  });
});

app.use('/api/tasks', tasksRouter);
app.use('/api/escorts', escortsRouter);
app.use('/api/appointments', appointmentsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`陪检员调度系统已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`接口文档: http://localhost:${PORT}/api/docs`);
  console.log('='.repeat(50));
});
