import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
  ============================================
  养老目标基金换仓记录对账系统已启动
  ============================================
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API文档:
    POST   /api/records/import          - 第一步：导入客户经理补充邮件
    GET    /api/records                 - 获取所有记录
    GET    /api/records/:id             - 获取单条记录详情
    POST   /api/records/:id/supply-batch     - 第二步：补录清算批次号
    POST   /api/records/:id/resolve-conflict - 处理冲突（确认/驳回）
    POST   /api/records/:id/supervisor-review - 结算主管复核拆分行
    POST   /api/records/:id/update-diff      - 第三步：更新差异清单
    POST   /api/records/:id/complete         - 完成流程
    GET    /api/records/:id/export           - 导出明细
    POST   /api/records/:id/self-check       - 执行自检
  ============================================
  `);
});
