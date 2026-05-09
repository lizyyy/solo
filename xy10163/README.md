# CSV 字段血缘追踪 CLI

追踪运营表字段名变化，管理别名，识别破坏性变更，确保数据分析指标的一致性和可追溯性。

## 背景场景

运营团队每周更新数据表，但经常修改字段名：
- 第一周：`order_amount`
- 第二周：`total_amount`
- 第三周：`payment_amount`
- 第四周：`amount`（还删除了一些字段）

结果：下游脚本引用旧字段名，导致指标计算错误，但很难发现原因。

本工具解决：
1. 字段别名映射 - 自动识别重命名的字段
2. 血缘图 - 可视化字段演变历史
3. 破坏性变更识别 - 检测字段删除和类型变化
4. 兼容报告 - 详细说明变更原因和影响
5. 历史版本 - 完整保留每次导入的版本

## 安装

```bash
pip install -e .
# 或者直接使用
python -m pip install click pandas pyvis jinja2 rich
python -m csv_lineage.cli --help
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `import-csv` | 导入 CSV 文件并创建版本 |
| `report` | 生成字段血缘和变更报告 |
| `graph` | 生成字段血缘可视化图 |
| `list-tables` | 列出所有已追踪的表 |
| `list-versions` | 列出表的所有版本 |
| `field-history` | 查看字段的历史变更 |
| `add-alias` | 手动添加字段别名 |
| `list-aliases` | 列出所有字段别名 |
| `check-breaking` | 检查破坏性变更 |

## 完整验收流程

### 准备工作

```bash
# 进入项目目录
cd /Users/mac/pro/solo/workspaces/xy10163

# 安装依赖
pip install -r requirements.txt
pip install -e .

# 验证安装
csv-lineage --help
```

### 验收场景 1：导入第一周数据

```bash
# 导入第一周运营表
csv-lineage import-csv sales_data examples/sales_week1.csv --comment "第一周运营数据"

# 查看已导入的表
csv-lineage list-tables

# 查看版本历史
csv-lineage list-versions sales_data
```

**预期结果：**
- 创建版本 v1
- 检测到 8 个字段：date, user_id, user_name, order_id, order_amount, product_name, quantity, channel

### 验收场景 2：导入第二周数据（字段全部重命名）

```bash
# 导入第二周（字段名全部改变）
csv-lineage import-csv sales_data examples/sales_week2.csv --comment "第二周运营数据"

# 查看别名（应该自动识别重命名）
csv-lineage list-aliases sales_data

# 检查变更
csv-lineage report sales_data --from-version 1 --to-version 2
```

**预期结果：**
- 创建版本 v2
- 自动识别字段重命名（如 `date` → `order_date`，`user_id` → `customer_id` 等）
- 显示详细的字段映射关系

### 验收场景 3：导入第三周数据（再次重命名 + 新增字段）

```bash
# 导入第三周（再次改名 + 新增 discount 字段）
csv-lineage import-csv sales_data examples/sales_week3.csv --comment "第三周运营数据-新增折扣字段"

# 查看具体字段的历史
csv-lineage field-history sales_data order_amount

# 生成 HTML 报告
csv-lineage report sales_data --from-version 1 --to-version 3 --format html --output reports/week1_to_3.html
```

**预期结果：**
- 创建版本 v3
- 追踪 `order_amount` → `total_amount` → `payment_amount` 的完整演变
- 检测到新增的 `discount` 字段
- 生成美观的 HTML 报告

### 验收场景 4：导入第四周数据（破坏性变更）

```bash
# 导入第四周（删除了 discount 字段，再次改名）
csv-lineage import-csv sales_data examples/sales_week4_missing_fields.csv --comment "第四周运营数据-缺少部分字段"

# 检查破坏性变更
csv-lineage check-breaking sales_data --from-version 3 --to-version 4 --fail-on-breaking

# 生成完整报告
csv-lineage report sales_data --from-version 1 --to-version 4 --format json --output reports/full_report.json
```

**预期结果：**
- 创建版本 v4
- 检测到 `discount` 字段被删除（破坏性变更）
- `check-breaking` 命令返回非零退出码
- JSON 报告包含所有变更详情

### 验收场景 5：生成血缘图

```bash
# 生成可视化血缘图
csv-lineage graph sales_data reports/lineage_graph.html
```

**预期结果：**
- 生成交互式 HTML 图
- 显示标准字段（绿色）和历史别名（蓝色）
- 箭头指示字段演变方向

### 验收场景 6：测试可重复性（重复导入同一文件）

```bash
# 尝试重复导入第一周的文件
csv-lineage import-csv sales_data examples/sales_week1.csv --comment "重复导入测试"

# 查看版本历史（应该没有新增版本）
csv-lineage list-versions sales_data
```

**预期结果：**
- 不会创建新版本（通过文件哈希检测重复）
- 版本历史保持不变

### 验收场景 7：手动添加别名

```bash
# 手动添加别名（应对无法自动识别的情况）
csv-lineage add-alias sales_data order_amount sales_total

# 验证别名已添加
csv-lineage list-aliases sales_data
```

**预期结果：**
- `order_amount` 的别名列表新增 `sales_total`

## 快速验收脚本

```bash
#!/bin/bash
set -e

echo "=== CSV 字段血缘追踪 CLI 验收测试 ==="

# 清理旧数据
rm -rf .lineage reports
mkdir -p reports

echo ""
echo "[1/7] 安装依赖..."
pip install -q -r requirements.txt
pip install -q -e .

echo ""
echo "[2/7] 导入第一周数据..."
csv-lineage import-csv sales_data examples/sales_week1.csv --comment "第一周运营数据"

echo ""
echo "[3/7] 导入第二周数据（字段重命名）..."
csv-lineage import-csv sales_data examples/sales_week2.csv --comment "第二周运营数据"

echo ""
echo "[4/7] 导入第三周数据（新增字段）..."
csv-lineage import-csv sales_data examples/sales_week3.csv --comment "第三周运营数据-新增折扣字段"

echo ""
echo "[5/7] 导入第四周数据（破坏性变更）..."
csv-lineage import-csv sales_data examples/sales_week4_missing_fields.csv --comment "第四周运营数据"

echo ""
echo "[6/7] 检查破坏性变更..."
csv-lineage check-breaking sales_data --from-version 3 --to-version 4 || echo "✓ 正确检测到破坏性变更（预期失败）"

echo ""
echo "[7/7] 生成报告和图表..."
csv-lineage report sales_data --from-version 1 --to-version 4 --format html --output reports/full_report.html
csv-lineage graph sales_data reports/lineage_graph.html

echo ""
echo "=== 验收完成 ==="
echo "查看报告:"
echo "  - 完整报告: reports/full_report.html"
echo "  - 血缘图: reports/lineage_graph.html"
echo ""
echo "其他有用的命令:"
echo "  csv-lineage list-versions sales_data"
echo "  csv-lineage list-aliases sales_data"
echo "  csv-lineage field-history sales_data order_amount"
```

## 存储结构

```
.lineage/
├── meta.json              # 元数据（版本计数、表列表）
├── versions/              # 版本快照
│   ├── sales_data_v1.json
│   ├── sales_data_v2.json
│   ├── sales_data_v3.json
│   └── sales_data_v4.json
├── aliases/               # 字段别名映射
│   └── sales_data.json
├── lineage/               # 血缘关系数据
│   └── sales_data.json
└── reports/               # 生成的报告
```

## 版本快照内容

每个版本保存：
- 文件路径和 MD5 哈希（防止重复导入）
- 完整 schema（字段名、类型、统计信息）
- 导入时间戳
- 用户备注

## 字段追踪能力

| 能力 | 说明 |
|------|------|
| 自动识别重命名 | 通过字符串相似度和单词匹配 |
| 手动添加别名 | 处理无法自动识别的情况 |
| 历史追踪 | 每个字段的完整变更时间线 |
| 来源反查 | 报告中包含变更版本和时间戳 |

## 破坏性变更类型

1. **字段删除** - 高风险，直接导致下游脚本错误
2. **类型变化** - 中风险，可能导致计算错误
3. **唯一值比例骤降** - 数据质量警告
4. **空值比例大幅变化** - 数据质量警告

## 报告格式

- **text** - 控制台友好的纯文本格式
- **json** - 机器可读，便于集成
- **html** - 美观的交互式报告，包含样式和表格

## 示例数据说明

| 文件 | 说明 | 变更类型 |
|------|------|----------|
| `sales_week1.csv` | 第一周原始数据 | 基准 |
| `sales_week2.csv` | 字段全部重命名 | 字段重命名 |
| `sales_week3.csv` | 再次重命名 + 新增 discount 字段 | 字段重命名 + 新增字段 |
| `sales_week4_missing_fields.csv` | 再次重命名 + 删除 discount 字段 | 字段重命名 + 字段删除（破坏性） |

## 常见问题

**Q: 如何处理无法自动识别的重命名？**
A: 使用 `add-alias` 命令手动添加别名映射。

**Q: 如何确保导入是幂等的？**
A: 系统使用文件 MD5 哈希，相同文件不会重复导入。

**Q: 数据存在哪里？**
A: 默认在当前目录的 `.lineage/` 下，可通过 `--storage` 参数指定其他位置。

**Q: 可以导入非 CSV 文件吗？**
A: 当前版本只支持 CSV，后续可扩展支持 Excel、Parquet 等格式。
