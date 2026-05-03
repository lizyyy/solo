const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const projectsRouter = require('./routes/projects');
const reportsRouter = require('./routes/reports');
const LocalStorage = require('./storage/localStorage');
const { parser } = require('./engine');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（前端构建后）
const staticPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(staticPath));

// API 路由
app.use('/api/projects', projectsRouter);
app.use('/api/reports', reportsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 获取示例状态机列表
app.get('/api/examples', async (req, res) => {
  try {
    const examplesDir = path.join(__dirname, '../../../examples');
    const files = await fs.readdir(examplesDir);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    
    const examples = [];
    for (const file of yamlFiles) {
      try {
        const content = await fs.readFile(path.join(examplesDir, file), 'utf8');
        const machine = parser.parse(content);
        examples.push({
          filename: file,
          name: machine.name,
          description: machine.description,
          stateCount: Object.keys(machine.states).length,
          eventCount: Object.keys(machine.events).length
        });
      } catch (e) {
        continue;
      }
    }
    
    res.json({
      success: true,
      examples
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取示例状态机内容
app.get('/api/examples/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const examplesDir = path.join(__dirname, '../../../examples');
    const filePath = path.join(examplesDir, filename);
    
    // 安全检查
    if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) {
      return res.status(400).json({
        success: false,
        error: '只允许访问 YAML 文件'
      });
    }
    
    // 检查是否存在
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        error: '示例文件不存在'
      });
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    
    res.json({
      success: true,
      filename,
      content,
      machine: parser.parse(content)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 前端路由回退（SPA）
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // 如果前端没有构建，返回简单的欢迎页面
      res.send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Stateflow Rehearsal</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              line-height: 1.6;
            }
            h1 { color: #2c3e50; }
            .info { background: #f8f9fa; padding: 20px; border-radius: 8px; }
            code { background: #f4f6f8; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>🚀 Stateflow Rehearsal</h1>
          <div class="info">
            <h2>后端服务已启动</h2>
            <p>API 服务运行在端口 ${PORT}</p>
            <h3>可用端点：</h3>
            <ul>
              <li><code>GET /api/health</code> - 健康检查</li>
              <li><code>GET /api/examples</code> - 示例状态机列表</li>
              <li><code>GET /api/projects</code> - 项目列表</li>
              <li><code>POST /api/projects/import</code> - 导入状态机</li>
              <li><code>GET /api/reports/:projectId</code> - 生成报告</li>
            </ul>
            <h3>启动前端：</h3>
            <p>运行 <code>npm run dev:frontend</code> 启动前端开发服务器</p>
            <p>或者运行 <code>npm run build</code> 构建前端</p>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// 初始化存储并加载示例
async function initializeApp() {
  const storage = new LocalStorage();
  await storage.ensureStorageDir();
  
  // 检查是否需要加载示例
  const listResult = await storage.listProjects();
  if (listResult.projects.length === 0) {
    console.log('首次启动，正在加载示例状态机...');
    try {
      const examplesDir = path.join(__dirname, '../../../examples');
      const files = await fs.readdir(examplesDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      
      for (const file of yamlFiles) {
        try {
          const content = await fs.readFile(path.join(examplesDir, file), 'utf8');
          const result = await storage.importMachine(content, file.replace(/\.(yaml|yml)$/, ''));
          if (result.success) {
            console.log(`已加载示例: ${result.project.name}`);
          }
        } catch (e) {
          console.warn(`加载示例 ${file} 失败: ${e.message}`);
        }
      }
    } catch (e) {
      console.warn('加载示例失败:', e.message);
    }
  }
}

// 启动服务器
app.listen(PORT, async () => {
  await initializeApp();
  console.log(`\n🚀 Stateflow Rehearsal 后端服务已启动`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`📚 API 文档: http://localhost:${PORT}/api/health`);
  console.log(`\n运行 npm run dev:frontend 启动前端开发服务器\n`);
});
