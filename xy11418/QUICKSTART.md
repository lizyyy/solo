# 物业维修派单验收回放链路服务

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 造数（生成测试数据）
```bash
npm run seed
```

### 3. 启动服务
```bash
npm start
```

### 4. 运行端到端测试（另开终端）
```bash
node scripts/e2e-test.js
```

### 5. 运行curl测试脚本
```bash
bash scripts/curl-tests.sh
```

---

## 核心API列表

### 建账类
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/orders | 创建报修单 |
| POST | /api/v1/receipts | 创建维修回执 |
| POST | /api/v1/materials | 创建材料领用 |
| POST | /api/v1/refunds | 创建退款流水 |

### 查询类
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/orders | 报修单列表 |
| GET | /api/v1/orders/:orderNo | 报修单详情 |
| GET | /api/v1/chain/:orderNo | 完整链路回放 |

### 对账类
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/reconcile/:orderNo | 生成对账快照 |
| GET | /api/v1/snapshots/:orderNo | 快照列表 |
| GET | /api/v1/snapshots/compare/:s1/:s2 | 快照对比 |
| POST | /api/v1/discrepancy | 添加差异记录 |

### 导出类
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/export/order/:orderNo | 单条订单CSV |
| GET | /api/v1/export/summary | 全部汇总CSV |
| GET | /api/v1/export/dirty-records | 脏记录导出 |

### 脏记录管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/dirty-records | 脏记录列表 |
| PUT | /api/v1/dirty-records/:id/resolve | 标记已解决 |

### 审计
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/audit-logs | 操作日志 |

---

## 脏记录类型
- `missing_field` - 缺字段
- `cross_date` - 跨日/时间顺序错
- `name_changed` - 改名
- `amount_conflict` - 金额冲突
- `quantity_conflict` - 数量冲突
- `duplicate_order` - 重复单据

---

## 数据文件位置
- 数据库: `data/repair.db`
- 导出文件: `data/exports/`
- 日志文件: `data/logs/`
