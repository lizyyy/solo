import { Router, Request, Response } from 'express';
import { ExperimentEngine } from '../engine/ExperimentEngine';
import { ExperimentConfig, QuerySample } from '../types';

const router = Router();

const experiments: Map<string, ExperimentEngine> = new Map();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

router.post('/experiment/create', (req: Request, res: Response) => {
  try {
    const config: ExperimentConfig = req.body;
    
    if (!config.id) {
      config.id = `exp_${Date.now()}`;
    }
    
    const engine = new ExperimentEngine(config);
    engine.generateSeedData();
    
    experiments.set(config.id, engine);
    
    const indexStats = engine.getIndexStats();
    
    res.json({
      success: true,
      experimentId: config.id,
      message: 'Experiment created and data generated successfully',
      stats: {
        tableRows: engine.getTableData().rowCount,
        bplusTree: indexStats.bplus,
        hashIndex: indexStats.hash,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/experiment/:id/run', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const engine = experiments.get(id);
    
    if (!engine) {
      return res.status(404).json({
        success: false,
        message: `Experiment ${id} not found`,
      });
    }
    
    const result = engine.runAllQueries();
    
    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/experiment/:id/run-query', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { queryId } = req.body;
    const engine = experiments.get(id);
    
    if (!engine) {
      return res.status(404).json({
        success: false,
        message: `Experiment ${id} not found`,
      });
    }
    
    const result = engine.runQuery(queryId);
    
    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/experiment/:id/visualization/bplus', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const engine = experiments.get(id);
    
    if (!engine) {
      return res.status(404).json({
        success: false,
        message: `Experiment ${id} not found`,
      });
    }
    
    const visualization = engine.getBPlusVisualization();
    
    res.json({
      success: true,
      visualization,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/experiment/:id/visualization/hash', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const engine = experiments.get(id);
    
    if (!engine) {
      return res.status(404).json({
        success: false,
        message: `Experiment ${id} not found`,
      });
    }
    
    const visualization = engine.getHashVisualization();
    
    res.json({
      success: true,
      visualization,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/experiment/:id/stats', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const engine = experiments.get(id);
    
    if (!engine) {
      return res.status(404).json({
        success: false,
        message: `Experiment ${id} not found`,
      });
    }
    
    const stats = engine.getIndexStats();
    const tableData = engine.getTableData();
    
    res.json({
      success: true,
      stats: {
        table: {
          rowCount: tableData.rowCount,
        },
        bplusTree: stats.bplus,
        hashIndex: stats.hash,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.delete('/experiment/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    experiments.delete(id);
    
    res.json({
      success: true,
      message: `Experiment ${id} deleted`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/templates/default', (req: Request, res: Response) => {
  const defaultConfig: ExperimentConfig = {
    id: 'default_template',
    name: '默认索引对比实验',
    seed: 42,
    tables: [
      {
        name: 'employees',
        columns: [
          { name: 'id', type: 'number', nullable: false },
          { name: 'name', type: 'string', nullable: false },
          { name: 'age', type: 'number', nullable: true },
          { name: 'department', type: 'string', nullable: true },
          { name: 'salary', type: 'number', nullable: true },
          { name: 'city', type: 'string', nullable: true },
          { name: 'joinDate', type: 'string', nullable: true },
          { name: 'isActive', type: 'boolean', nullable: true },
        ],
        primaryKey: 'id',
      },
    ],
    indexes: [
      {
        name: 'idx_emp_id',
        type: 'bplus',
        table: 'employees',
        columns: ['id'],
        isUnique: true,
        order: 'asc',
      },
    ],
    queries: [
      {
        id: 'q1',
        name: '等值查询 - 查找员工ID=50',
        type: 'equality',
        table: 'employees',
        index: 'idx_emp_id',
        conditions: [{ column: 'id', operator: '=', value: 50 }],
        description: '测试单值等值查询性能',
      },
      {
        id: 'q2',
        name: '范围查询 - 查找ID在10到30之间的员工',
        type: 'range',
        table: 'employees',
        index: 'idx_emp_id',
        conditions: [
          { column: 'id', operator: '>=', value: 10 },
          { column: 'id', operator: '<=', value: 30 },
        ],
        description: '测试范围查询性能（哈希索引不支持）',
      },
      {
        id: 'q3',
        name: '前缀查询 - 查找姓名以"张"开头的员工',
        type: 'prefix',
        table: 'employees',
        index: 'idx_emp_id',
        conditions: [{ column: 'name', operator: 'LIKE', value: '张%' }],
        description: '测试前缀匹配查询性能（哈希索引不支持）',
      },
      {
        id: 'q4',
        name: '插入操作 - 新增员工',
        type: 'insert',
        table: 'employees',
        index: 'idx_emp_id',
        conditions: [],
        values: {
          id: 9999,
          name: '测试员工',
          age: 28,
          department: '技术部',
          salary: 15000,
          city: '北京',
          joinDate: '2024-01-01',
          isActive: true,
        },
        description: '测试插入操作性能',
      },
      {
        id: 'q5',
        name: '删除操作 - 删除员工',
        type: 'delete',
        table: 'employees',
        index: 'idx_emp_id',
        conditions: [{ column: 'id', operator: '=', value: 25 }],
        description: '测试删除操作性能',
      },
    ],
    dataSize: 100,
    bplusOrder: 5,
    hashLoadFactor: 0.75,
    hashInitialBuckets: 16,
  };

  res.json({
    success: true,
    config: defaultConfig,
  });
});

export { router as indexRouter };
