const express = require('express');
const router = express.Router();
const multer = require('multer');

const elderlyController = require('./controllers/elderlyController');
const menuController = require('./controllers/menuController');
const deliveryController = require('./controllers/deliveryController');
const importController = require('./controllers/importController');
const reportController = require('./controllers/reportController');
const historyController = require('./controllers/historyController');

const upload = multer({ dest: 'uploads/' });

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '社区食堂管理系统 API',
    version: '1.0.0',
    endpoints: {
      elderly: '/api/elderly',
      menu: '/api/menu',
      delivery: '/api/deliveries',
      import: '/api/import',
      report: '/api/report',
      history: '/api/history'
    }
  });
});

router.get('/elderly', elderlyController.getAllElderly);
router.get('/elderly/:id', elderlyController.getElderlyById);
router.post('/elderly', elderlyController.createElderly);
router.put('/elderly/:id', elderlyController.updateElderly);
router.delete('/elderly/:id', elderlyController.deleteElderly);

router.get('/menu/items', menuController.getAllMenuItems);
router.get('/menu/items/:id', menuController.getMenuItemById);
router.post('/menu/items', menuController.createMenuItem);
router.put('/menu/items/:id', menuController.updateMenuItem);
router.delete('/menu/items/:id', menuController.deleteMenuItem);
router.get('/menu/daily', menuController.getAllDailyMenus);
router.post('/menu/daily', menuController.createDailyMenu);

router.get('/deliveries', deliveryController.getAllDeliveries);
router.get('/deliveries/:id', deliveryController.getDeliveryById);
router.post('/deliveries', deliveryController.createDelivery);
router.put('/deliveries/:id', deliveryController.updateDelivery);
router.delete('/deliveries/:id', deliveryController.deleteDelivery);
router.get('/routes', deliveryController.getAllRoutes);
router.post('/routes', deliveryController.createRoute);

router.post('/import/elderly', upload.single('file'), importController.importElderlyCSV);
router.post('/import/menu', upload.single('file'), importController.importMenuJSON);
router.post('/import/delivery', upload.single('file'), importController.importDeliveryCSV);
router.get('/import/errors', importController.getImportErrors);

router.get('/report/delivery/export', reportController.exportDeliveryReport);
router.get('/report/elderly/export', reportController.exportElderlyReport);
router.get('/report/delivery/statistics', reportController.getDeliveryStatistics);

router.get('/history', historyController.getOperationHistory);
router.get('/history/:id', historyController.getHistoryById);

module.exports = router;
