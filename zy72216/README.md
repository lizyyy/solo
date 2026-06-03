# 私募持仓穿透核对系统

## 一、系统定位

解决对账运营阿芬最头疼的问题：**临时补材料、数据不一致、口说无凭**。特别是「T+1到账被手工改成T+2」这种记录，确保：

- ✅ 页面展示、API返回、导出明细 **读同一份结果**
- ✅ 托管确认页原始行号、人工改动、处理状态 **全部留下证据**
- ✅ T+1→T+2改动 **必须经基金经理复核**，不能直接归正常
- ✅ 边界规则 **写在代码和文档里**，不依赖口头约定

---

## 二、核心三步流程（现场最常见的错口径和补录返工）

```
Step 1: 托管确认页第一次导入
    ↓ (记录原始行号、原始值)
Step 2: 对账运营阿芬补看除权日截图
    ↓ (上传截图证据，如发现T+1→T+2自动进入待复核)
Step 3: 对账说明更新
    ↓ (无异常 → 标记正常; 有T+1→T+2 → 基金经理复核 → 标记正常)
```

### 2.1 Step 1: 托管确认页导入

**API**: `POST /api/records/import`

**必须保留的字段**:
| 字段 | 说明 | 溯源用途 |
|------|------|----------|
| `original_line_number` | 托管确认页原始行号 | 基金经理追问时，快速定位原始位置 |
| `original_settlement_date` | 原始到账日 | 对比是否被手工改动 |
| `original_quantity` | 原始数量 | 对比是否被手工改动 |
| `original_amount` | 原始金额 | 对比是否被手工改动 |
| `import_operator` | 导入操作员 | 谁导入的 |
| `import_time` | 导入时间 | 何时导入的 |

**注意**: 导入时 `original_*` 和 `current_*` 字段值相同。

---

### 2.2 Step 2: 补看除权日截图

**API**: `POST /api/records/:id/screenshot`

对账运营阿芬对照除权日截图，核对到账日是否正确。

**系统自动检测**:
- 如果截图显示T+2，但原始导入是T+1 → 记录T+1→T+2手工改动
- 自动将状态流转到 `PENDING_MANAGER_REVIEW`（待基金经理复核）
- **不能**直接标记为正常

---

### 2.3 Step 3: 更新对账说明

**API**: `POST /api/records/:id/note`

记录核对过程中的发现和处理方式，作为审计证据。

---

## 三、T+1 → T+2 手工改动边界规则（写在代码里）

### 3.1 检测规则

代码位置: [utils/boundary-rules.js](file:///Users/lzy/pro/solo/workspaces/zy72216/utils/boundary-rules.js#L21-L24)

```javascript
function detectT1ToT2ManualChange(oldValue, newValue) {
  const days = daysBetween(oldValue, newValue);
  return days === 1;  // 相差1天即判定为T+1→T+2
}
```

### 3.2 状态流转规则

代码位置: [utils/boundary-rules.js](file:///Users/lzy/pro/solo/workspaces/zy72216/utils/boundary-rules.js#L41-L43)

```
T+1→T+2改动 → 自动进入 PENDING_MANAGER_REVIEW
    ↓ 必须经基金经理复核
    不能直接 → NORMAL (正常)
```

### 3.3 标记正常条件

代码位置: [utils/boundary-rules.js](file:///Users/lzy/pro/solo/workspaces/zy72216/utils/boundary-rules.js#L82-L87)

```javascript
function canFinalize(status, record) {
  // T+1→T+2改动的记录，必须基金经理复核通过才能标记正常
  if (record.has_manual_change && record.change_type === CHANGE_TYPE.T1_TO_T2_MANUAL) {
    return status === STATUS.MANAGER_APPROVED;
  }
  // 无异常改动，补看截图后即可标记正常
  return status === STATUS.SCREENSHOT_REVIEWED;
}
```

### 3.4 回滚规则

代码位置: [utils/boundary-rules.js](file:///Users/lzy/pro/solo/workspaces/zy72216/utils/boundary-rules.js#L66-L80)

| 当前状态 | 回滚到 | 回滚操作 |
|----------|--------|----------|
| SCREENSHOT_REVIEWED | IMPORTED | 恢复原始数据，清除改动标记 |
| PENDING_MANAGER_REVIEW | SCREENSHOT_REVIEWED | 恢复原始数据，清除改动标记 |
| MANAGER_APPROVED | PENDING_MANAGER_REVIEW | 恢复原始数据，清除改动标记 |
| NORMAL | MANAGER_APPROVED | 恢复原始数据，清除改动标记 |
| REVERTED | IMPORTED | - |

**回滚不删除历史日志**，所有操作可追溯。

---

## 四、完整状态定义和流转

代码位置: [utils/constants.js](file:///Users/lzy/pro/solo/workspaces/zy72216/utils/constants.js#L13-L55)

### 4.1 状态列表

| 状态码 | 状态名称 | 说明 |
|--------|----------|------|
| `IMPORTED` | 已导入 | 托管确认页第一次导入完成 |
| `SCREENSHOT_REVIEWED` | 已补看截图 | 阿芬已补看除权日截图，无异常 |
| `PENDING_MANAGER_REVIEW` | 待基金经理复核 | 检测到T+1→T+2改动，等基金经理看 |
| `MANAGER_APPROVED` | 基金经理复核通过 | 基金经理同意T+1→T+2改动 |
| `MANAGER_REJECTED` | 基金经理复核驳回 | 基金经理不同意，需重新核对 |
| `NORMAL` | 正常 | 核对完成，无问题 |
| `REVERTED` | 已回滚 | 操作已回滚 |

### 4.2 允许的状态流转

```
IMPORTED → SCREENSHOT_REVIEWED → PENDING_MANAGER_REVIEW → MANAGER_APPROVED → NORMAL
   ↓            ↓                       ↓                        ↓           ↓
REVERTED     REVERTED              REVERTED                 REVERTED    REVERTED
                ↑
         MANAGER_REJECTED → SCREENSHOT_REVIEWED
```

---

## 五、数据一致性保证（三源同数）

**页面展示、API返回、文件导出都调用同一个数据服务**，确保不会出现一个地方显示异常、另一个地方消失的情况。

代码位置: [services/unified-data-service.js](file:///Users/lzy/pro/solo/workspaces/zy72216/services/unified-data-service.js)

| 入口 | 调用 |
|------|------|
| 页面列表 | `getAllRecordsWithDetails()` |
| 页面详情 | `getFullRecordById()` |
| API查询 | `getAllRecordsWithDetails()` / `getFullRecordById()` |
| JSON导出 | `getExportData()` |
| Excel导出 | `getExportData()` |
| CSV导出 | `getExportData()` |

### 5.1 导出字段（和页面展示完全一致）

导出明细包含：批次号、原始行号、基金代码、基金名称、证券代码、证券名称、
原始到账日、当前到账日、原始数量、当前数量、原始金额、当前金额、
处理状态、是否人工改动、改动类型、导入操作员、导入时间、
人工改动记录、对账说明。

**证据链完整**：基金经理追问时，不用只看一个汇总数，能看到每一步操作。

---

## 六、人工改动日志（证据链）

每一次人工改动都记录在 `manual_change_logs` 表，包含：

| 字段 | 说明 |
|------|------|
| `field_name` | 改动的字段（到账日/数量/金额） |
| `old_value` | 原值 |
| `new_value` | 新值 |
| `change_reason` | 改动原因（必填） |
| `operator` | 操作员 |
| `operate_time` | 操作时间 |
| `evidence_screenshot` | 证据截图路径 |

---

## 七、API 接口清单

### 7.1 记录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/records/import` | 第一步：导入托管确认页 |
| GET | `/api/records` | 查询记录列表（和导出同一份数据） |
| GET | `/api/records/:id` | 查询单条记录详情（含全部证据链） |
| POST | `/api/records/:id/manual-change` | 记录人工改动 |
| POST | `/api/records/:id/screenshot` | 第二步：上传除权日截图 |
| POST | `/api/records/:id/note` | 第三步：更新对账说明 |
| POST | `/api/records/:id/manager-review` | 基金经理复核 |
| POST | `/api/records/:id/finalize` | 标记为正常 |
| POST | `/api/records/:id/revert` | 回滚 |

### 7.2 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/json` | 导出JSON格式 |
| GET | `/api/export/excel` | 导出Excel格式 |
| GET | `/api/export/csv` | 导出CSV格式 |

### 7.3 规则查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rules` | 查询所有边界规则 |
| GET | `/api/rules/t1-to-t2` | 查询T+1→T+2处理规则 |
| GET | `/api/rules/transitions` | 查询状态流转规则 |

---

## 八、快速开始

### 8.1 初始化数据库

```bash
npm run init-db
```

### 8.2 安装依赖

```bash
npm install
```

### 8.3 启动服务

```bash
npm start
```

服务地址: http://localhost:3000

### 8.4 运行测试场景

```bash
npm test
```

---

## 九、典型场景演示（T+1→T+2手工改动）

### 场景：托管确认页显示T+1，除权日截图显示T+2

1. **阿芬导入托管确认页**（5条记录，到账日2026-06-02，T+1）
2. **阿芬补看除权日截图**，发现第3行宁德时代的到账日实际是T+2（2026-06-03）
3. **阿芬记录人工改动**：到账日从 2026-06-02 改为 2026-06-03，原因：除权日截图显示为T+2
4. **系统自动检测**：相差1天 → 判定为T+1→T+2手工改动 → 状态自动变为「待基金经理复核」
5. **系统阻止直接标记正常**：提示必须基金经理复核
6. **基金经理登录复核**：查看原始行号、原始到账日、当前到账日、改动日志、除权日截图证据
7. **基金经理复核通过**：填写意见「情况属实，同意调整」
8. **阿芬标记为正常**：此时才允许标记正常
9. **导出明细**：包含原始行号、原始到账日、当前到账日、改动记录、复核意见

### 回滚演示

1. 发现改动有误，点击「回滚」
2. 系统自动恢复原始到账日2026-06-02
3. 清除人工改动标记
4. 状态回退到「已补看截图」
5. 所有历史日志保留，可追溯

---

## 十、项目结构

```
.
├── models/                    # 数据模型
│   ├── db.js                  # 数据库连接
│   ├── custodian-record.js    # 托管确认记录
│   ├── manual-change-log.js   # 人工改动日志
│   ├── status-transition.js   # 状态流转
│   ├── ex-right-screenshot.js # 除权日截图
│   └── reconciliation-note.js # 对账说明
├── routes/                    # API路由
│   ├── records.js             # 记录管理
│   ├── export.js              # 数据导出
│   └── rules.js               # 规则查询
├── services/                  # 业务服务（核心）
│   ├── reconciliation-service.js   # 核对流程服务
│   └── unified-data-service.js     # 统一数据服务（三源同数）
├── utils/                     # 工具模块
│   ├── constants.js           # 常量定义（状态、改动类型）
│   └── boundary-rules.js      # 边界规则（T+1→T+2判定等）
├── public/                    # 前端页面
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── scripts/                   # 脚本
│   └── init-db.js             # 数据库初始化
├── test/                      # 测试
│   └── test-scenarios.js      # 场景测试
├── data/                      # 数据库文件
├── uploads/                   # 上传文件
├── server.js                  # 服务入口
├── package.json
└── README.md                  # 本文档
```

---

## 十一、禁止操作（写在代码校验里）

❌ **禁止** T+1→T+2改动后跳过基金经理复核直接标记正常  
❌ **禁止** 删除历史日志（所有操作永久留痕）  
❌ **禁止** 不填改动原因就记录人工改动  
❌ **禁止** 修改 `original_*` 原始字段（导入后只读）

---

## 十二、注意事项

1. **原始行号永久保留**：即使记录被回滚，原始行号仍在，方便追溯
2. **改动不覆盖原始值**：`original_*` 永远保存导入时的值，`current_*` 保存当前值，对比展示
3. **T+1→T+2高亮显示**：页面上会用橙色背景、闪烁状态标提醒基金经理复核
4. **导出和页面一致**：导出的Excel/CSV和页面看到的完全一样，不会遗漏异常记录
