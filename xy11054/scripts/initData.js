const store = require('../store/sampleStore');
const { SAMPLE_STATUS } = require('../models/sampleModel');
const { v4: uuidv4 } = require('uuid');

function createInitialSamples() {
  const now = new Date();
  
  const samples = [
    {
      id: uuidv4(),
      sampleBoxCode: 'BOX-001',
      pastryName: '蛋黄酥',
      pastryType: '酥皮糕点',
      productionBatch: 'P20240518-001',
      productionLine: 'A线-1号机',
      productionTime: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      productionQuantity: 500,
      sampler: '张三',
      sampleQuantity: 3,
      storageLocation: 'A区-01-01',
      storageTemperature: 25,
      retentionPeriod: 48,
      status: SAMPLE_STATUS.IN_STORAGE,
      statusHistory: [
        {
          status: SAMPLE_STATUS.CREATED,
          timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
          operator: '张三',
          source: 'manual',
          remark: '留样创建'
        },
        {
          status: SAMPLE_STATUS.IN_STORAGE,
          timestamp: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(),
          operator: '李四',
          source: 'manual',
          remark: '入库存储'
        }
      ],
      inspectionResult: null,
      inspectionTime: null,
      inspector: null,
      destroyTime: null,
      destroyer: null,
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 1.5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      sampleBoxCode: 'BOX-002',
      pastryName: '绿豆糕',
      pastryType: '蒸制糕点',
      productionBatch: 'P20240518-002',
      productionLine: 'B线-2号机',
      productionTime: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      productionQuantity: 800,
      sampler: '王五',
      sampleQuantity: 4,
      storageLocation: 'A区-01-02',
      storageTemperature: 18,
      retentionPeriod: 72,
      status: SAMPLE_STATUS.INSPECTED,
      statusHistory: [
        {
          status: SAMPLE_STATUS.CREATED,
          timestamp: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
          operator: '王五',
          source: 'manual',
          remark: '留样创建'
        },
        {
          status: SAMPLE_STATUS.IN_STORAGE,
          timestamp: new Date(now - 3.5 * 60 * 60 * 1000).toISOString(),
          operator: '李四',
          source: 'manual',
          remark: '入库存储'
        },
        {
          status: SAMPLE_STATUS.INSPECTED,
          timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
          operator: '质检-赵六',
          source: 'system',
          remark: '送检完成'
        }
      ],
      inspectionResult: '合格',
      inspectionTime: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      inspector: '质检-赵六',
      destroyTime: null,
      destroyer: null,
      createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      sampleBoxCode: 'BOX-003',
      pastryName: '老婆饼',
      pastryType: '酥皮糕点',
      productionBatch: 'P20240517-005',
      productionLine: 'A线-1号机',
      productionTime: new Date(now - 28 * 60 * 60 * 1000).toISOString(),
      productionQuantity: 600,
      sampler: '张三',
      sampleQuantity: 3,
      storageLocation: 'B区-02-05',
      storageTemperature: 22,
      retentionPeriod: 48,
      status: SAMPLE_STATUS.EXPIRED,
      statusHistory: [
        {
          status: SAMPLE_STATUS.CREATED,
          timestamp: new Date(now - 27 * 60 * 60 * 1000).toISOString(),
          operator: '张三',
          source: 'manual',
          remark: '留样创建'
        },
        {
          status: SAMPLE_STATUS.IN_STORAGE,
          timestamp: new Date(now - 26.5 * 60 * 60 * 1000).toISOString(),
          operator: '李四',
          source: 'manual',
          remark: '入库存储'
        },
        {
          status: SAMPLE_STATUS.EXPIRED,
          timestamp: new Date(now - 30 * 60 * 1000).toISOString(),
          operator: 'system',
          source: 'system',
          remark: '自动标记过期'
        }
      ],
      inspectionResult: null,
      inspectionTime: null,
      inspector: null,
      destroyTime: null,
      destroyer: null,
      createdAt: new Date(now - 27 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      sampleBoxCode: 'BOX-004',
      pastryName: '凤梨酥',
      pastryType: '烘烤糕点',
      productionBatch: 'P20240516-003',
      productionLine: 'C线-3号机',
      productionTime: new Date(now - 50 * 60 * 60 * 1000).toISOString(),
      productionQuantity: 1000,
      sampler: '王五',
      sampleQuantity: 5,
      storageLocation: 'B区-02-08',
      storageTemperature: 20,
      retentionPeriod: 48,
      status: SAMPLE_STATUS.DESTROYED,
      statusHistory: [
        {
          status: SAMPLE_STATUS.CREATED,
          timestamp: new Date(now - 49 * 60 * 60 * 1000).toISOString(),
          operator: '王五',
          source: 'manual',
          remark: '留样创建'
        },
        {
          status: SAMPLE_STATUS.IN_STORAGE,
          timestamp: new Date(now - 48.5 * 60 * 60 * 1000).toISOString(),
          operator: '李四',
          source: 'manual',
          remark: '入库存储'
        },
        {
          status: SAMPLE_STATUS.INSPECTED,
          timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
          operator: '质检-赵六',
          source: 'manual',
          remark: '送检完成'
        },
        {
          status: SAMPLE_STATUS.DESTROYED,
          timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
          operator: '李四',
          source: 'manual',
          remark: '检验后销毁'
        }
      ],
      inspectionResult: '合格',
      inspectionTime: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      inspector: '质检-赵六',
      destroyTime: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      destroyer: '李四',
      createdAt: new Date(now - 49 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      sampleBoxCode: 'BOX-005',
      pastryName: '桂花糕',
      pastryType: '蒸制糕点',
      productionBatch: 'P20240518-003',
      productionLine: 'B线-2号机',
      productionTime: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      productionQuantity: 300,
      sampler: '张三',
      sampleQuantity: 2,
      storageLocation: 'A区-01-03',
      storageTemperature: 15,
      retentionPeriod: 72,
      status: SAMPLE_STATUS.CREATED,
      statusHistory: [
        {
          status: SAMPLE_STATUS.CREATED,
          timestamp: new Date(now - 90 * 60 * 1000).toISOString(),
          operator: '张三',
          source: 'api',
          remark: 'API创建留样'
        }
      ],
      inspectionResult: null,
      inspectionTime: null,
      inspector: null,
      destroyTime: null,
      destroyer: null,
      createdAt: new Date(now - 90 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 90 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      sampleBoxCode: 'BOX-006',
      pastryName: '桃酥',
      pastryType: '酥性糕点',
      productionBatch: 'P20240518-004',
      productionLine: 'D线-4号机',
      productionTime: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      productionQuantity: 1200,
      sampler: '王五',
      sampleQuantity: 6,
      storageLocation: 'C区-03-01',
      storageTemperature: 28,
      retentionPeriod: 168,
      status: SAMPLE_STATUS.CREATED,
      statusHistory: [
        {
          status: SAMPLE_STATUS.CREATED,
          timestamp: new Date(now - 30 * 60 * 1000).toISOString(),
          operator: '王五',
          source: 'manual',
          remark: '留样创建'
        }
      ],
      inspectionResult: null,
      inspectionTime: null,
      inspector: null,
      destroyTime: null,
      destroyer: null,
      createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString()
    },
    {
      id: uuidv4(),
      sampleBoxCode: 'BOX-002',
      pastryName: '绿豆糕',
      pastryType: '蒸制糕点',
      productionBatch: 'P20240518-005',
      productionLine: 'B线-2号机',
      productionTime: new Date(now - 30 * 60 * 1000).toISOString(),
      productionQuantity: 400,
      sampler: '张三',
      sampleQuantity: 2,
      storageLocation: 'A区-01-05',
      storageTemperature: 18,
      retentionPeriod: 72,
      status: SAMPLE_STATUS.IN_STORAGE,
      statusHistory: [
        {
          status: SAMPLE_STATUS.CREATED,
          timestamp: new Date(now - 20 * 60 * 1000).toISOString(),
          operator: '张三',
          source: 'manual',
          remark: '留样创建-重复盒号测试'
        },
        {
          status: SAMPLE_STATUS.IN_STORAGE,
          timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
          operator: '李四',
          source: 'manual',
          remark: '入库存储'
        }
      ],
      inspectionResult: null,
      inspectionTime: null,
      inspector: null,
      destroyTime: null,
      destroyer: null,
      createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 15 * 60 * 1000).toISOString()
    }
  ];
  
  store.initSamples(samples);
  console.log(`已初始化 ${samples.length} 条留样记录`);
  console.log('样例数据包含不同状态的留样，以及一个重复盒号的测试案例');
  
  return samples;
}

if (require.main === module) {
  createInitialSamples();
}

module.exports = { createInitialSamples };
