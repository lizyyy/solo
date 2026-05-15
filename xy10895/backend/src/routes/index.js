const express = require('express');
const router = express.Router();
const multer = require('multer');
const { validateApiEntry, validateStatusTransition, validateExampleRequest } = require('../middleware/validation');

const apiController = require('../controllers/apiController');
const importExportController = require('../controllers/importExportController');
const favoriteController = require('../controllers/favoriteController');
const ownerController = require('../controllers/ownerController');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API Catalog service is running' });
});

router.get('/apis', apiController.getApiList);
router.get('/apis/:id', apiController.getApiDetail);
router.post('/apis', validateApiEntry, apiController.createApiEntry);
router.patch('/apis/:id/status', validateStatusTransition, apiController.updateApiStatus);
router.post('/apis/:apiId/examples', validateExampleRequest, apiController.addExampleRequest);

router.post('/import', upload.single('file'), importExportController.bulkImport);
router.get('/export', importExportController.exportReport);

router.post('/favorites/:apiId/toggle', favoriteController.toggleFavorite);
router.get('/favorites', favoriteController.getFavorites);

router.get('/owners', ownerController.getOwners);
router.post('/owners', ownerController.createOwner);

module.exports = router;
