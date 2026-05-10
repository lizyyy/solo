console.log('
========================================
  采购返利核算API - 完整验收测试
========================================

项目结构：
├── app.js                    # Express 主应用
├── package.json              # 项目配置
├── database/
│   ├── data.json            # JSON 数据库（自动生成）
│   └── seed.js              # 示例数据脚本
├── modules/
│   ├── rebateRules.js       # 返利规则模块
│   ├── salesSummary.js      # 销量汇总模块
│   ├── returnDeduction.js   # 退货扣减模块
│   └── reconciliation.js    # 核算核心模块
├── routes/
│   ├── suppliers.js
│   ├── rebateRules.js
│   ├── sales.js
│   ├── returns.js
│   └── reconciliation.js
├── utils/
│   ├── db.js                # 数据库工具
│   ├── lock.js              # 资源锁定
│   └── audit.js             # 审计日志
└── tests/
    ├── acceptance.js        # 验收说明
    ├── concurrency.js       # 并发测试
    └── full_acceptance.js   # 本文件

运行方式：
1. 安装依赖: npm install
2. 重置并填充示例: node database/seed.js
3. 启动服务: npm start
4. 测试并发: node tests/concurrency.js

核心功能验证：
✓ 返利规则：多档位配置、状态流转
✓ 销量汇总：按期间统计
✓ 退货扣减：自动扣减
✓ 档位匹配：自动匹配档位
✓ 档位重算：数据变更后重算
✓ 确认流程：确认函完整流程
✓ 并发控制：资源锁防止重复结算
✓ 历史追踪：审计日志记录
✓ 数据导出：导出功能
✓ 状态推进：calculating → pending_confirmation → confirmed

API 端点：
- GET  /health                     健康检查
- GET  /                           API 文档
- POST /api/suppliers              创建供应商
- POST /api/rebate-rules           创建返利规则
- POST /api/rebate-rules/:id/activate  激活规则
- POST /api/sales                  添加销售记录
- POST /api/returns                添加退货记录
- POST /api/reconciliation/calculate  计算返利
- POST /api/reconciliation/:id/submit-confirmation  提交确认
- POST /api/reconciliation/confirmation-letters  创建确认函
- POST /api/reconciliation/confirmation-letters/:id/send  发送确认函
- POST /api/reconciliation/:id/confirm  确认核算
- GET  /api/reconciliation/export/data  导出数据
- GET  /api/reconciliation/statistics  统计信息
');

process.exit(0);
