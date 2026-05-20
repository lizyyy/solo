# 快闪摊位对账服务

招商运营对账管理系统，整合摊位申请、证照附件、场地档期，实现自动比对、人工复核、费用重新计算和报告导出功能。

## 功能特性

- ✅ **数据导入**：支持摊位申请、证照附件、场地日历的CSV批量导入
- ✅ **自动比对**：证照过期检查、时间冲突检测、费用不匹配识别
- ✅ **差异解释**：每条差异记录都有详细的说明和处理建议
- ✅ **人工复核**：支持批准、拒绝、要求补材料、调整费用四种复核操作
- ✅ **重新计算**：复核调整后自动重新计算费用
- ✅ **报告导出**：支持CSV和PDF格式的对账单导出

## 项目结构

```
.
├── src/
│   ├── models/
│   │   ├── types.ts        # 类型定义
│   │   └── store.ts        # 数据存储
│   ├── services/
│   │   ├── ImportService.ts          # 导入服务
│   │   ├── ReconciliationService.ts  # 对账核心服务
│   │   └── ReportService.ts          # 报告生成服务
│   ├── controllers/
│   │   └── ReconciliationController.ts  # API控制器
│   └── index.ts           # 服务入口
├── uploads/               # 上传文件临时目录
├── reports/               # 生成报告目录
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 3. 体验流程

1. **批量创建对账记录**
```bash
curl -X POST http://localhost:3000/api/reconciliations/batch
```

2. **查看对账结果**
```bash
curl http://localhost:3000/api/reconciliations
```

3. **复核差异（示例）**
```bash
curl -X POST http://localhost:3000/api/reconciliations/{id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "discrepancyId": "{discrepancyId}",
    "reviewer": "张三",
    "result": "ADJUST_AND_APPROVE",
    "notes": "商户同意调整费用，批准通过",
    "adjustmentAmount": 500,
    "adjustmentReason": "时间冲突费用调整"
  }'
```

4. **导出对账单PDF**
```bash
curl -o reconciliation.pdf http://localhost:3000/api/reconciliations/{id}/export/pdf
```

## API 接口列表

### 基础数据
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/applications | 获取所有摊位申请 |
| GET | /api/licenses | 获取所有证照附件 |
| GET | /api/venue-calendar | 获取场地档期 |

### 对账管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reconciliations | 创建单个对账记录 |
| POST | /api/reconciliations/batch | 批量创建对账记录 |
| GET | /api/reconciliations | 获取所有对账记录 |
| GET | /api/reconciliations/:id | 获取单个对账记录详情 |
| POST | /api/reconciliations/:id/review | 复核差异 |
| POST | /api/reconciliations/:id/complete | 完成对账 |
| GET | /api/summary | 获取对账汇总统计 |

### 数据导入
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/applications | 导入摊位申请CSV |
| POST | /api/import/licenses | 导入证照附件CSV |
| POST | /api/import/venue-calendar | 导入场地日历CSV |

### 报告导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reconciliations/:id/export/csv | 导出单个对账单CSV |
| GET | /api/reconciliations/:id/export/pdf | 导出单个对账单PDF |
| GET | /api/export/summary/csv | 导出对账汇总CSV |
| GET | /api/export/summary/pdf | 导出对账汇总PDF |

## 复核结果类型

- `APPROVE` - 批准：无异议，直接通过
- `REJECT` - 拒绝：驳回申请
- `REQUEST_DOCUMENTS` - 要求补材料：需要商户补充证照
- `ADJUST_AND_APPROVE` - 调整并批准：调整费用后通过

## 差异类型说明

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| LICENSE_EXPIRED | 证照过期 | HIGH |
| TIME_CONFLICT | 摊位时间冲突 | HIGH |
| MISSING_DOCUMENT | 缺失必需证照 | HIGH |
| FEE_MISMATCH | 实际使用天数与费用不匹配 | MEDIUM |

## 样例数据说明

系统已预置以下样例数据：

1. **摊位申请（3个）**
   - APP-2026-001 星光美食有限公司（A区-01号，6月1日-7日）
   - APP-2026-002 潮流饰品店（B区-03号，6月1日-3日）
   - APP-2026-003 创意手作工坊（A区-01号，6月5日-7日）

2. **证照附件**
   - 星光美食营业执照（已过期）
   - 星光美食消防合格证（有效）
   - 潮流饰品营业执照（有效）

3. **场地档期**
   - A区-01号：6月1-4日被星光美食预订，6月5-7日被创意手作预订 → 存在时间冲突
   - B区-03号：6月1-3日被潮流饰品预订

## 技术栈

- Node.js + Express
- TypeScript
- csv-parser / json2csv（CSV处理）
- pdfkit（PDF生成）
- dayjs（日期处理）
- uuid（唯一ID生成）

## 许可证

MIT
