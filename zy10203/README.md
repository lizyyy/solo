# 仓库退货质检分拣工具

一个帮助售后仓和客服协作处理退货的命令行工具。

**解决的问题：**
- 避免用颜色贴纸分拣，月底查不清哪单该退款
- 自动检测异常：序列号重复、未质检先退款、报废品回补、返修件缺责任
- 防止重复导入，保留人工修正记录

---

## 一、快速开始（3分钟上手）

### 1. 安装 Python
检查你的电脑是否已安装 Python 3：
```bash
python3 --version
```
如果没有安装，请去 [python.org](https://www.python.org/downloads/) 下载安装。

### 2. 安装工具
在终端（Mac 的 Terminal 或 Windows 的 PowerShell）中执行：
```bash
cd /path/to/项目目录
pip install -r requirements.txt
pip install -e .
```

### 3. 验证安装
```bash
wh-return --help
```
如果显示命令帮助，说明安装成功。

---

## 二、完整工作流程

执行下面的命令查看详细流程：
```bash
wh-return workflow
```

**流程图：**
```
准备数据文件 → 导入数据 → 查看异常 → 修正异常
     ↓
生成分拣报告 → 客服核对退款
```

---

## 三、数据文件格式

### 支持的格式
- Excel 文件（.xlsx, .xls）
- CSV 文件（.csv）

### 必需列（必须有）
| 列名 | 说明 | 示例 |
|------|------|------|
| order_no | 订单号 | RT20260501001 |
| serial_number | 商品序列号 | SN001234567890 |
| return_date | 退货日期 | 2026-05-10 |

### 可选列（建议填写）
| 列名 | 说明 | 可选值 |
|------|------|--------|
| customer_name | 客户姓名 | - |
| product_name | 商品名称 | - |
| sku | 商品编码 | - |
| quality_result | 质检结果 | 合格 / 不合格 / 需返修 / 报废 |
| missing_parts_note | 缺件说明 | - |
| refund_status | 退款状态 | 待审核 / 已批准 / 已退款 / 已拒绝 |
| warehouse_location | 仓位 | A-01, B-03 等 |
| repair_responsibility | 返修责任 | 厂方责任 / 物流责任 / 用户责任 等 |

**列名不区分大小写和格式**，例如 `Quality Result`、`quality_result`、`质检结果` 都能识别。

---

## 四、命令说明

### 1. 导入数据
```bash
wh-return import 退货清单.xlsx
```

导入时会自动：
- 检查是否重复导入（相同文件不会被导入两次）
- 检测所有异常并显示原因

### 2. 查看异常
```bash
# 查看所有异常
wh-return exceptions

# 只看未解决的异常
wh-return exceptions -u

# 导出异常清单到文件
wh-return exceptions -o 异常清单.txt
```

### 3. 修正数据
```bash
# 格式：wh-return fix 序列号 字段名 新值
wh-return fix SN001234567890 quality_result 合格
wh-return fix SN001234567890 warehouse_location A-03
wh-return fix SN001234567890 refund_status 已批准
```

**可修改的字段：**
- quality_result（质检结果）
- missing_parts_note（缺件说明）
- refund_status（退款状态）
- warehouse_location（仓位）
- repair_responsibility（返修责任）
- product_name（商品名称）
- sku（商品编码）

**可选参数：**
```bash
wh-return fix SN001 quality_result 合格 --operator 张三 --note 质检时看错了
```

所有修改都会记录在数据库中，可追溯。

### 4. 标记异常已解决
```bash
# 格式：wh-return resolve 异常ID "处理说明"
wh-return resolve 1 "确认是序列号录入错误，已修正"
```

### 5. 查看数据
```bash
# 查看所有退货单
wh-return list --orders

# 查看所有商品
wh-return list --items

# 查看某个订单的商品
wh-return list --order RT20260501001
```

### 6. 生成分拣报告
```bash
wh-return report
```

报告会自动保存为 `分拣报告_日期时间.txt`，包含：
- 总体概览
- 按质检结果分类
- 按仓位分类
- 待处理异常
- 序列号重复检查

---

## 五、异常类型说明

### 1. 序列号重复
**原因：** 同一个序列号在不同订单中出现  
**处理建议：** 
- 检查是否是录入错误
- 确认是否是同一商品被退回多次
- 修正后使用 `wh-return resolve` 标记已解决

### 2. 未质检先退款
**原因：** 退款状态是「已批准」或「已退款」，但质检结果为空  
**处理建议：**
- 先补填质检结果
- 再更新退款状态

### 3. 报废品回补库存
**原因：** 质检结果是「报废」，但填写了仓位  
**处理建议：**
- 如果确实报废，清空仓位
- 如果商品可回用，将质检结果改为「合格」或「需返修」

### 4. 返修件缺少责任说明
**原因：** 质检结果是「需返修」，但没有填写返修责任  
**处理建议：**
- 补充责任归属：厂方责任 / 物流责任 / 用户责任

---

## 六、示例

### 准备测试数据
复制下面的内容保存为 `test_returns.csv`：
```csv
order_no,serial_number,return_date,customer_name,product_name,quality_result,refund_status,warehouse_location,repair_responsibility
RT20260501001,SN001,2026-05-01,张三,手机A,合格,已退款,A-01,
RT20260501002,SN002,2026-05-02,李四,手机B,需返修,待审核,B-02,
RT20260501003,SN003,2026-05-03,王五,平板C,报废,待审核,C-01,
RT20260501004,SN004,2026-05-04,赵六,耳机D,,已批准,,
RT20260501005,SN001,2026-05-05,孙七,手机A,合格,待审核,A-02,
```

### 执行测试
```bash
# 导入数据（会检测到4个异常）
wh-return import test_returns.csv

# 查看异常
wh-return exceptions

# 修正异常示例
wh-return fix SN002 repair_responsibility "厂方质量问题"
wh-return fix SN003 quality_result "合格"
wh-return fix SN004 quality_result "不合格"
wh-return resolve 5 "SN001重复确认是录入错误，实际是SN001A"

# 生成分拣报告
wh-return report
```

---

## 七、数据存储

所有数据保存在当前目录的 `returns.db` 文件中（SQLite 数据库）。

**包含内容：**
- 退货单和商品信息
- 导入批次记录（防止重复）
- 异常记录（含是否已解决）
- 人工修正记录（谁在什么时候改了什么）

---

## 八、常见问题

**Q: 不小心重复导入同一个文件怎么办？**
A: 不用担心，系统会自动检测并提示「该文件已导入过」。

**Q: 退款状态写错了能改吗？**
A: 可以，使用 `wh-return fix` 命令修改，所有修改都会被记录。

**Q: 月底客服要对账单怎么办？**
A: 使用 `wh-return report` 生成分拣报告，或者用 `wh-return list --orders` 查看所有退货单。

**Q: 列名是中文可以吗？**
A: 可以，系统支持中英文列名，如「订单号」「序列号」「质检结果」等。

---

## 九、目录结构
```
.
├── warehouse_return_inspector/   # 工具源代码
│   ├── __init__.py
│   ├── cli.py                    # 命令行入口
│   ├── database.py               # 数据库操作
│   ├── importer.py               # 数据导入
│   ├── validator.py              # 异常检测
│   └── reporter.py               # 报告生成
├── requirements.txt              # 依赖列表
├── setup.py                      # 安装配置
├── examples/                     # 示例数据
└── README.md                     # 本文档
```
