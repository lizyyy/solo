require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/api/v1';

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 设置模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// API 代理中间件
const apiProxy = async (req, res) => {
  try {
    const method = req.method.toLowerCase();
    // 使用 originalUrl 获取完整路径，然后移除 /api/v1 前缀
    const fullPath = req.originalUrl.split('?')[0];
    const path = fullPath.replace(/^\/api\/v1/, '');
    const url = `${API_BASE_URL}${path}`;
    
    const config = {
      method,
      url,
      params: req.query,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

// API 路由代理
app.use('/api/v1/experiments', apiProxy);
app.use('/api/v1/events', apiProxy);
app.use('/api/v1/snapshots', apiProxy);
app.use('/api/v1/traces', apiProxy);
app.use('/api/v1/reports', apiProxy);
app.use('/api/v1/health', apiProxy);
app.use('/api/v1/info', apiProxy);

// 页面路由
app.get('/', (req, res) => {
  res.render('index', { title: 'GMP 调度模型演练台' });
});

app.get('/experiments', (req, res) => {
  res.render('experiments', { title: '实验管理' });
});

app.get('/experiments/new', (req, res) => {
  res.render('experiment-form', { title: '新建实验', experiment: null });
});

app.get('/experiments/:id', (req, res) => {
  res.render('experiment-detail', { 
    title: '实验详情', 
    experimentId: req.params.id 
  });
});

app.get('/experiments/:id/edit', (req, res) => {
  res.render('experiment-form', { 
    title: '编辑实验', 
    experimentId: req.params.id 
  });
});

app.get('/timeline', (req, res) => {
  res.render('timeline', { title: '时间线可视化' });
});

app.get('/events', (req, res) => {
  res.render('events', { title: '事件列表' });
});

app.get('/snapshots', (req, res) => {
  res.render('snapshots', { title: '队列快照' });
});

app.get('/traces', (req, res) => {
  res.render('traces', { title: 'Trace 导入' });
});

app.get('/reports', (req, res) => {
  res.render('reports', { title: '报告导出' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`GMP Simulator Frontend running on http://localhost:${PORT}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
});
