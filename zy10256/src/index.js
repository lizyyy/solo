const express = require('express');
const bodyParser = require('body-parser');
const FoodSampleService = require('./services');
const Storage = require('./storage');

const app = express();
const PORT = 3001;

app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '餐饮后厨留样管理API',
    version: '1.0.0',
    endpoints: {
      dishes: '/api/dishes',
      responsiblePersons: '/api/responsible-persons',
      sampleBoxes: '/api/sample-boxes',
      meals: '/api/meals',
      samples: '/api/samples',
      alerts: '/api/alerts',
      supervision: '/api/supervision',
      destroyRecords: '/api/destroy-records'
    }
  });
});

app.get('/api/dishes', (req, res) => {
  const result = FoodSampleService.getAllDishes();
  res.json(result);
});

app.post('/api/dishes', (req, res) => {
  const result = FoodSampleService.createDish(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.get('/api/responsible-persons', (req, res) => {
  const result = FoodSampleService.getAllResponsiblePersons();
  res.json(result);
});

app.post('/api/responsible-persons', (req, res) => {
  const result = FoodSampleService.createResponsiblePerson(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.get('/api/sample-boxes', (req, res) => {
  const result = FoodSampleService.getAllSampleBoxes();
  res.json(result);});

app.post('/api/sample-boxes', (req, res) => {
  const result = FoodSampleService.createSampleBox(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.get('/api/meals', (req, res) => {
  const result = FoodSampleService.getAllMeals();
  res.json(result);
});

app.post('/api/meals', (req, res) => {
  const result = FoodSampleService.createMeal(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.post('/api/meals/:id/open', (req, res) => {
  const { operatorId } = req.body;
  const result = FoodSampleService.openMeal(req.params.id, operatorId);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/samples', (req, res) => {
  const result = FoodSampleService.getAllSamples();
  res.json(result);
});

app.post('/api/samples', (req, res) => {
  const result = FoodSampleService.createSample(req.body);
  res.status(result.success ? 201 : 400).json(result);
});

app.post('/api/samples/:id/destroy', (req, res) => {
  const { operatorId, destroyMethod } = req.body;
  const result = FoodSampleService.destroySample(req.params.id, operatorId, destroyMethod);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/samples/check-expired', (req, res) => {
  const result = FoodSampleService.checkExpiredSamples();
  res.json(result);
});

app.get('/api/alerts', (req, res) => {
  const { status } = req.query;
  const result = FoodSampleService.getAlerts(status);
  res.json(result);
});

app.get('/api/supervision', (req, res) => {
  const { startDate, endDate } = req.query;
  const result = FoodSampleService.getSupervisionQuery(startDate, endDate);
  res.json(result);
});

app.get('/api/destroy-records', (req, res) => {
  const result = FoodSampleService.getAllDestroyRecords();
  res.json(result);
});

app.post('/api/reset', (req, res) => {
  Storage.reset();
  res.json({ success: true, message: '数据已重置' });
});

app.listen(PORT, () => {
  console.log(`餐饮后厨留样管理API服务器运行在 http://localhost:${PORT}`);
  console.log(`运行演示: npm run demo`);
  console.log(`导入种子数据: npm run seed`);
});
