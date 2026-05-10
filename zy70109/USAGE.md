# 土地流转合同履约 API 使用说明

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
```bash
npm start
```
服务将在 `http://localhost:3000` 启动

### 3. 运行演示脚本
新开一个终端窗口：
```bash
node test-demo.js
```
这个脚本会演示所有核心功能。

---

## 怎么确认功能可用？

### 方法一：看演示脚本输出
运行 `node test-demo.js` 后，你会看到 12 个步骤的执行结果：
- [OK] 表示功能正常
- 每一步都有明确的输出说明发生了什么

### 方法二：用浏览器或 curl 验证

**查看所有合同：**
```bash
curl http://localhost:3000/contracts
```

**查看单个合同详情：**
```bash
curl http://localhost:3000/contracts/{合同ID}
```

**查看版本历史：**
```bash
curl http://localhost:3000/contracts/{合同ID}/versions
```

**查看履约汇总：**
```bash
curl http://localhost:3000/performance
```

**导出履约报告：**
```bash
curl http://localhost:3000/contracts/{合同ID}/performance/export
```

### 方法三：验证数据持久化
1. 先运行演示脚本创建数据
2. 停止服务（Ctrl+C）
3. 重新启动服务（npm start）
4. 再次访问上述 API，数据应该还在

> 数据保存在 `data/contracts.db` 文件中

---

## 核心功能说明

### 1. 合同版本管理
- 每次修改合同自动创建新版本
- 旧版本数据保留，可随时追溯
- 接口：`PUT /contracts/:id`

### 2. 地块面积管理
- 每个版本独立记录地块列表
- 支持增加、减少、修改地块
- 总面积自动计算

### 3. 租金计划管理
- 分阶段设置租金计划
- 每期租金独立状态（待支付/已支付）
- 支付时验证金额匹配

### 4. 续签审批
- 先申请，后审批
- 审批通过自动创建新版本
- 支持调整租金和期限

### 5. 违约提醒
- 记录违约类型和描述
- 影响履约状态
- 支持标记为已解决

### 6. 履约导出
- 完整的历史记录导出
- 包含：版本历史、租金状态、违约记录、续签记录
- 时间戳标记导出时间

---

## 并发保护机制

### 防止重复支付
```
尝试对已支付的租金计划再次支付 → 返回错误
```
演示脚本第 3 步会验证这个功能。

### 防止重复续签申请
```
同一合同同时只能有一个待审批的续签申请
```

### 资源锁定机制
- 关键操作（支付、修改、审批）都会锁定资源
- 超时 30 秒自动释放
- 支持重试机制

---

## API 完整列表

### 合同管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /contracts | 创建合同 |
| GET | /contracts | 列表所有合同 |
| GET | /contracts/:id | 查看合同详情 |
| PUT | /contracts/:id | 修改合同（创建新版本） |
| GET | /contracts/:id/versions | 查看版本历史 |

### 租金管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /contracts/:id/rent/pay | 支付租金 |

### 续签管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /contracts/:id/renewals | 创建续签申请 |
| GET | /contracts/:id/renewals | 查看续签申请列表 |
| POST | /renewals/:id/approve | 审批通过 |
| POST | /renewals/:id/reject | 审批拒绝 |

### 违约管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /contracts/:id/breaches | 创建违约提醒 |
| GET | /contracts/:id/breaches | 查看违约记录 |
| POST | /breaches/:id/resolve | 标记为已解决 |

### 履约管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /performance | 查看履约汇总列表 |
| GET | /contracts/:id/performance/export | 导出完整履约报告 |

---

## 下一步该查哪里？

### 想看合同变了几次？
→ 查版本历史：`GET /contracts/:id/versions`

### 想知道租金付了多少？
→ 查履约导出：`GET /contracts/:id/performance/export` 里的 `rent_status`

### 想看有没有违约？
→ 查履约汇总：`GET /performance` 里的 `unresolved_breach_count`

### 想看续签记录？
→ 查续签列表：`GET /contracts/:id/renewals`

### 数据存在哪里？
→ `data/contracts.db`（SQLite 数据库文件）

---

## 请求示例

### 创建合同
```json
{
  "contract_no": "HT-2024-001",
  "parties": {
    "transferor": "张三",
    "transferee": "李四"
  },
  "start_date": "2024-01-01",
  "end_date": "2026-01-01",
  "land_plots": [
    { "plot_no": "P1", "area": 50.5, "location": "东村一组" }
  ],
  "rent_plans": [
    { "period_start": "2024-01-01", "period_end": "2025-01-01", "amount": 10000 }
  ]
}
```

### 支付租金
```json
{
  "plan_id": "租金计划ID",
  "amount": 10000
}
```

### 申请续签
```json
{
  "requested_end_date": "2028-01-01",
  "new_rent": 25000
}
```

### 审批续签
```json
{
  "approved_by": "审批人姓名"
}
```

### 记录违约
```json
{
  "type": "rent_overdue",
  "description": "租金逾期未支付"
}
```
