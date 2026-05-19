# 实验室试剂管理 CLI 工具

一个面向高校实验室管理员的试剂领用审批和库存管理命令行工具。

## 功能特性

- ✅ **库存管理**: 实时追踪试剂库存，防止负库存
- ✅ **危险品双人审批**: 高危/剧毒试剂需要两人审批才能通过
- ✅ **批量导入/导出**: 支持CSV格式批量导入申请，导出审批记录
- ✅ **审批流程**: 支持驳回、重新提交、审批历史追踪
- ✅ **操作历史**: 所有操作都有历史记录可查
- ✅ **失败重试**: 批量操作失败后可单独重试失败项，不影响已成功记录

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据存储

```bash
node src/index.js init
```

这会创建 `.reagent-data` 目录，并初始化以下默认试剂：

| ID   | 名称     | 危险等级 | 单位 | 初始库存 |
|------|----------|----------|------|----------|
| R001 | 无水乙醇 | 低危     | 瓶   | 50       |
| R002 | 浓硫酸   | 高危     | 瓶   | 20       |
| R003 | 氢氧化钠 | 中危     | 瓶   | 30       |
| R004 | 蒸馏水   | 无危险   | 桶   | 100      |
| R005 | 丙酮     | 中危     | 瓶   | 25       |

> **注意**: 危险等级 3 (高危) 和 4 (剧毒) 需要双人审批。

### 3. 导入试剂领用申请

使用 `sample-normal.csv` 导入正常申请：

```bash
node src/index.js import sample-normal.csv
```

使用 `sample-mixed.csv` 导入包含异常情况的申请（部分会失败）：

```bash
node src/index.js import sample-mixed.csv
```

导入时会显示：
- ✅ 成功导入的申请（高危试剂会有警告提示）
- ❌ 导入失败的申请及原因（试剂不存在、库存不足、数量为0等）
- 🔄 批量操作ID，用于后续重试

### 4. 复核审批

列出所有待审批申请：

```bash
node src/index.js review --list
```

审批通过某申请（替换 `<申请ID>` 为实际ID）：

```bash
node src/index.js review --approve <申请ID> --by "张主任" --reason "同意领用"
```

> 💡 对于高危试剂，第一次审批后状态仍为 "pending"，需要第二人再次审批才能最终通过并扣减库存。
> 💡 使用 `--by` 参数指定审批人姓名，双人审批时需要两个不同的名字。

驳回某申请：

```bash
node src/index.js review --reject <申请ID> --by "李老师" --reason "用途描述不明确"
```

### 5. 导出审批记录

导出所有记录：

```bash
node src/index.js export output-all.csv
```

只导出已通过的：

```bash
node src/index.js export output-approved.csv --type approved
```

可选类型: `all`, `approved`, `rejected`, `pending`

### 6. 查看状态

查看库存和申请统计：

```bash
node src/index.js status
```

查看指定试剂详情：

```bash
node src/index.js status --reagent R002
```

### 7. 重试失败项

如果批量导入有失败项，可使用批量操作ID重试：

```bash
node src/index.js retry <批量操作ID>
```

> ✅ 只会重新处理失败的条目，已成功的不会重复导入。

### 8. 查看操作历史

```bash
node src/index.js history --limit 5
```

## 业务规则

### 1. 危险品双人审批

- **危险等级 0-2**: 单人审批即可通过
- **危险等级 3-4**: 需要两个不同的审批人都通过，才会扣减库存
- 同一审批人不能对同一申请审批两次

### 2. 库存校验

- 申请提交时校验库存，库存不足无法提交
- 审批完全通过后才扣减库存
- 库存永远不会出现负数

### 3. 驳回与重提

- 已驳回的申请可以重新提交
- 重新提交时会再次校验库存
- 重新提交后需要重新走审批流程

## 样例演示

### 正常流程 (普通试剂)

```bash
# 1. 初始化
node src/index.js init

# 2. 导入申请
node src/index.js import sample-normal.csv

# 3. 查看待审批
node src/index.js review --list

# 4. 审批通过（单人即生效，库存扣减）
node src/index.js review --approve <申请ID> --by "张主任" --reason "实验需要"

# 5. 查看库存变化
node src/index.js status

# 6. 导出记录
node src/index.js export result.csv
```

### 双人审批流程 (高危试剂)

```bash
# 1. 导入含高危试剂的申请
node src/index.js import sample-mixed.csv

# 2. 查看待审批，注意高危试剂显示"需要双人审批"
node src/index.js review --list

# 3. 第一个审批人通过
node src/index.js review --approve <高危申请ID> --by "张主任" --reason "第一审批人同意"
# 此时审批进度显示 1/2，库存未扣减

# 4. 第二个审批人通过（必须是不同的审批人）
node src/index.js review --approve <高危申请ID> --by "李主任" --reason "第二审批人同意"
# 此时审批完成，库存扣减
```

### 异常处理流程

```bash
# 1. 导入混合样例（部分失败）
node src/index.js import sample-mixed.csv
# 记录返回的 批量操作ID

# 2. 查看失败原因
# 输出会显示每条失败项的具体错误

# 3. 修正数据后重试失败项
node src/index.js retry <批量操作ID>
```

### 驳回与重提

```bash
# 1. 驳回某申请
node src/index.js review --reject <申请ID> --by "王老师" --reason "请补充安全措施说明"

# 2. 查看已驳回的申请（通过导出或直接查看JSON）

# 3. 重新提交被驳回的申请
node src/index.js resubmit <申请ID>

# 4. 查看待审批列表，申请已重新出现
node src/index.js review --list
```

## 数据存储

所有数据保存在 `.reagent-data` 目录下：

- `reagents.json` - 试剂基础信息
- `inventory.json` - 库存数量
- `applications.json` - 申请记录
- `approvals.json` - 审批记录
- `batches.json` - 批量操作记录
- `history.json` - 操作历史

可以直接查看这些JSON文件了解详细数据。

## 命令参考

| 命令 | 说明 |
|------|------|
| `init` | 初始化数据存储 |
| `import <文件>` | 从CSV导入申请 |
| `review --list` | 列出待审批申请 |
| `review --approve <ID>` | 审批通过 |
| `review --reject <ID>` | 驳回申请 |
| `export <文件>` | 导出审批记录 |
| `status` | 查看库存和统计 |
| `resubmit <申请ID>` | 重新提交被驳回的申请 |
| `retry <批量ID>` | 重试失败项 |
| `history` | 查看操作历史 |

## 故障排除

### 初始化失败
- 检查当前目录是否有写入权限
- 删除 `.reagent-data` 目录后重新初始化

### 导入失败
- 检查CSV文件编码（推荐UTF-8）
- 确认列名正确：`reagentId,quantity,applicant,department,purpose` 或中文列名
- 查看具体错误提示

### 审批失败
- 确认申请ID正确
- 检查申请状态是否已被审批/驳回
- 高危试剂确认是否是第二个审批人
