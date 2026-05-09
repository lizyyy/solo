const pool = require('../src/database/pool');
const logger = require('../src/utils/logger');

async function seedDatabase() {
  try {
    const client = await pool.connect();
    
    logger.info('正在初始化测试数据...');
    
    await client.query('BEGIN');
    
    const techDeptResult = await client.query(
      `INSERT INTO departments (name, total_budget, used_budget, locked_budget, available_budget)
       VALUES ('技术部', 100000.00, 0.00, 0.00, 100000.00)
       ON CONFLICT (name) DO UPDATE SET total_budget = 100000.00
       RETURNING id`
    );
    
    const salesDeptResult = await client.query(
      `INSERT INTO departments (name, total_budget, used_budget, locked_budget, available_budget)
       VALUES ('销售部', 150000.00, 0.00, 0.00, 150000.00)
       ON CONFLICT (name) DO UPDATE SET total_budget = 150000.00
       RETURNING id`
    );
    
    const hrDeptResult = await client.query(
      `INSERT INTO departments (name, total_budget, used_budget, locked_budget, available_budget)
       VALUES ('人力资源部', 50000.00, 0.00, 0.00, 50000.00)
       ON CONFLICT (name) DO UPDATE SET total_budget = 50000.00
       RETURNING id`
    );
    
    const techDeptId = techDeptResult.rows[0].id;
    const salesDeptId = salesDeptResult.rows[0].id;
    const hrDeptId = hrDeptResult.rows[0].id;
    
    await client.query(
      `INSERT INTO employees (name, department_id, position)
       VALUES 
         ('张三', $1, '高级工程师'),
         ('李四', $1, '产品经理'),
         ('王五', $2, '销售总监'),
         ('赵六', $2, '客户经理'),
         ('钱七', $3, 'HR主管')
       ON CONFLICT DO NOTHING`,
      [techDeptId, salesDeptId, hrDeptId]
    );
    
    await client.query('COMMIT');
    
    logger.info('测试数据初始化完成！');
    logger.info('部门数据：', {
      '技术部': { id: techDeptId, budget: '¥100,000.00' },
      '销售部': { id: salesDeptId, budget: '¥150,000.00' },
      '人力资源部': { id: hrDeptId, budget: '¥50,000.00' }
    });
    
    client.release();
    process.exit(0);
  } catch (error) {
    logger.error('测试数据初始化失败', { error: error.message });
    process.exit(1);
  }
}

seedDatabase();
