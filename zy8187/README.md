# 热敏小票模板预检 CLI 工具

一个用于在门店收银系统发版前预检热敏小票模板的 Node.js/TypeScript CLI 工具。

## 功能特性

- **模板验证**：检查小票模板在 58mm 和 80mm 宽度下的排版兼容性
- **中英文宽度处理**：正确计算中文字符（占2个字符宽度）和英文字符（占1个字符宽度）
- **金额对齐检查**：验证金额字段的右对齐和格式
- **二维码/条码检查**：检查条码和二维码占位是否超出设备能力
- **指令兼容性检查**：验证切纸、开钱箱等指令是否在打印机能力范围内
- **问题导出**：将验证发现的问题导出为 issues.csv
- **HTML 预览**：将样例小票渲染成 HTML 进行可视化预览
- **异常处理**：自动检测缺字段和超长品名等异常情况

## 安装

```bash
npm install
```

## 项目结构

```
.
├── src/
│   ├── cli/
│   │   └── index.ts          # CLI 入口文件
│   ├── core/
│   │   ├── index.ts          # 核心模块导出
│   │   ├── validator.ts      # 模板验证器
│   │   ├── renderer.ts       # 小票渲染器
│   │   └── exporter.ts       # 问题导出器
│   ├── readers/
│   │   ├── index.ts          # 读取器导出
│   │   ├── yaml-reader.ts    # YAML 模板读取
│   │   ├── jsonl-reader.ts   # JSONL 交易数据读取
│   │   └── csv-reader.ts     # CSV 打印机配置读取
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   └── utils/
│       ├── index.ts          # 工具函数导出
│       └── text-width.ts     # 文本宽度计算工具
├── samples/
│   ├── receipt_templates.yaml    # 小票模板示例
│   ├── transactions.jsonl        # 交易数据示例
│   └── printer_profiles.csv      # 打印机配置示例
├── package.json
├── tsconfig.json
└── README.md
```

## 使用方法

### 1. 验证模板

```bash
npm run dev -- validate
```

或使用完整参数：

```bash
npm run dev -- validate \
  -t samples/receipt_templates.yaml \
  -d samples/transactions.jsonl \
  -p samples/printer_profiles.csv \
  -o issues.csv
```

#### 命令选项

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| --templates | -t | samples/receipt_templates.yaml | 模板文件路径 |
| --data | -d | samples/transactions.jsonl | 交易数据文件路径 |
| --printers | -p | samples/printer_profiles.csv | 打印机配置文件路径 |
| --output | -o | issues.csv | 问题报告输出路径 |

### 2. 渲染小票预览

```bash
npm run dev -- render
```

或使用完整参数：

```bash
npm run dev -- render \
  -t samples/receipt_templates.yaml \
  -d samples/transactions.jsonl \
  -p samples/printer_profiles.csv \
  -o output \
  -c 3
```

#### 命令选项

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| --templates | -t | samples/receipt_templates.yaml | 模板文件路径 |
| --data | -d | samples/transactions.jsonl | 交易数据文件路径 |
| --printers | -p | samples/printer_profiles.csv | 打印机配置文件路径 |
| --output | -o | output | HTML 输出目录 |
| --count | -c | 3 | 渲染的样例数量 |

## 数据文件格式

### 1. receipt_templates.yaml (模板文件)

```yaml
- name: standard_58mm
  width: 58mm                    # 支持 58mm 或 80mm
  header:
    - type: text                 # 文本类型
      content: "{{ store.name }}" # 支持变量插值
      align: center               # 对齐方式: left, center, right
      bold: true                  # 是否加粗
    - type: separator            # 分隔线
      content: "-"               # 分隔符字符
    - type: qrcode               # 二维码
      value: "https://example.com/receipt/{{ id }}"
    - type: barcode              # 条形码
      value: "{{ id }}"
      height: 80                 # 条码高度
    - type: space                # 空行
      lines: 2                   # 空行数量
  items:
    columns:
      - key: name                # 字段名
        label: 商品              # 列标题
        width: 18                # 列宽度
        align: left              # 对齐方式
    separator: true              # 是否显示列分隔线
  footer:
    # 与 header 相同格式
  commands:
    cut: true                    # 是否切纸
    openDrawer: true             # 是否开钱箱
    beep: false                  # 是否蜂鸣
```

### 2. transactions.jsonl (交易数据)

每行一个 JSON 对象：

```json
{
  "id": "TXN001",
  "date": "2024-01-15",
  "time": "14:30:25",
  "cashier": "张三",
  "items": [
    {
      "name": "可口可乐 330ml",
      "quantity": 2,
      "price": 3.50,
      "subtotal": 7.00,
      "category": "饮料"
    }
  ],
  "subtotal": 32.40,
  "tax": 0.00,
  "discount": 2.40,
  "total": 30.00,
  "payment": {
    "method": "微信支付",
    "amount": 30.00,
    "change": 0.00,
    "cardInfo": "****8888"
  },
  "customer": {
    "name": "李四",
    "phone": "13800138000",
    "memberId": "VIP001"
  },
  "store": {
    "name": "好邻居便利店 朝阳店",
    "address": "北京市朝阳区建国路88号",
    "phone": "010-12345678"
  }
}
```

### 3. printer_profiles.csv (打印机配置)

```csv
model,width,charsPerLine,supportsQRCode,supportsBarcode,supportsCut,supportsOpenDrawer,maxBarcodeHeight,qrCodeSize
Epson TM-T88V,80mm,48,true,true,true,true,80,4
Xprinter XP-58II,58mm,32,true,true,true,true,60,3
Gprinter GP-58L,58mm,32,false,true,true,true,50,3
```

#### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| model | string | 打印机型号 |
| width | string | 打印宽度 (58mm 或 80mm) |
| charsPerLine | number | 每行字符数 |
| supportsQRCode | boolean | 是否支持二维码 |
| supportsBarcode | boolean | 是否支持条形码 |
| supportsCut | boolean | 是否支持切纸 |
| supportsOpenDrawer | boolean | 是否支持开钱箱 |
| maxBarcodeHeight | number | 最大条码高度 |
| qrCodeSize | number | 二维码尺寸 |

## 验证检查项

### 1. 中英文宽度检查
- 中文字符占 2 个字符宽度
- 英文字符占 1 个字符宽度
- 检测文本是否超出纸张宽度

### 2. 金额对齐检查
- 验证金额字段格式（保留两位小数）
- 检查金额右对齐布局
- 检测大金额是否超出宽度

### 3. 二维码/条码检查
- 检查打印机是否支持二维码/条码
- 验证条码高度是否在设备支持范围内
- 检查占位是否合理

### 4. 指令兼容性检查
- 切纸命令：检查打印机是否支持
- 开钱箱命令：检查打印机是否支持
- 蜂鸣命令：检查兼容性

### 5. 异常检测
- 缺字段：检测交易数据中缺失的必填字段
- 超长品名：检测商品名称是否超出列宽
- 变量不存在：检测模板中引用的变量是否在数据中存在

## 输出说明

### issues.csv 格式

| 严重程度 | 类别 | 字段 | 消息 | 交易ID | 模板名称 | 打印机型号 | 行号 |
|----------|------|------|------|--------|----------|------------|------|
| error/warning/info | 问题分类 | 相关字段 | 问题描述 | 交易ID | 模板名 | 打印机型号 | 数据行号 |

### HTML 预览

渲染的 HTML 文件包含：
- 模拟的小票宽度（58mm 或 80mm）
- 等宽字体模拟打印效果
- 条码/二维码占位显示
- 指令支持状态标识

## 构建

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

## 类型检查

```bash
npm run typecheck
```

## 依赖说明

- **commander**: CLI 命令解析
- **js-yaml**: YAML 文件解析
- **csv-parser**: CSV 文件读取
- **csv-writer**: CSV 文件写入
- **typescript**: TypeScript 支持
- **ts-node**: TypeScript 运行时

## 示例场景

### 场景 1：验证新模板

```bash
# 使用自定义模板进行验证
npm run dev -- validate -t my_template.yaml
```

### 场景 2：测试不同打印机兼容性

```bash
# 使用特定打印机配置验证
npm run dev -- validate -p my_printers.csv
```

### 场景 3：生成预览给业务确认

```bash
# 生成 5 个样例的预览
npm run dev -- render -c 5 -o preview_output
```

### 场景 4：CI/CD 集成

```bash
# 在 CI 中运行验证，有错误时退出码为 1
npm run dev -- validate
if [ $? -eq 0 ]; then
  echo "验证通过，准备发版"
else
  echo "发现问题，请修复后重试"
  exit 1
fi
```

## 注意事项

1. **纸张宽度**：58mm 小票通常 32 字符/行，80mm 通常 48 字符/行
2. **中英文宽度**：中文字符按 2 个字符宽度计算，请确保模板留有足够空间
3. **变量语法**：使用 `{{ variable_name }}` 进行变量插值，支持嵌套属性如 `{{ store.name }}`
4. **金额格式**：建议统一保留两位小数，避免排版混乱
5. **打印机兼容性**：不同型号打印机支持的功能不同，请确保模板与目标打印机匹配

## 许可证

MIT