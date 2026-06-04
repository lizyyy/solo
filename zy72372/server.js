const http = require('http');
const fs = require('fs');
const path = require('path');

const { SensorDataProcessor } = require('./src/processor');
const { DemoData } = require('./src/demo-data');

const processor = new SensorDataProcessor();

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath, 'utf-8'));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  } else if (req.url === '/api/demo') {
    processor.knownSensors = DemoData.getBaselineSensors();
    const session = DemoData.createDemoSession();
    const result = processor.processSession(session);
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      session: result.session.toJSON(),
      restartDetections: result.restartDetections,
      safetyReminder: result.safetyReminder
    }, null, 2));
  } else if (req.url === '/api/steps') {
    const steps = DemoData.getStepByStepDemo();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(steps, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`小看板服务器运行在 http://localhost:${PORT}`);
  console.log(`演示数据API: http://localhost:${PORT}/api/demo`);
  console.log(`步骤演示API: http://localhost:${PORT}/api/steps`);
});
