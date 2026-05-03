# 化妆品配方标签一致性预检工具

一个用于检查化妆品配方与产品标签一致性的自动化工具，帮助确保产品标签符合法规要求。

## 功能特性

- **INCI 名称检查**：验证配方中成分名称是否符合标准 INCI 命名规范，识别别名使用情况

- **含量排序检查**：检查成分是否按照含量从高到低排序，识别相同含量成分组

- **禁限用成分检查**：检测是否使用禁用成分或超量使用限用成分

- **香精过敏原标注检查**：检查香精过敏原是否按规定标注

- **标签与配方匹配检查**：验证标签成分与配方成分是否一致

- **多格式报告输出**：生成 Markdown 审计报告、CSV 问题列表和详细修正建议

## 项目结构

```
zy8200/
├── index.js              # CLI 入口脚本
├── package.json          # 项目配置文件
├── README.md             # 项目说明文档
├── src/
│   ├── parser.js       # 解析模块（解析各种输入文件）
│   ├── rules.js        # 规则模块（实现各种检查逻辑）
│   └── reporter.js     # 报告模块（生成输出文件）
├── examples/
│   ├── formula.csv         # 示例配方数据
│   ├── inci_dictionary.yaml  # INCI 名称字典
│   ├── pack_label.txt       # 示例包装标签
│   ├── allergen_rules.json   # 过敏原规则
│   └── output/              # 示例输出目录
└── output/                # 默认输出目录
```

## 安装

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

1. 进入项目目录：
```bash
cd zy8200
```

2. 安装依赖：
```bash
npm install
```

## 使用方法

### 命令行参数

```bash
node index.js [选项]
```

| 选项 | 缩写 | 说明 | 必需 |
|------|------|------|------|
| --formula | -f | 配方 CSV 文件路径 | 是 |
| --inci-dict | -i | INCI 字典 YAML 文件路径 | 是 |
| --pack-label | -p | 包装标签文本文件路径 | 是 |
| --allergen-rules | -a | 过敏原规则 JSON 文件路径 | 是 |
| --output | -o | 输出目录路径（默认: ./output） | 否 |

### 运行示例

#### 本地运行 Demo（使用示例数据）：

```bash
npm run test
```

或者手动执行完整命令：

```bash
node index.js --formula examples/formula.csv --inci-dict examples/inci_dictionary.yaml --pack-label examples/pack_label.txt --allergen-rules examples/allergen_rules.json --output examples/output
```

### 输入文件格式

#### 1. formula.csv（配方文件）

CSV 格式，包含以下列：

| 列名 | 说明 | 示例 |
|------|------|------|
| name | 成分名称 | 水 |
| inciName | INCI 名称（可选） | Aqua |
| percentage | 含量（百分比） | 70.0 |
| role | 作用（可选） | 溶剂 |
| isFragrance | 是否香精（true/false） | false |

#### 2. inci_dictionary.yaml（INCI 字典）

YAML 格式，定义标准 INCI 名称及其别名：

```yaml
inciNames:
  - standardName: Aqua
    casNumber: 7732-18-5
    description: 水，化妆品中最常用的溶剂
    aliases:
      - 水
      - 纯化水
      - 去离子水
```

#### 3. pack_label.txt（包装标签）

纯文本格式，包含产品标签内容，工具会自动提取成分列表。

#### 4. allergen_rules.json（过敏原规则）

JSON 格式，定义香精过敏原和禁限用成分规则：

```json
{
  "allergens": [
    {
      "name": "Limonene",
      "chineseName": "柠檬烯",
      "casNumber": "138-86-3",
      "category": "香精过敏原"
    }
  ],
  "threshold": 0.001,
  "restrictedIngredients": [...]
}
```

### 输出文件

运行成功后会在指定的输出目录生成以下文件：

| 文件名 | 说明 |
|--------|------|
| label_audit.md | 详细的审计报告（Markdown 格式） |
| issues.csv | 问题列表（CSV 格式） |
| suggestions.md | 详细修正建议（Markdown 格式） |

## 示例数据说明

示例数据中包含以下边界情况用于测试：

### 1. 含量排序相同（边界情况）

在 `formula.csv` 中：
- 维生素C（Ascorbic Acid）：1.5%
- 烟酰胺（Niacinamide）：1.5%

这两个成分含量相同，顺序可以互换，但工具会识别并提示保持一致性建议。

### 2. 别名未归一（边界情况）

在 `formula.csv` 中：
- 玻尿酸（别名，标准名称应为透明质酸钠 Sodium Hyaluronate）：1.0%
- 神经酰胺（Ceramide）：1.0%

这两个成分含量相同，并且"玻尿酸"使用了别名而非标准 INCI 名称。工具会检测到并建议归一化。

### 3. 其他测试场景

- **香精过敏原未标注：柠檬烯（Limonene）和芳樟醇（Linalool）含量超过阈值但标签未标注
- **成分排序错误：苯氧乙醇（0.8%）排在香精（0.2%）之后，但含量更高
- **标签与配方不匹配：标签中缺少柠檬烯和芳樟醇

## 检查规则详情

### INCI 名称检查

- 验证成分名称是否在 INCI 字典中
- 检测是否使用了别名而非标准名称
- 提供别名到标准名称的映射建议

### 含量排序检查

- 检查成分是否按含量从高到低排序
- 识别相同含量的成分组
- 提供正确的排序建议

### 禁限用成分检查

- 检测禁用成分（如汞、铅、砷、维甲酸等）
- 检查限用成分是否超量（如甲醛、羟苯酯类等）

### 香精过敏原标注检查

- 检测香精成分中的过敏原
- 检查过敏原含量是否超过阈值（默认 0.001%）
- 验证标签是否正确标注过敏原

### 标签与配方匹配检查

- 比较标签成分与配方成分
- 检测标签中存在但配方中不存在的成分
- 检测配方中存在但标签中不存在的成分

## 问题严重程度

| 级别 | 说明 |
|------|------|
| Critical (严重) | 违反法规的严重问题，必须立即处理 |
| High (高) | 重要问题，建议优先处理 |
| Medium (中) | 中等问题，建议处理 |
| Low (低) | 轻微问题，可选择性处理 |

## 开发说明

### 模块说明

1. **parser.js** - 解析模块
   - `parseFormulaCsv()`: 解析配方 CSV 文件
   - `parseInciDictionary()`: 解析 INCI 字典 YAML 文件
   - `parsePackLabel()`: 解析包装标签文本文件
   - `parseAllergenRules()`: 解析过敏原规则 JSON 文件

2. **rules.js** - 规则模块
   - `checkInciNames()`: 检查 INCI 名称
   - `checkPercentageOrder()`: 检查含量排序
   - `checkRestrictedIngredients()`: 检查禁限用成分
   - `checkAllergenLabeling()`: 检查香精过敏原标注
   - `checkLabelIngredientsMatch()`: 检查标签与配方匹配

3. **reporter.js** - 报告模块
   - `generateMarkdownReport()`: 生成 Markdown 审计报告
   - `generateIssuesCsv()`: 生成 CSV 问题列表
   - `generateSuggestionsReport()`: 生成修正建议报告

### 扩展规则

可以通过修改 `src/rules.js` 文件添加新的检查规则，或修改 `examples/allergen_rules.json` 文件更新禁限用成分和过敏原列表。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
