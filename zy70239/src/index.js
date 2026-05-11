const express = require('express');
const config = require('./config');
const storage = require('./storage');
const batchProcessor = require('./batchProcessor');
const validationEngine = require('./validationEngine');

const app = express();
app.use(express.json({ limit: '10mb' }));

const SAMPLE_BATCH = {
  batchId: 'BATCH-2024-001',
  goods: [
    {
      batchId: 'BATCH-2024-001',
      goodsNo: 'DG-001',
      category: 'EXPLOSIVES',
      weight: 5000,
      operationType: 'IMPORT',
      containerNo: 'CONT-001',
      unCode: 'UN0001',
      description: '测试爆炸品'
    },
    {
      batchId: 'BATCH-2024-001',
      goodsNo: 'DG-002',
      category: 'FLAMMABLE_LIQUIDS',
      weight: 15000,
      operationType: 'IMPORT',
      containerNo: 'CONT-002',
      unCode: 'UN1203',
      description: '测试易燃液体'
    },
    {
      batchId: 'BATCH-2024-001',
      goodsNo: 'DG-003',
      category: 'TOXIC',
      weight: 8000,
      operationType: 'EXPORT',
      containerNo: 'CONT-003',
      unCode: 'UN2810',
      description: '测试毒性物质'
    }
  ]
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/categories', (req, res) => {
  res.json({
    categories: config.ISOLATION_RULES.categories,
    distances: config.ISOLATION_RULES.distances,
    incompatible: config.ISOLATION_RULES.incompatible,
    requiredFields: validationEngine.REQUIRED_FIELDS,
    riskLevels: validationEngine.RISK_LEVELS
  });
});

app.post('/api/batches/process', async (req, res) => {
  try {
    const { batchId, goods } = req.body;
    
    if (!batchId || !goods || !Array.isArray(goods)) {
      return res.status(400).json({
        success: false,
        error: '请求必须包含 batchId 和 goods 数组'
      });
    }

    const results = await batchProcessor.processBatch(batchId, goods);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Process batch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/batches/:batchId/status', async (req, res) => {
  try {
    const { batchId } = req.params;
    const status = await batchProcessor.getBatchStatus(batchId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get batch status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/batches/:batchId/exports', async (req, res) => {
  try {
    const { batchId } = req.params;
    const exports = await storage.getExportsByBatch(batchId);
    
    res.json({
      success: true,
      data: exports.map(e => ({
        type: e.type,
        generatedAt: e.generatedAt,
        updatedAt: e.updatedAt,
        data: e.content.data
      }))
    });
  } catch (error) {
    console.error('Get exports error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/batches/:batchId/exports/:type', async (req, res) => {
  try {
    const { batchId, type } = req.params;
    const exports = await storage.getExportsByBatch(batchId);
    const exportFile = exports.find(e => e.type === type);
    
    if (!exportFile) {
      return res.status(404).json({
        success: false,
        error: `未找到类型为 ${type} 的导出文件`
      });
    }
    
    res.json({
      success: true,
      data: exportFile.content
    });
  } catch (error) {
    console.error('Get export error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/batches/:batchId/correct', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { goodsNo, correctionData, operator } = req.body;
    
    if (!goodsNo || !correctionData) {
      return res.status(400).json({
        success: false,
        error: '请求必须包含 goodsNo 和 correctionData'
      });
    }

    const result = await batchProcessor.manualCorrect(
      batchId,
      goodsNo,
      correctionData,
      operator || 'system'
    );
    
    res.json(result);
  } catch (error) {
    console.error('Manual correct error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/sample', (req, res) => {
  res.json({
    success: true,
    data: SAMPLE_BATCH
  });
});

app.post('/api/sample/run', async (req, res) => {
  try {
    const results = await batchProcessor.processBatch(
      SAMPLE_BATCH.batchId,
      SAMPLE_BATCH.goods
    );
    
    res.json({
      success: true,
      data: results,
      message: '样例数据已处理完成'
    });
  } catch (error) {
    console.error('Sample run error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/scenarios/missing-fields', async (req, res) => {
  try {
    const { batchId = 'SCENARIO-MISSING-001' } = req.body;
    
    const missingFieldsGoods = [
      {
        batchId,
        goodsNo: 'MF-001',
        category: 'FLAMMABLE_LIQUIDS',
        weight: 10000,
        operationType: 'IMPORT'
      }
    ];
    
    const results = await batchProcessor.processBatch(batchId, missingFieldsGoods);
    
    res.json({
      success: true,
      scenario: '缺字段验证',
      description: '测试缺少必填字段（containerNo, unCode）的情况',
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scenarios/duplicate', async (req, res) => {
  try {
    const { batchId = 'SCENARIO-DUPLICATE-001' } = req.body;
    
    const duplicateGoods = [
      {
        batchId,
        goodsNo: 'DUP-001',
        category: 'MISCELLANEOUS',
        weight: 5000,
        operationType: 'IMPORT',
        containerNo: 'CONT-DUP-001',
        unCode: 'UN3082'
      },
      {
        batchId,
        goodsNo: 'DUP-001',
        category: 'MISCELLANEOUS',
        weight: 5000,
        operationType: 'IMPORT',
        containerNo: 'CONT-DUP-001',
        unCode: 'UN3082'
      }
    ];
    
    const results = await batchProcessor.processBatch(batchId, duplicateGoods);
    
    res.json({
      success: true,
      scenario: '重复提交验证',
      description: '测试同一批次中重复提交相同危险品的情况',
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scenarios/illegal-flow', async (req, res) => {
  try {
    const { batchId = 'SCENARIO-ILLEGAL-001' } = req.body;
    
    const illegalGoods = [
      {
        batchId,
        goodsNo: 'IL-001',
        category: 'TOXIC',
        weight: 8000,
        operationType: 'INVALID_TYPE',
        containerNo: 'CONT-IL-001',
        unCode: 'UN2810'
      }
    ];
    
    const results = await batchProcessor.processBatch(batchId, illegalGoods);
    
    res.json({
      success: true,
      scenario: '非法流转/无效作业类型',
      description: '测试提交无效作业类型的危险品',
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scenarios/manual-correction', async (req, res) => {
  try {
    const { batchId = 'SCENARIO-CORRECTION-001' } = req.body;
    
    const initialGoods = [
      {
        batchId,
        goodsNo: 'COR-001',
        category: 'MISCELLANEOUS',
        weight: 10000,
        operationType: 'IMPORT',
        containerNo: 'CONT-COR-001',
        unCode: 'UN3082'
      }
    ];
    
    const initialResults = await batchProcessor.processBatch(batchId, initialGoods);
    
    const correctionResult = await batchProcessor.manualCorrect(
      batchId,
      'COR-001',
      {
        category: 'FLAMMABLE_LIQUIDS',
        weight: 8000,
        reason: '发现类别申报错误，实际为易燃液体'
      },
      'operator-001'
    );
    
    const reprocessResults = await batchProcessor.processBatch(batchId, initialGoods);
    
    res.json({
      success: true,
      scenario: '人工修正流程',
      description: '演示人工修正危险品信息后重新处理的完整流程',
      steps: {
        initialProcessing: initialResults,
        manualCorrection: correctionResult,
        reprocessing: reprocessResults
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/batches/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    await storage.clearBatchData(batchId);
    
    res.json({
      success: true,
      message: `批次 ${batchId} 数据已清除`
    });
  } catch (error) {
    console.error('Clear batch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function startServer() {
  await storage.initStorage();
  
  app.listen(config.PORT, () => {
    console.log(`港口危险品堆存 API 服务已启动`);
    console.log(`服务地址: http://localhost:${config.PORT}`);
    console.log(`健康检查: http://localhost:${config.PORT}/health`);
    console.log(`样例数据: http://localhost:${config.PORT}/api/sample`);
    console.log(`运行样例: POST http://localhost:${config.PORT}/api/sample/run`);
  });
}

startServer().catch(console.error);
