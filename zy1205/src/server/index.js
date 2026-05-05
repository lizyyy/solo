const express = require('express');
const cors = require('cors');
const path = require('path');

const clustersRouter = require('./routes/clusters');
const instancesRouter = require('./routes/instances');
const eventsRouter = require('./routes/events');
const exportService = require('./services/ExportService');
const { loadSeed } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../../public')));

app.use('/api/clusters', clustersRouter);
app.use('/api/instances', instancesRouter);
app.use('/api/events', eventsRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok',
    timestamp: Date.now()
  });
});

app.get('/api/export/json', (req, res) => {
  try {
    const result = exportService.exportToJSON(null);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=full-export-${Date.now()}.json`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/export/markdown', (req, res) => {
  try {
    const result = exportService.exportToMarkdown(null);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=full-report-${Date.now()}.md`);
    res.send(result.markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/strategies', (req, res) => {
  const strategies = {
    ROUND_ROBIN: {
      name: '轮询',
      description: '按顺序依次将请求分配给每个实例',
      icon: '🔄'
    },
    WEIGHTED_ROUND_ROBIN: {
      name: '加权轮询',
      description: '根据权重比例分配请求，权重越高分配越多',
      icon: '⚖️'
    },
    LEAST_CONNECTIONS: {
      name: '最小连接数',
      description: '选择当前连接数最少的实例',
      icon: '📊'
    },
    RANDOM: {
      name: '随机',
      description: '从可用实例中随机选择',
      icon: '🎲'
    }
  };

  res.json({ success: true, data: strategies });
});

app.get('/api/instance-statuses', (req, res) => {
  const statuses = {
    HEALTHY: {
      name: '健康',
      description: '实例正常运行，可以接收请求',
      color: 'success',
      icon: '✅'
    },
    UNHEALTHY: {
      name: '不健康',
      description: '实例连续健康检查失败，暂不接收请求',
      color: 'warning',
      icon: '⚠️'
    },
    DOWN: {
      name: '宕机',
      description: '实例被剔除，不接收请求',
      color: 'danger',
      icon: '❌'
    },
    MAINTENANCE: {
      name: '维护中',
      description: '实例处于维护模式',
      color: 'info',
      icon: '🔧'
    }
  };

  res.json({ success: true, data: statuses });
});

app.get('/api/instance-roles', (req, res) => {
  const roles = {
    MASTER: {
      name: '主节点',
      description: '集群的主节点，处理写请求',
      icon: '👑'
    },
    SLAVE: {
      name: '从节点',
      description: '集群的从节点，处理读请求',
      icon: '🔷'
    },
    FOLLOWER: {
      name: '跟随者',
      description: 'Raft协议中的跟随者角色',
      icon: '🔶'
    }
  };

  res.json({ success: true, data: roles });
});

app.post('/api/seed', (req, res) => {
  try {
    const success = loadSeed();
    res.json({ success, message: '示例数据加载成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 服务集群演练台已启动`);
  console.log(`📊 管理界面: http://localhost:${PORT}`);
  console.log(`🔌 API 地址: http://localhost:${PORT}/api`);
  console.log(`📁 数据目录: ${path.join(__dirname, '../../data')}`);
});
