# 召回排序漏斗对账系统

保证明细、页面展示、接口返回读取**同一份结果**，尤其是少数类样本被总指标盖住这种记录，不能一个地方显示异常、另一个地方消失。

## 核心设计原则

1. **单一数据源原则**：页面展示、API返回、Excel导出 全部读取同一份数据库数据
2. **证据链完整原则**：原始行号、人工改动、处理状态、操作人、时间戳 全部保留
3. **边界规则固化原则**：所有判断逻辑写在代码中，禁止口头约定
4. **少数类保护原则**：被总指标盖住的少数类样本，**禁止自动归为正常**，必须留给算法工程师复核

## 项目结构

```
├── backend/                 # FastAPI 后端
│   ├── main.py             # API 接口层
│   ├── models.py           # 数据模型（数据库表）
│   ├── schemas.py          # Pydantic 数据结构
│   ├── services.py         # 核心业务逻辑
│   ├── boundary_rules.py   # 边界规则定义（核心！）
│   ├── database.py         # 数据库连接
│   └── requirements.txt    # Python 依赖
└── frontend/               # React 前端
    ├── src/
    │   ├── components/
    │   │   ├── SliceList.tsx       # 切片列表
    │   │   ├── RecordList.tsx      # 对账记录列表
    │   │   ├── RecordDetail.tsx    # 记录详情（三步操作+审计）
    │   │   └── BoundaryRules.tsx   # 边界规则说明页
    │   ├── api.ts          # API 封装
    │   ├── App.tsx
    │   └── main.tsx
    └── package.json
```

## 快速开始

### 1. 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端 API 文档: http://localhost:8000/docs

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端访问: http://localhost:3000

## 三步标准流程

### 第一步：评测切片导入

- 导入评测切片明细
- 系统**自动识别少数类样本**
- 系统**自动检测被总指标盖住的样本**
- 被盖住的样本自动标记为「待算法工程师复核」
- **原始行号永久保留**，可追溯到原始数据

### 第二步：实验平台负责人阿越补看特征快照编号

- 补充特征快照编号
- 记录操作人和时间
- **关键规则**：被总指标盖住的少数类样本**不会**自动推进状态，继续保持待复核

### 第三步：阈值回放更新

- 更新回放阈值和回放结果
- 记录操作人和时间
- **关键规则**：被总指标盖住的少数类样本**仍然保持待复核**，不自动归为正常

### （可选但必要）算法工程师人工复核

- 只有「待复核」状态的记录可以被复核
- **被总指标盖住的少数类样本，必须经过此步骤才能确认正常/异常**
- 复核意见永久保留

---

## 边界规则（重中之重）

所有规则定义在 [boundary_rules.py](backend/boundary_rules.py)，修改规则必须同步更新此文档。

### 1. 少数类样本判定

满足以下任一条件即为少数类：

| 条件 | 阈值 | 说明 |
|------|------|------|
| 显式标记 | - | 样本类型字段包含"少数"字样 |
| 召回率过低 | < 30% | 召回率显著低于平均水平 |
| 类别占比 | < 5% | 切片内该类别样本数占比 |

### 2. 总指标盖住判定

**前提**：必须是少数类样本

满足以下条件即判定为「被总指标盖住」：

| 条件 | 阈值 | 说明 |
|------|------|------|
| 总指标 | >= 95% | 总指标看起来非常正常 |
| （可选） | >= 切片平均值 | 总指标高于整体水平，更容易被忽略 |

### 3. 核心禁止规则

> ⚠️ **被总指标盖住的少数类样本，禁止自动归为正常**
>
> 必须标记为「待算法工程师复核」，由人工确认后才能改变状态。
>
> 这条规则写在代码里，不要靠口头约定。

### 4. 状态流转规则

```
step1_imported (已导入)
    ↓
step2_feature_added (已补特征快照)
    ↓
step3_threshold_updated (已阈值回放)
    ↓
pending_review (待算法复核)  ←── 被总指标盖住的样本会直接到这里
    ↓                     ↓
confirmed_normal    confirmed_abnormal
   (确认正常)         (确认异常)

[任意状态] → rollback（回滚）→ step1_imported
```

状态流转合法性由代码校验，不允许跳步。

---

## 数据一致性保证

1. **单一数据源**：所有展示、查询、导出都从 `reconciliation_records` 表读取
2. **审计日志**：所有状态变更、字段修改都写入 `audit_logs` 表，包含：
   - 操作类型
   - 变更前值
   - 变更后值
   - 操作人
   - 操作时间
   - 备注
3. **可回滚**：任何操作都可以回滚，回滚本身也记录审计日志
4. **原始行号**：`original_row_number` 字段永久保留，不随状态变化而修改

## 常见问题处理

### Q: 发现错口径了怎么办？
A: 使用「回滚」功能回到步骤1，重新导入。回滚操作会记录在审计日志里。

### Q: 少数类样本被总指标盖住，但确实是正常的？
A: 在「人工复核」步骤中，由算法工程师确认为「正常」。这个操作会永久留痕。

### Q: 需要补录特征快照编号？
A: 直接在详情页的「第二步」操作中填写，系统会记录操作人和时间。

### Q: 导出的Excel和页面显示不一样？
A: 不可能。两者读取同一份数据。如果发现不一致，一定是缓存问题，刷新页面试试。

## API 接口一览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/slices` | GET | 获取切片列表 |
| `/api/slices` | POST | 创建切片（导入数据） |
| `/api/slices/{id}/records` | GET | 获取切片对账记录 |
| `/api/slices/{id}/export` | GET | 导出Excel明细 |
| `/api/records/{id}` | GET | 获取单条记录详情（含审计） |
| `/api/records/{id}/feature-snapshot` | PUT | 第二步：补特征快照编号 |
| `/api/records/{id}/threshold-replay` | PUT | 第三步：阈值回放更新 |
| `/api/records/{id}/review` | PUT | 人工复核 |
| `/api/records/{id}/rollback` | PUT | 回滚 |
| `/api/boundary-rules` | GET | 获取边界规则说明 |

## 版本信息

- 规则版本: v1.1
- 最后更新: 2026-06-15
- 维护人: 阿越 & 算法团队

---

## 导出明细字段说明（与页面完全对齐）

导出文件包含两个 Sheet：**对账明细**（逐条记录）+ **汇总说明**（切片统计）。

### Sheet1：对账明细字段

| 列名 | 说明 | 对齐原则 |
|------|------|----------|
| 原始行号 | 评测切片首次导入时的行号，永久保留不修改 | 与导入文件行号一致 |
| 样本ID | - | 与页面一致 |
| 样本类型标签 | 导入时的原始标签 | 与页面一致 |
| 是否少数类 | 是/否 | 与页面标签一致 |
| **少数类判定依据** | 为什么判定为少数类的代码内判定逻辑 | 页面有标签，导出补充原因 |
| 召回率 | 百分比格式（如 23.0%） | 与页面显示完全一致 |
| 准确率 | 同上 | 同上 |
| **总指标** | 百分比格式（如 96.0%） | 与页面完全一致；被盖住样本数字标黄 |
| **是否被总指标盖住** | 是 ⚠️ / 否 | 与页面警告标记一致 |
| **总指标盖住判定依据** | 为什么判定为被盖住的完整依据 | 页面有 Alert，导出补充文字说明 |
| 处理状态码 | 英文原始状态（pending_review 等） | 用于程序比对 |
| **处理状态描述** | 中文可读描述（待算法工程师复核等） | 与页面 Tag 文字完全一致 |
| 特征快照编号 | - | 与页面一致 |
| 特征快照补看人 | - | 与页面一致 |
| **特征快照补看时间** | YYYY-MM-DD HH:mm | 页面详情中展示 |
| 阈值回放阈值 | - | 与页面一致 |
| 阈值回放结果 | - | 与页面一致 |
| 阈值回放更新人 | - | 与页面一致 |
| **阈值回放更新时间** | YYYY-MM-DD HH:mm | 页面详情中展示 |
| 复核人 | - | 与页面一致 |
| 复核时间 | - | 与页面一致 |
| **结果说明** | 自动生成的一句话结论（如：⚠️ 少数类样本被总指标盖住，待算法工程师复核） | 页面 Alert 内容的文字版 |
| **人工备注及判定依据** | 所有判定依据 + 人工改动备注（追加式，不覆盖） | 与页面详情完全一致 |
| 创建时间 | - | - |
| 最后更新时间 | - | - |

### Sheet2：汇总说明

| 项目 | 数值 |
|------|------|
| 切片名称 | - |
| 导出时间 | 实时时间 |
| 切片总记录数 | - |
| 少数类样本数 | - |
| 被总指标盖住数 | - |
| 待复核数 | pending_review 状态数量 |
| 已确认正常数 | - |
| 已确认异常数 | - |
| 切片平均总指标 | 用于判断「高于切片平均」 |

---

---

## 测试验证记录（2026-06-21，真实 HTTP 链路端到端验证）

> **修正说明**：2026-06-15 版本的 README 中写了「前端编译错误已修复」和「前后端服务都成功启动」，但当时并未实际执行 `tsc --noEmit` 严格检查和真实 HTTP 链路验证，属于不实结论。以下为本次真实可复现的完整验证记录。

### 0. 服务运行端口

| 服务 | 端口 | URL | 在线状态 |
|------|------|-----|----------|
| 后端 FastAPI | 8001 | http://localhost:8001/docs | ✅ 在线 |
| 前端 Vite Dev | 3001 | http://localhost:3001/ | ✅ 在线 |

### 1. 前端严格编译验证

#### `tsc --noEmit` （严格模式，`noUnusedLocals` + `noUnusedParameters` 均开启）

```bash
cd frontend && npx tsc --noEmit
# 退出码: 0
# 输出: （无任何错误，0 error）
```

#### `vite build` 生产构建

```bash
cd frontend && npx vite build
# 输出: ✓ built in 2.79s
```

### 2. 真实 HTTP 链路端到端验证（同一条样例 MASK-9527 贯穿全流程）

使用真实 HTTP 请求（非服务层 mock），后端端口 8001。

#### 测试样例

```
sample_id: MASK-9527
original_row_number: 2
sample_type: 少数类
recall_rate: 21%
precision_rate: 35%
total_metric: 96%
预期：少数类 + 被总指标盖住 → 保持待复核
```

---

#### 步骤1：POST /api/slices 评测切片第一次导入

```bash
curl -X POST http://localhost:8001/api/slices -H "Content-Type: application/json" \
  -d '{"slice_name":"端到端验证切片-MASK-9527","imported_by":"验证脚本","records":[{"original_row_number":2,"sample_id":"MASK-9527","sample_type":"少数类","recall_rate":0.21,"precision_rate":0.35,"total_metric":0.96},{"original_row_number":1,"sample_id":"NORMAL-0001","sample_type":"多数类","recall_rate":0.85,"precision_rate":0.92,"total_metric":0.88},{"original_row_number":3,"sample_id":"NORMAL-0003","sample_type":"多数类","recall_rate":0.78,"precision_rate":0.89,"total_metric":0.83}]}'
```

**返回结果：**
```json
{"slice_id":1,"total_records":3,"minority_count":1,"masked_by_total_count":1}
```

---

#### 步骤2：GET /api/slices/1/records 查看明细

MASK-9527 的初始状态核对：

| 字段 | 实际值 | 验证 |
|------|--------|------|
| `is_minority` | `true` | ✅ 识别为少数类 |
| `is_masked_by_total` | `true` | ✅ 判定为被总指标盖住 |
| `status` | `pending_review` | ✅ 直接进入待复核（不进 step1）|
| `original_row_number` | `2` | ✅ 原始行号保留 |

---

#### 步骤3：PUT /api/records/1/feature-snapshot 阿越补看特征快照编号

```bash
curl -X PUT http://localhost:8001/api/records/1/feature-snapshot -H "Content-Type: application/json" \
  -d '{"feature_snapshot_id":"FEAT-MASK9527-001","operator":"阿越","note":"补看特征快照，少数类样本特征异常"}'
```

**验证：**
- ✅ `feature_snapshot_id` 正确写入
- ✅ `status` 仍为 **`pending_review`**（边界规则生效：不自动推进）

---

#### 步骤4：PUT /api/records/1/threshold-replay 阈值回放更新

```bash
curl -X PUT http://localhost:8001/api/records/1/threshold-replay -H "Content-Type: application/json" \
  -d '{"threshold_value":0.85,"threshold_replay_result":"异常-低于阈值","operator":"阿越","note":"阈值回放确认该样本确实异常"}'
```

**验证：**
- ✅ 阈值和回放结果正确写入
- ✅ `status` 仍为 **`pending_review`**（边界规则生效：不归为正常）

---

#### 步骤5：PUT /api/records/1/review 算法工程师人工复核

```bash
curl -X PUT http://localhost:8001/api/records/1/review -H "Content-Type: application/json" \
  -d '{"status":"confirmed_abnormal","reviewed_by":"张工-算法工程师","manual_note":"经复核确认异常，该长尾商品召回偏低，需补充训练样本"}'
```

**验证：**
- ✅ 状态流转为 `confirmed_abnormal`
- ✅ `reviewed_by` 正确记录
- ✅ 只有此步骤才能最终确认异常/正常

---

#### 步骤6：GET /api/records/1/audit-logs 历史留痕（审计日志）

完整 4 条日志，覆盖全流程：

| 序号 | 动作 (action) | 操作人 | 验证 |
|------|---------------|--------|------|
| 1 | `import` | 验证脚本 | ✅ 触发动作+处理判断记录 |
| 2 | `add_feature_snapshot` | 阿越 | ✅ 步骤2留痕 |
| 3 | `update_threshold` | 阿越 | ✅ 步骤3留痕 |
| 4 | `confirm_abnormal` | 张工-算法工程师 | ✅ 复核结果留痕 |

---

#### 步骤7：GET /api/slices/1/export 导出明细核对

```bash
curl http://localhost:8001/api/slices/1/export -o /tmp/verify_export.xlsx
# 文件大小: ~7KB
```

**pandas 读取 MASK-9527 行字段核对（与接口/页面同一条样例）：**

| 导出列 | 实际值 | 验证 |
|--------|--------|------|
| 原始行号 | `2` | ✅ 与接口一致 |
| 是否少数类 | `"是"` | ✅ 与页面 Tag 一致 |
| 是否被总指标盖住 | `"是 ⚠️"` | ✅ 与页面警告一致 |
| 特征快照编号 | `"FEAT-MASK9527-001"` | ✅ 与详情一致 |
| 复核人 | `"张工-算法工程师"` | ✅ 与详情一致 |
| 处理状态描述 | `"已确认异常"` | ✅ 与页面 Tag 文字一致 |

---

### 3. 修复文件清单（编译阻断 + 验证缺口）

| 文件 | 修复内容 | 错误类型 |
|------|----------|----------|
| `frontend/vite.config.ts` | 端口改为 3001，代理目标改为 8001 | 端口冲突 |
| `frontend/src/components/RecordDetail.tsx` | Card `type={''}` 改为 `type={undefined}`（2处）| TS 类型错误：空字符串不能分配给 Card type |
| `frontend/src/components/RecordDetail.tsx` | 未使用变量 `loading` → `[, setLoading]`；移除未使用 `Divider`/`CloseCircleOutlined` import | TS6133: 未使用声明 |
| `frontend/src/components/RecordList.tsx` | `render: (val?: number, record)` → `render: (val: number \| undefined, record)`（3处）| TS1016: 必选参数不能跟在可选参数后 |
| `frontend/src/components/RecordList.tsx` | 移除未使用 `recordApi` import；render 参数 `type` → `_type` | TS6133: 未使用声明 |
| `frontend/src/components/BoundaryRules.tsx` | 移除未使用 `Title`；`_rules` → `[, setRules]` | TS6133: 未使用声明 |
| `backend/main.py` | HTTP 响应头中文文件名 URL 编码（`filename*=UTF-8''`） | UnicodeEncodeError: 导出中文文件名 500 错误 |

### 4. 完整复现方式

**后端启动：**
```bash
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8001
```

**前端启动（另一个终端）：**
```bash
cd frontend && npx vite --host 0.0.0.0 --port 3001
```

**编译检查（严格模式）：**
```bash
cd frontend && npx tsc --noEmit
cd frontend && npx vite build
```

**浏览器手动验证：**
打开 http://localhost:3001/
1. 新建评测切片，包含至少1条少数类+高总指标（>=95%）的样本
2. 查看明细，确认少数类标记、被总指标盖住标记正确
3. 点击「详情」，确认详情弹窗可正常打开，卡片类型正确，三步操作+算法复核入口均可用
4. 依次执行：补特征快照 → 阈值回放（被盖住样本仍保持待复核状态）
5. 执行算法人工复核，确认状态从 pending_review 变为 confirmed_normal/abnormal
6. 返回列表，刷新查看状态变化
7. 点击「导出Excel」，打开核对导出字段与页面显示完全一致

## 版本信息

- 规则版本: v1.2
- 最后更新: 2026-06-21
- 维护人: 阿越 & 算法团队

