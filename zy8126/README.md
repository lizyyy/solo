# 票据版式回放器

本地 POS/自助机小票模板检查工具，为财务同事提供离线模板验证能力。

## 功能特性

- 📄 **版式渲染**: 支持 58mm 和 80mm 纸宽的等宽字体预览
- 🔍 **规则校验**: 
  - 金额四舍五入校验
  - 税率有效性检查
  - 条码元素占位检测
  - CJK 字符/emoji 宽度计算
  - 分页截断风险预警
- 📊 **多格式导出**:
  - `preview.txt` - 文本预览
  - `issues.csv` - 问题清单
  - `report.md` - 完整报告

## 项目结构

```
.
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── types/
│   │   └── index.ts        # 类型定义
│   ├── parser/
│   │   └── index.ts        # YAML/JSONL 解析器
│   ├── layout-engine/
│   │   └── index.ts        # 版式渲染引擎
│   ├── validator/
│   │   └── index.ts        # 规则校验器
│   └── exporter/
│       └── index.ts        # 导出模块
├── templates/
│   └── standard_receipt.yaml    # 小票模板
├── transactions.jsonl            # 交易数据
├── printer_profiles.yaml         # 打印机配置
├── package.json
└── tsconfig.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行演示

#### 渲染票据预览

```bash
npm run dev -- render
```

#### 验证数据格式

```bash
npm run dev -- validate
```

#### 详细模式

```bash
npm run dev -- render -v
npm run dev -- validate -v
```

#### 指定特定模板或交易

```bash
# 指定模板
npm run dev -- render -t standard_receipt

# 指定交易
npm run dev -- validate --transaction TXN001

# 指定打印机配置
npm run dev -- render -p thermal_80mm
```

#### 自定义数据/输出目录

```bash
npm run dev -- render -d ./data -o ./output
```

## 数据文件说明

### printer_profiles.yaml

打印机配置文件，定义不同型号打印机的参数：

```yaml
thermal_58mm:
  name: 58mm 热敏打印机
  paperWidth: 58           # 纸宽 mm
  charsPerLine: 32         # 每行字符数
  supportedEncodings:
    - GBK
    - UTF-8
  hasBarcode: true         # 是否支持条码
  maxLinesPerPage: 100     # 每页最大行数
  features:
    cutter: true
    cashDrawer: true
```

### templates/*.yaml

小票模板文件，定义票据布局：

```yaml
name: standard_receipt
version: "1.0.0"
printerProfile: thermal_58mm

elements:
  - type: text
    content: "欢迎光临"
    align: center
    bold: true
    doubleWidth: true

  - type: line
    content: "-"

  - type: table
    columns:
      - key: name
        width: 16
        align: left
      - key: price
        width: 8
        align: right

  - type: barcode
    barcodeType: CODE128
    barcodeData: TXN001
```

**支持的元素类型:**

| 类型 | 说明 |
|------|------|
| `text` | 文本元素，支持对齐、加粗、倍宽等样式 |
| `line` | 分割线 |
| `space` | 空行 |
| `table` | 表格 |
| `barcode` | 条码 |
| `qrcode` | 二维码 |

### transactions.jsonl

交易数据文件，每行一个 JSON 对象：

```json
{
  "id": "TXN001",
  "timestamp": "2024-01-15T14:30:00+08:00",
  "type": "sale",
  "items": [
    {
      "name": "可口可乐330ml",
      "quantity": 2,
      "unitPrice": 3.50,
      "totalPrice": 7.00,
      "taxRate": 0.13,
      "taxAmount": 0.91
    }
  ],
  "subtotal": 21.80,
  "taxTotal": 2.83,
  "discountTotal": 0,
  "grandTotal": 24.63,
  "paymentMethod": "wechat",
  "paymentAmount": 25.00,
  "changeAmount": 0.37
}
```

## 校验规则说明

### 金额四舍五入校验

检查以下金额关系是否正确：
- 商品小计之和 = 订单小计
- 单价 × 数量 = 商品总价
- 小计 + 税额 - 折扣 = 总计
- 支付金额 - 总计 = 找零

### 税率校验

- 有效税率范围: 0%, 6%, 9%, 13%
- 税额 = 商品总价 × 税率
- 税额汇总 = 订单税额

### 字符宽度计算

- ASCII 字符: 1 单位宽度
- CJK 中文字符: 2 单位宽度
- Emoji: 2 单位宽度

### 分页风险

- 超过打印机最大行数时警告
- 分页位置靠近合计行时提示

## 示例数据中的异常场景

项目内置了以下异常场景用于演示：

| 交易ID | 异常类型 | 说明 |
|--------|----------|------|
| TXN005 | 金额四舍五入错误 | 9.99 × 2 = 19.98，但记录为 20.00 |
| TXN006 | 缺字段 | 缺少 `cashier`、`registerId`、`taxRate` 等字段 |
| TXN007 | Emoji 检测 | 商品名包含 🍎🍌 等 emoji |
| TXN008 | 无效税率 | 税率 25% 不在有效范围内 |
| TXN003 | 商品名过长 | "日本进口白色恋人..." 视觉宽度超过 24 |
| TXN004 | 商品名超长 | 测试超宽商品名的警告 |

## 输出文件说明

### preview.txt

文本格式的票据预览，包含行号和纸宽标记：

```
================================================================================
                          票据版式回放器 - 预览报告
                          生成时间: 2024-01-15T14:30:00.000Z
================================================================================

--------------------------------------------------------------------------------
  模板: standard_receipt
  交易ID: TXN001
  纸宽: 58mm (每行 32 字符)
  总行数: 45
--------------------------------------------------------------------------------

[001]           欢迎光临
[002]
[003]           示例便利店
[004]        北京市朝阳区建国路88号
...

  纸宽标记: ++++++++++++++++++++++++++++++++
```

### issues.csv

CSV 格式的问题清单，可导入 Excel 分析：

```csv
ID,类型,严重程度,消息,模板名称,交易ID,元素索引,行号,字段,期望值,实际值
ISSUE-1,AMOUNT_ROUNDING_ERROR,error,小计金额不匹配...,standard_receipt,TXN005,,,,subtotal,19.98,20.00
ISSUE-2,MISSING_FIELD,warning,商品 "商品B" 缺少税率信息,standard_receipt,TXN006,,,,items[0].taxRate,,
```

### report.md

Markdown 格式的完整报告：

```markdown
# 票据版式回放器 - 检查报告

## 摘要

| 指标 | 数值 |
|------|------|
| 处理票据数 | 8 |
| 问题总数 | 15 |
| 错误数 | 5 |
| 警告数 | 8 |
| 提示数 | 2 |

## 详细问题列表

### 错误 (5)

- **[ISSUE-1]** 商品 "商品A" 金额不匹配: 单价 x 数量 = 19.98, 报表值 = 20.00
  - 模板: standard_receipt
  - 交易ID: TXN005
  - 字段: items[0].totalPrice
  - 期望: 19.98
  - 实际: 20.00
```

## 构建

```bash
npm run build
```

编译后可执行文件位于 `dist/` 目录：

```bash
node dist/cli.js render
```

## License

MIT
