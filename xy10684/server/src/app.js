const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');

const SurveyController = require('./controllers/surveyController');
const TaskController = require('./controllers/taskController');
const MasterController = require('./controllers/masterController');
const TrendController = require('./controllers/trendController');
const ResultController = require('./controllers/resultController');
const ExportController = require('./controllers/exportController');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '低分回访系统服务正常运行' });
});

app.post('/api/surveys', SurveyController.create);
app.put('/api/surveys/:id', SurveyController.update);
app.get('/api/surveys', SurveyController.list);
app.get('/api/surveys/:id', SurveyController.detail);
app.get('/api/surveys/:id/timeline', SurveyController.timeline);

app.post('/api/tasks', TaskController.create);
app.post('/api/tasks/:id/complete', TaskController.complete);
app.post('/api/tasks/:id/review', TaskController.review);
app.get('/api/tasks', TaskController.list);
app.get('/api/tasks/:id/timeline', TaskController.timeline);

app.post('/api/results', ResultController.create);
app.get('/api/results', ResultController.list);
app.get('/api/results/:id', ResultController.detail);

app.get('/api/reasons', MasterController.getReasons);
app.post('/api/reasons', MasterController.createReason);
app.get('/api/departments', MasterController.getDepartments);
app.post('/api/departments', MasterController.createDepartment);

app.get('/api/trends', TrendController.list);
app.post('/api/trends/calculate', TrendController.calculate);
app.get('/api/statistics', TrendController.statistics);

app.get('/api/export/filters', ExportController.getFilters);
app.get('/api/export/revisit-results', ExportController.exportRevisitResults);

async function initData() {
  const { LowScoreReason, Department } = require('./models');
  
  const reasons = await LowScoreReason.count();
  if (reasons === 0) {
    await LowScoreReason.bulkCreate([
      { code: 'R001', name: '服务态度差', category: '服务', sort: 1, enabled: true, needReview: false },
      { code: 'R002', name: '响应时间长', category: '效率', sort: 2, enabled: true, needReview: false },
      { code: 'R003', name: '问题未解决', category: '质量', sort: 3, enabled: true, needReview: true },
      { code: 'R004', name: '流程不清晰', category: '流程', sort: 4, enabled: true, needReview: false },
      { code: 'R005', name: '其他原因', category: '其他', sort: 5, enabled: true, needReview: true }
    ]);
    console.log('初始化低分原因数据完成');
  }

  const depts = await Department.count();
  if (depts === 0) {
    await Department.bulkCreate([
      { code: 'D001', name: '客服部', manager: '张三', enabled: true },
      { code: 'D002', name: '技术部', manager: '李四', enabled: true },
      { code: 'D003', name: '运营部', manager: '王五', enabled: true },
      { code: 'D004', name: '产品部', manager: '赵六', enabled: true }
    ]);
    console.log('初始化部门数据完成');
  }
}

sequelize.sync({ alter: true })
  .then(() => {
    console.log('数据库连接成功');
    return initData();
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`服务端运行在 http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('数据库连接失败:', err);
  });

module.exports = app;
