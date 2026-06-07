# 音频母带交付核对系统 (AMDC)

> 统一排练群接龙与合同页截图证据，导出、页面、接口读同一份结果

## 核心设计原则

1. **单一数据源**：导出明细、页面展示、API 返回读同一份状态文件
2. **证据留存**：排练群接龙的原始行号、人工改动、处理状态全程保留
3. **可复盘**：所有操作写日志，支持回滚
4. **边界明确**：特殊情况（如临时替补）不靠口头约定，代码和文档双重约定

## 快速开始

### 安装依赖

```bash
npm install
npm run build
```

### 标准三步流程

```bash
# 1. 导入排练群接龙（第一步）
npm run cli -- import-group examples/group-signup.txt -o 票务同事A

# 2. 琴行店长老周补看合同页截图后导入（第二步）
npm run cli -- import-contract examples/contract-part1.txt -o 老周

# 3. 执行核对
npm run cli -- reconcile -o 系统

# 查看状态
npm run cli -- status
npm run cli -- list

# 4. 分账明细更新前，票务同事复核
# 列出待复核的记录
npm run cli -- list -s needs_review

# 确认某条记录
npm run cli -- confirm <结果ID> -o 票务同事A -n "核对无误"

# 5. 导出明细
npm run cli -- export output/核对明细.xlsx

# 6. 导出操作日志（复盘用）
npm run cli -- export-log output/操作日志.xlsx
```

### 晚到材料流程

合同页截图晚上才补进来时，只刷新相关明细，不洗掉已确认内容：

```bash
# 晚到材料导入
npm run cli -- import-contract examples/contract-part2-late.txt -o 老周 --late

# 增量核对（只针对晚到批次，不碰已确认的）
npm run cli -- reconcile --late <批次ID> -o 系统
```

### 启动 Web 界面

```bash
npm start
# 打开 http://localhost:3000
```

## 边界规则（重要！）

### 1. 临时替补只在群里说了一句

**判定规则**：
- 接龙内容中包含「替补、代班、临时、替上」等关键词 → 自动标记 `isTemporarySubstitute = true`
- 核对时自动标记为 `NEEDS_REVIEW`（待复核），原因：`TEMP_SUBSTITUTE_ONLY_IN_GROUP`
- **不会自动归为正常**，必须由票务同事手动确认或驳回

**怎么改**：
- CLI: `amdc confirm <结果ID> -o 票务 -n "已核实，替补有效"`
- CLI: `amdc reject <结果ID> -o 票务 -n "替补无效，不计入"`
- Web: 页面上点「确认」或「驳回」

**怎么回滚**：
- CLI: `amdc rollback <结果ID> -o 票务 -r "误操作，重新复核"`
- Web: 已确认/已驳回的记录点「回滚」

---

### 2. 晚到合同材料刷新

**判定规则**：
- 导入时加 `--late` 参数标记为晚到材料
- 核对时加 `--late <批次ID>` 只针对该批次增量核对
- 已标记为 `CONFIRMED` 的记录**不会被覆盖或洗掉**

**怎么改**：
- 晚到材料只能追加，不能修改已确认内容
- 如需修改已确认记录，先回滚再重新核对

---

### 3. 接龙原始行号留存

**判定规则**：
- 导入时保留 `originalRowNumber`，对应原文件的物理行号（从 1 开始）
- 任何人工改动不覆盖原始行号和原始内容
- 导出 Excel 时「接龙原始行号」「接龙原始内容」列始终保留

---

### 4. 人工改动审计

**判定规则**：
- 所有字段修改自动记录 `manualEdits`：字段名、旧值、新值、操作人、时间、原因
- 修改记录不可删除，永久留存
- 导出时展示全部改动历史

---

### 5. 状态流转

```
IMPORTED (已导入)
    ↓
  reconcile()
    ↓
MATCHED (已匹配) ── 无复核原因 ── 可直接确认
    ↓
NEEDS_REVIEW (待复核) ── 有复核原因 ── 票务手动处理
    ↓         ↓
CONFIRMED   REJECTED
    ↓         ↓
 rollback()  rollback()
    ↓         ↓
NEEDS_REVIEW / MATCHED
```

**状态说明**：
- `IMPORTED`：刚导入，未参与核对
- `MATCHED`：两边信息匹配一致，无异常
- `NEEDS_REVIEW`：需要人工复核（如临时替补、缺合同、缺接龙）
- `CONFIRMED`：票务已确认，计入分账
- `REJECTED`：票务已驳回，不计入分账
- `SUPERSEDED`：被新记录替换（预留）

## 数据文件

默认数据文件位置：`data/reconciliation-state.json`

**文件结构**（单文件，所有出口读这一份）：
```json
{
  "groupRecords": [...],      // 排练群接龙记录
  "contractRecords": [...],   // 合同页截图记录
  "results": [...],           // 核对结果（页面/导出/API 都用这个）
  "logs": [...],              // 操作日志（复盘用）
  "batches": [...],           // 导入批次
  "lastUpdated": "..."
}
```

## CLI 命令参考

| 命令 | 说明 |
|------|------|
| `amdc import-group <文件>` | 导入排练群接龙 |
| `amdc import-contract <文件> [--late]` | 导入合同截图提取文件，--late 标记晚到 |
| `amdc reconcile [--late <批次ID>] [--force]` | 执行核对，--force 不保留已确认 |
| `amdc confirm <结果ID> [-n 备注]` | 确认一条记录 |
| `amdc reject <结果ID> [-n 原因]` | 驳回一条记录 |
| `amdc rollback <结果ID> [-r 原因]` | 回滚状态 |
| `amdc export <输出.xlsx>` | 导出核对明细 |
| `amdc export-log <输出.xlsx>` | 导出操作日志 |
| `amdc status` | 查看统计 |
| `amdc list [-s 状态]` | 列出记录 |
| `amdc reset --force` | 清空所有数据 |

所有命令支持 `-o <操作人>` 和 `-d <数据文件路径>`。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 统计概览 |
| GET | `/api/results?status=` | 核对结果列表 |
| GET | `/api/results/:id` | 单条详情+操作日志 |
| POST | `/api/results/:id/confirm` | 确认 |
| POST | `/api/results/:id/reject` | 驳回 |
| POST | `/api/results/:id/rollback` | 回滚 |
| POST | `/api/reconcile` | 执行核对 |
| GET | `/api/logs` | 操作日志 |
| GET | `/api/batches` | 导入批次 |

## 复盘与重跑

### 复盘

```bash
# 导出全部操作日志，按时间排序
npm run cli -- export-log output/复盘日志.xlsx
```

日志包含：操作类型、实体类型、实体ID、操作人、时间、批次、备注、旧状态、新状态。

### 重跑

```bash
# 1. 清空数据（或换一个数据文件 -d）
npm run cli -- reset --force -o 管理员

# 2. 按历史顺序重新导入
npm run cli -- import-group examples/group-signup.txt -o 票务
npm run cli -- import-contract examples/contract-part1.txt -o 老周

# 3. 重新核对
npm run cli -- reconcile -o 系统

# 4. 如有晚到材料
npm run cli -- import-contract examples/contract-part2-late.txt -o 老周 --late
npm run cli -- reconcile --late <批次ID> -o 系统
```

## 目录结构

```
src/
├── types/            # 数据模型定义
├── store/            # 统一数据存储层（单一数据源）
├── importers/        # 导入模块
│   ├── group-signup.ts    # 排练群接龙
│   └── contract-screenshot.ts  # 合同页截图
├── core/             # 核心核对逻辑
│   └── reconciliation.ts   # 状态机、匹配、边界规则
├── exporters/        # 导出模块
├── cli/              # 命令行入口
└── server/           # Web 服务 + API
    └── public/       # 前端页面
```
