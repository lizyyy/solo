# 跨境样品清关材料检查 CLI

一个用于跨境样品寄送前清关材料检查的命令行工具。

## 功能简介

跨境样品寄送前必须准备 **商业发票（Invoice）、成分说明（Composition）、用途声明（Declaration）** 三份材料，缺一项就会卡关。

本工具帮助您：
- ✅ 验证材料清单是否完整有效
- ✅ 检查目的国清关规则是否可靠
- ✅ 检测缺件并与原始数据对比
- ✅ 记录检查历史，支持修正后重跑
- ✅ 导出检查结果为 JSON 或 CSV

## 安装

```bash
npm install
npm run build
```

## 快速开始

### 1. 初始化示例数据

```bash
node dist/index.js init
```

这会创建 4 个示例样品：
- `sample-complete-001` - 完整样品（材料齐全）
- `sample-missing-002` - 缺失材料样品（缺成分说明和用途声明）
- `sample-invalid-003` - 无效材料样品（成分说明无效）
- `sample-highvalue-004` - 高价值样品（价值超过阈值）

### 2. 查看所有样品

```bash
node dist/index.js list
```

### 3. 执行材料检查

```bash
# 检查完整样品（正常处理）
node dist/index.js check sample-complete-001

# 检查缺失材料样品（失败原因）
node dist/index.js check sample-missing-002
```

### 4. 修正后重跑

```bash
# 1. 查看失败原因
node dist/index.js check sample-missing-002

# 2. 导入修正后的样品数据（示例文件已创建）
node dist/index.js import fixed-sample.json

# 3. 再次检查
node dist/index.js check sample-missing-002

# 4. 查看历史记录对比
node dist/index.js history sample-missing-002
```

### 5. 导出结果

```bash
# 导出为 JSON
node dist/index.js export sample-missing-002

# 导出为 CSV
node dist/index.js export sample-missing-002 -f csv
```

### 6. 验证规则和材料

```bash
# 验证国家规则配置
node dist/index.js validate-rules

# 验证样品材料清单
node dist/index.js validate-materials sample-complete-001
```

## 命令列表

| 命令 | 别名 | 说明 |
|------|------|------|
| `init` | - | 初始化样例数据和配置 |
| `list` | `ls` | 列出所有样品 |
| `import <file>` | - | 从JSON文件导入样品数据 |
| `check <sample-id>` | - | 执行清关材料检查 |
| `history <sample-id>` | `log` | 查看样品的检查历史 |
| `export <sample-id>` | - | 导出检查结果（支持 JSON/CSV） |
| `validate-rules` | `vr` | 验证国家规则配置是否可靠 |
| `validate-materials <sample-id>` | `vm` | 验证样品材料清单是否生效 |

## 检查结果说明

### ✓ 通过（PASSED）

**输出特征：**
- 状态显示为 **绿色 "通过"**
- 所有检查项目显示 ✓
- 无错误信息
- 警告信息数量为 0

**含义：**
- 所有必需材料（发票、成分说明、用途声明）都已提供且有效
- 样品价值在目的国免税阈值范围内
- 无附加要求需要确认

**操作建议：**
- ✅ 可以直接安排寄送

### ✗ 未通过（FAILED）

**输出特征：**
- 状态显示为 **红色 "未通过"**
- 检查项目中有 ✗
- 有错误信息列表
- 缺少材料列表显示缺哪些

**含义：**
- 缺少一份或多份必需材料（缺一项就会卡关！）
- 或提供的材料无效（内容/格式不符合要求）
- 必须补充或修正后才能顺利清关

**操作建议：**
- ❌ **不能直接寄送，会卡关！**
- 查看"缺少材料"列表，补充缺失的材料
- 查看"错误信息"，修正无效材料
- 使用 `import` 命令导入修正后的样品
- 重新执行 `check` 命令验证

### ⚠ 需人工审核（MANUAL_REVIEW）

**输出特征：**
- 状态显示为 **紫色 "需人工审核"**
- 所有必需材料检查通过（✓）
- 有警告信息列表

**含义：**
- 必需材料都齐全了
- 但存在需要人工确认的附加要求
- 常见原因：
  - 样品价值超过免税阈值（可能需要缴纳关税）
  - 目的国要求的附加证明（如 EORI 号、CE 认证等）

**操作建议：**
- ⚠️ 建议联系目的国海关或清关代理确认
- 查看"警告信息"列表，确认附加要求
- 如确认无需额外文件，可安排寄送
- 如需要额外文件，补充后再检查

## 必需材料说明

### 1. 商业发票（Invoice）
- **作用：** 用于海关申报货物价值和原产地
- **必须包含：**
  - 完整的货物描述
  - 准确的 HS 编码
  - 样品价值和货币
  - 原产地信息
  - 收发件人信息

### 2. 成分说明（Composition）
- **作用：** 让海关了解样品的材质成分
- **必须包含：**
  - 各成分的详细列表
  - 成分比例（如适用）
  - 是否含有敏感材料（如动物成分、化学品）

### 3. 用途声明（Declaration）
- **作用：** 证明货物为样品，非商业用途
- **必须包含：**
  - 明确标注为"样品"（Sample）
  - 声明"无商业价值"（No Commercial Value）
  - 说明具体用途（如客户测试、质量检验等）

## 支持的目的国

| 代码 | 国家 | 价值阈值 | 特殊要求 |
|------|------|----------|----------|
| US | 美国 | $2,500 | 超过 $800 可能征税 |
| EU | 欧盟 | €22 | 需 EORI 号 |
| JP | 日本 | ¥10,000 | 特定商品需厚劳省许可 |
| CN | 中国 | ¥50 | 需准确 HS 编码 |
| AU | 澳大利亚 | A$1,000 | 动植物产品需检疫声明 |
| UK | 英国 | £135 | 需英国 EORI 号 |

## 数据目录结构

```
data/
├── samples/          # 样品数据（JSON）
├── rules/            # 国家规则配置
├── history/          # 检查历史记录
└── exports/          # 导出文件
```

## 验收场景

### 场景 1：正常处理

```bash
node dist/index.js check sample-complete-001
```

**预期结果：**
- 材料齐全，所有检查项通过
- 状态：通过 或 需人工审核
- 可以安排寄送

### 场景 2：失败原因

```bash
node dist/index.js check sample-missing-002
```

**预期结果：**
- 显示缺少的材料（成分说明、用途声明）
- 状态：未通过
- 明确提示需要补充什么

### 场景 3：修正后重跑

```bash
# 第一次检查（失败）
node dist/index.js check sample-missing-002

# 导入修正后的数据
node dist/index.js import fixed-sample.json

# 第二次检查（改善）
node dist/index.js check sample-missing-002

# 查看历史对比
node dist/index.js history sample-missing-002
```

**预期结果：**
- 第一次：状态"未通过"，缺少2种材料
- 第二次：状态"需人工审核"，材料已补充
- 历史记录显示两次检查的差异

## 样品数据格式

导入样品时使用以下 JSON 格式：

```json
{
  "id": "sample-001",
  "name": "样品名称",
  "type": "electronic",
  "description": "样品描述",
  "originCountry": "CN",
  "destinationCountry": "US",
  "value": 150,
  "currency": "USD",
  "quantity": 2,
  "materials": [
    {
      "type": "invoice",
      "name": "商业发票.pdf",
      "filePath": "docs/invoice.pdf",
      "valid": true,
      "notes": "包含完整的HS编码"
    },
    {
      "type": "composition",
      "name": "成分说明.pdf",
      "filePath": "docs/composition.pdf",
      "valid": true
    },
    {
      "type": "declaration",
      "name": "用途声明.pdf",
      "filePath": "docs/declaration.pdf",
      "valid": true
    }
  ]
}
```

### 字段说明

**样品类型（type）：**
- `electronic` - 电子产品
- `textile` - 纺织品
- `chemical` - 化工品
- `food` - 食品
- `medical` - 医疗用品
- `general` - 一般商品

**材料类型（materials[].type）：**
- `invoice` - 商业发票
- `composition` - 成分说明
- `declaration` - 用途声明

## 项目结构

```
src/
├── index.ts              # CLI 入口
├── types/
│   └── index.ts          # 类型定义
├── services/
│   ├── storage.ts        # 存储服务
│   ├── checkEngine.ts    # 检查引擎
│   └── cliHandler.ts     # CLI 命令处理
├── data/
│   └── countryRules.ts   # 国家规则数据
└── utils/
    └── helpers.ts        # 工具函数
```

## License

MIT
