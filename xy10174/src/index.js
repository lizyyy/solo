const createApp = require('./app');

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    const app = await createApp();
    
    app.listen(PORT, () => {
      console.log(`服务已启动，监听端口: ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API 端点:`);
      console.log(`  - POST /api/budget/departments - 创建部门`);
      console.log(`  - POST /api/budget/budgets - 创建预算`);
      console.log(`  - POST /api/budget/locks - 锁定预算`);
      console.log(`  - PUT /api/budget/locks/:lockId - 修改锁定金额`);
      console.log(`  - POST /api/budget/locks/:lockId/release - 释放锁定`);
      console.log(`  - POST /api/budget/locks/:lockId/commit - 提交锁定`);
      console.log(`  - POST /api/approvals - 创建审批`);
      console.log(`  - POST /api/approvals/:id/approve - 审批通过`);
      console.log(`  - POST /api/approvals/:id/reject - 审批拒绝`);
      console.log(`  - GET /api/reports/departments - 所有部门报表`);
      console.log(`  - GET /api/reports/departments/:id - 部门报表`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

main();
