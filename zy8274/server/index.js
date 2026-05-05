const express = require('express');
const path = require('path');
const routes = require('./routes');
const { initSampleData } = require('./sampleData');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  跨时区工单筛选工具已启动`);
  console.log(`========================================`);
  console.log(`\n  访问地址: http://localhost:${PORT}`);
  console.log(`  API 前缀: http://localhost:${PORT}/api`);
  console.log(`\n========================================\n`);
  
  initSampleData();
});
