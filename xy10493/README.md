# 仓库盘点差异复核 CLI

一个功能完整的仓库盘点差异复核命令行工具，支持导入账面库存、实盘结果和库位负责人，自动计算差异，支持复核、审批和报告生成。

## 功能特性

- 📦 **数据导入**：支持从 CSV 导入账面库存、实盘结果和库位负责人
- 📊 **差异计算**：自动计算盘盈、盘亏、未盘、多盘四种差异类型
- 🔍 **差异查看**：按库位、负责人、差异类型筛选查看
- ✍️ **复核登记**：库位负责人登记复核原因
- ✅ **审批流程**：提交调整、审批通过/驳回
- 📋 **报告生成**：生成完整的盘点报告，展示调整前后对比
- 📜 **历史记录**：审批通过的调整写入单独历史
- 🛡️ **安全校验**：重复导入检测、调整数量校验、SKU 缺失提醒

## 安装

```bash
npm install
npm run build
```

或者使用开发模式：

```bash
npm install
```

## 快速开始

### 1. 初始化盘点会话

```bash
# 使用开发模式
npm run dev -- init -n "2026年5月盘点"

# 或编译后使用
npm run build
npm start -- init -n "2026年5月盘点"
```

输出会显示盘点 ID，后续操作需要使用这个 ID。

### 2. 导入数据

```bash
# 导入库位负责人（只需导入一次，可复用）
npm run dev -- import-owners -f samples/location-owners.csv

# 导入账面库存
npm run dev -- import-book -a <盘点ID> -f samples/book-inventory.csv

# 导入实盘结果
npm run dev -- import-count -a <盘点ID> -f samples/actual-count.csv
```

### 3. 计算差异

```bash
npm run dev -- calculate -a <盘点ID>
```

### 4. 查看差异

```bash
# 查看所有差异
npm run dev -- view -a <盘点ID>

# 仅查看不一致的记录
npm run dev -- view -a <盘点ID> -u

# 按库位筛选
npm run dev -- view -a <盘点ID> -l A01

# 按负责人筛选
npm run dev -- view -a <盘点ID> -o 张三

# 按差异类型筛选 (profit/loss/not_counted/over_counted/matched)
npm run dev -- view -a <盘点ID> -t loss
```

### 5. 登记复核原因

```bash
npm run dev -- review \
  -a <盘点ID> \
  -d <差异ID> \
  -r "实际盘亏，原因待查" \
  -b "张三"
```

### 6. 提交调整

```bash
# 调整数量：正数为增加，负数为减少
# 注意：调整数量不能超过差异数量
npm run dev -- submit-adjustment \
  -a <盘点ID> \
  -d <差异ID> \
  -q -5 \
  -b "张三"
```

### 7. 审批调整

```bash
# 查看待审批记录
npm run dev -- pending -a <盘点ID>

# 审批通过
npm run dev -- approve \
  -a <盘点ID> \
  -d <差异ID> \
  -b "经理"

# 审批驳回
npm run dev -- reject \
  -a <盘点ID> \
  -d <差异ID> \
  -r "请重新核实" \
  -b "经理"
```

### 8. 生成报告

```bash
npm run dev -- report -a <盘点ID>
```

### 9. 查看调整历史

```bash
# 查看所有历史
npm run dev -- history

# 按盘点 ID 筛选
npm run dev -- history -a <盘点ID>
```

## 命令详解

### init - 初始化盘点

创建一个新的盘点会话。

**选项：**
- `-n, --name <name>` - 盘点名称（必需）

**注意：** 不允许创建同名盘点，以防止重复计算差异。

### list - 列出所有盘点

查看所有盘点会话及其状态。

### import-book - 导入账面库存

**CSV 格式：**
```csv
location,sku,quantity
A01,SKU001,100
A01,SKU002,50
```

**选项：**
- `-a, --audit-id <auditId>` - 盘点 ID（必需）
- `-f, --file <file>` - CSV 文件路径（必需）

### import-count - 导入实盘结果

**CSV 格式：**
```csv
location,sku,quantity,countedAt
A01,SKU001,100,2026-05-12T09:00:00Z
```

**选项：**
- `-a, --audit-id <auditId>` - 盘点 ID（必需）
- `-f, --file <file>` - CSV 文件路径（必需）

### import-owners - 导入库位负责人

**CSV 格式：**
```csv
location,owner
A01,张三
A02,李四
```

**选项：**
- `-f, --file <file>` - CSV 文件路径（必需）

### calculate - 计算差异

自动计算以下差异类型：
- **一致 (matched)**：账面 = 实盘
- **盘盈 (profit)**：实盘 > 账面
- **盘亏 (loss)**：实盘 < 账面
- **未盘 (not_counted)**：账面有，实盘无
- **多盘 (over_counted)**：账面无，实盘有

**选项：**
- `-a, --audit-id <auditId>` - 盘点 ID（必需）

### view - 查看差异

**选项：**
- `-a, --audit-id <auditId>` - 盘点 ID（必需）
- `-l, --location <location>` - 按库位筛选
- `-o, --owner <owner>` - 按负责人筛选
- `-t, --type <type>` - 按差异类型筛选
- `-u, --unmatched` - 仅显示不一致的记录

### review - 登记复核原因

**选项：**
- `-a, --audit-id <auditId>` - 盘点 ID（必需）
- `-d, --difference-id <differenceId>` - 差异 ID（必需）
- `-r, --reason <reason>` - 复核原因（必需）
- `-b, --reviewed-by <reviewedBy>` - 复核人（必需）

### submit-adjustment - 提交调整

**选项：**
- `-a, --audit-id <auditId>` - 盘点 ID（必需）
- `-d, --difference-id <differenceId>` - 差异 ID（必需）
- `-q, --quantity <quantity>` - 调整数量（必需，正增负减）
- `-b, --submitted-by <submittedBy>` - 提交人（必需）

**校验：**
- 调整数量的绝对值不能超过差异数量的绝对值
- 提交后状态变为"待审批"

### approve - 审批通过

**选项：**
- `-a, --audit-id <auditId>` - 盘点 ID（必需）
- `-d, --difference-id <differenceId>` - 差异 ID（必需）
- `-b, --approved-by <approvedBy>` - 审批人（必需）

**效果：**
- 状态变为"已通过"
- 调整记录写入单独的历史文件

### reject - 审批驳回

**选项：**
- `-a, --audit-id <auditId>` - 盘点 ID（必需）
- `-d, --difference-id <differenceId>` - 差异 ID（必需）
- `-r, --reason <reason>` - 驳回原因（必需）
- `-b, --rejected-by <rejectedBy>` - 驳回人（必需）

**效果：**
- 状态变为"已驳回"
- 驳回原因追加到复核原因

### pending - 查看待审批

查看所有待审批的调整记录。

### history - 查看调整历史

查看所有审批通过的调整记录。

**选项：**
- `-a, --audit-id <auditId>` - 按盘点 ID 筛选

### report - 生成盘点报告

生成完整的盘点报告，包括：
- 汇总统计
- 库存调整明细（调整前后对比）
- 仍需审批的记录
- 已完成处理的记录

## 数据存储

所有数据存储在项目根目录的 `.audit-data` 文件夹中：

```
.audit-data/
├── audits/
│   └── <盘点ID>/
│       ├── session.json        # 盘点会话信息
│       ├── book-inventory.json # 账面库存
│       ├── actual-count.json   # 实盘结果
│       ├── differences.json    # 差异记录
│       └── report.json         # 盘点报告
├── history/
│   └── <历史记录ID>.json       # 调整历史（每条审批通过单独存储）
└── location-owners.json        # 库位负责人映射
```

## 安全校验

1. **重复导入检测**：已计算差异的盘点不允许重新导入数据
2. **调整数量校验**：调整数量不能超过差异数量
3. **状态校验**：只能审批"待审批"状态的记录
4. **数据完整性**：导入时检查必需列和数据格式

## 样例数据说明

`samples/` 目录包含样例数据：

- **book-inventory.csv**：账面库存（10条记录）
- **actual-count.csv**：实盘结果（9条记录）
- **location-owners.csv**：库位负责人（5个库位）

**样例覆盖的场景：**
| 场景 | 示例 |
|------|------|
| 一致 | A01-SKU001 (100=100) |
| 盘亏 | A01-SKU002 (账面50, 实盘45) |
| 盘盈 | A01-SKU003 (账面80, 实盘85) |
| 未盘 | A03-SKU006 (账面有，实盘无) |
| 多盘 | A04-SKU010 (账面无，实盘有) |

## 完整示例流程

```bash
# 1. 初始化
AUDIT_ID=$(npm run dev -- init -n "测试盘点" | grep "盘点 ID" | awk '{print $3}')
echo "盘点ID: $AUDIT_ID"

# 2. 导入负责人
npm run dev -- import-owners -f samples/location-owners.csv

# 3. 导入账面和实盘
npm run dev -- import-book -a $AUDIT_ID -f samples/book-inventory.csv
npm run dev -- import-count -a $AUDIT_ID -f samples/actual-count.csv

# 4. 计算差异
npm run dev -- calculate -a $AUDIT_ID

# 5. 查看差异
npm run dev -- view -a $AUDIT_ID -u

# 6. 对某个差异登记原因并提交调整
# （先从 view 输出中复制一个差异 ID）
DIFF_ID="复制的差异ID"
npm run dev -- review -a $AUDIT_ID -d $DIFF_ID -r "经核实，确实少了5个" -b "张三"
npm run dev -- submit-adjustment -a $AUDIT_ID -d $DIFF_ID -q -5 -b "张三"

# 7. 查看待审批
npm run dev -- pending -a $AUDIT_ID

# 8. 审批通过
npm run dev -- approve -a $AUDIT_ID -d $DIFF_ID -b "经理"

# 9. 查看历史
npm run dev -- history -a $AUDIT_ID

# 10. 生成报告
npm run dev -- report -a $AUDIT_ID
```
