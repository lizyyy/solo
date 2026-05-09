const express = require('express');
const router = express.Router();
const assetService = require('../services/assetService');
const depreciationService = require('../services/depreciationService');

router.get('/', (req, res) => {
  const { assetType, department, status, responsiblePersonId } = req.query;
  const assets = assetService.listAssets({
    assetType,
    department,
    status,
    responsiblePersonId
  });
  
  res.json({
    success: true,
    data: assets
  });
});

router.get('/:id', (req, res) => {
  const asset = assetService.getAssetById(req.params.id);
  if (!asset) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ASSET_NOT_FOUND',
        message: '资产不存在'
      }
    });
  }
  
  res.json({
    success: true,
    data: asset
  });
});

router.get('/:id/depreciation', (req, res) => {
  const asset = assetService.getAssetById(req.params.id);
  if (!asset) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ASSET_NOT_FOUND',
        message: '资产不存在'
      }
    });
  }
  
  const depreciation = depreciationService.calculateAccumulatedDepreciation(asset);
  
  res.json({
    success: true,
    data: {
      asset: {
        id: asset.id,
        assetNo: asset.assetNo,
        responsiblePerson: asset.responsiblePerson,
        department: asset.department,
        depreciationDepartment: asset.depreciationDepartment
      },
      depreciation
    }
  });
});

router.post('/', (req, res) => {
  const asset = assetService.createAsset(req.body);
  
  res.status(201).json({
    success: true,
    data: asset
  });
});

router.put('/:id', (req, res) => {
  const { expectedVersion, ...updateData } = req.body;
  const asset = assetService.updateAsset(req.params.id, updateData, expectedVersion);
  
  res.json({
    success: true,
    data: asset
  });
});

module.exports = router;
