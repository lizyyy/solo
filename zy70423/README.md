# 影子库校验命令行工具

用于校验离线云资源申请单和采购询价单的合规性，专门检测回滚操作的证据链完整性。

## 功能特性

- ✅ **回滚证据校验**：专门检测回滚操作是否有完整证据支持，无证据的记录单独保存
- ✅ **失败项单独保存**：所有失败记录完整保存原始数据，方便同事复核
- ✅ **重复提交检测**：同一批内容再次提交时，自动检测并提示前一个批次ID
- ✅ **人工备注入库**：采购询价单的人工备注完整保存，按原始行号可查
- ✅ **完整明细导出**：所有字段可追溯到原始输入，不仅是汇总报告
- ✅ **多格式支持**：支持 Excel 和 CSV 格式输入

## 快速开始

### 1. 生成演示数据
```bash
python3 main.py generate-demo
```

生成的演示数据包含：
- **正常材料**：第1、3、5行云资源申请单，全部5条采购询价单
- **回滚无证据坏材料**：第2行（回滚证据为空）、第4行（回滚证据标记为"未提供"）
- **人工备注**：所有采购询价单都包含人工备注字段

### 2. 执行校验
```bash
python3 main.py check data/demo_cloud_resource.xlsx data/demo_purchase_inquiry.xlsx --batch-id BATCH001
```

参数说明：
- `cloud_file`：云资源申请单文件路径（必填）
- `purchase_file`：采购询价单文件路径（必填）
- `--batch-id`：批次ID（可选，默认自动生成）
- `--output-dir`：输出目录（默认 ./outputs）

### 3. 查看批次列表
```bash
python3 main.py list
```

### 4. 重新导出报告
```bash
python3 main.py export BATCH001
```

## 输出文件说明

校验完成后，outputs 目录下会生成以下文件：

| 文件名 | 说明 |
|--------|------|
| `{batch_id}_校验报告.xlsx` | 完整校验报告，含校验明细和汇总统计 |
| `{batch_id}_失败记录.xlsx` | 所有失败项的完整记录，含全部原始字段 |
| `{batch_id}_云资源申请单明细.xlsx` | 云资源申请单的完整原始数据 |
| `{batch_id}_采购询价单明细.xlsx` | 采购询价单的完整原始数据（含人工备注） |

## 校验规则

### 云资源申请单
1. **申请单号校验**：申请单号不能为空
2. **金额计算校验**：总金额 = 数量 × 单价（允许微小浮点误差）
3. **回滚证据校验**：回滚证据不能为空、不能为"无"或"未提供"
4. **支付凭证校验**：支付凭证不能为空

### 采购询价单
1. **询价单号校验**：询价单号不能为空
2. **数量校验**：数量必须大于0
3. **报价校验**：报价必须大于0

## 项目结构

```
.
├── main.py                          # 主入口脚本
├── requirements.txt                 # 依赖包列表
├── shadow_checker/
│   ├── __init__.py
│   ├── cli.py                       # 命令行接口
│   ├── models/
│   │   ├── __init__.py
│   │   └── database.py              # 数据模型和数据库连接
│   └── utils/
│       ├── __init__.py
│       ├── data_generator.py        # 演示数据生成器
│       ├── data_loader.py           # 数据加载器
│       ├── validator.py             # 校验核心逻辑
│       └── exporter.py              # 报告导出器
├── data/                            # 输入数据目录
│   ├── demo_cloud_resource.xlsx
│   └── demo_purchase_inquiry.xlsx
└── outputs/                         # 输出报告目录
    ├── {batch_id}_校验报告.xlsx
    ├── {batch_id}_失败记录.xlsx
    ├── {batch_id}_云资源申请单明细.xlsx
    └── {batch_id}_采购询价单明细.xlsx
```

## 使用示例

### 首次校验
```bash
python3 main.py check data/demo_cloud_resource.xlsx data/demo_purchase_inquiry.xlsx --batch-id FIRST001
```

输出示例：
```
开始影子库校验，批次ID: FIRST001
已加载离线云资源申请单: 5 条
已加载采购询价单: 5 条
开始校验云资源申请单...
云资源申请单校验完成: 通过 3, 失败 2
开始校验采购询价单...
采购询价单校验完成: 通过 5, 失败 0
校验报告已导出: ./outputs/FIRST001_校验报告.xlsx
失败记录已导出: ./outputs/FIRST001_失败记录.xlsx
校验完成！
总计: 通过 8, 失败 2
```

### 重复提交检测
```bash
python3 main.py check data/demo_cloud_resource.xlsx data/demo_purchase_inquiry.xlsx --batch-id SECOND001
```

输出示例：
```
警告: 检测到重复提交！前一批次ID: FIRST001
重复说明: 检测到与批次 FIRST001 完全相同的内容，提交时间: 2024-05-15 18:50:37
是否继续? (y/n):
```

## 技术栈

- **Python 3.9+**
- **Click**：命令行接口框架
- **Pandas**：数据处理
- **SQLAlchemy**：ORM数据库操作
- **OpenPyXL**：Excel文件读写
- **SQLite**：内置数据库（无需额外配置）
