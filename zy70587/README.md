# YAML锚点展开CLI工具

一个功能强大的YAML锚点展开工具，支持机器可读输出和专业的Markdown报告。

## 功能特点

- ✅ **YAML锚点检测与展开** - 自动识别并展开所有锚点引用
- ✅ **合并操作追踪** - 记录所有 `<<:` 合并操作及其来源
- ✅ **值覆盖检测** - 识别并报告覆盖了锚点原始值的字段
- ✅ **终端彩色摘要** - 直观展示统计信息
- ✅ **机器可读JSON输出** - 包含完整的元数据和分析结果
- ✅ **专业Markdown报告** - 适合发给同事审阅的详细报告
- ✅ **错误处理** - 精确定位语法错误并展示上下文
- ✅ **清晰的退出码** - 便于在CI/CD流水线中集成

## 退出码说明

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 文件读取错误（文件不存在、权限不足等） |
| 2 | YAML解析错误（语法错误） |
| 3 | 处理过程中的其他错误 |

## 安装与使用

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 运行工具

**基本用法：**
```bash
node dist/cli.js --input your-file.yaml
```

**指定输出目录：**
```bash
node dist/cli.js --input your-file.yaml --output-dir ./output
```

**指定输出文件基础名：**
```bash
node dist/cli.js --input your-file.yaml --base-name my-report
```

### CLI参数说明

```
--input, -i       输入YAML文件路径（必需）
--output-dir, -o   输出目录（默认：当前目录）
--base-name, -b    输出文件基础名称（默认：自动生成带时间戳）
--no-json          不生成JSON输出
--no-markdown      不生成Markdown报告
--no-terminal      不输出终端摘要
--no-yaml          不生成展开后的YAML
```

## 输出文件说明

运行工具后，会在输出目录生成以下文件：

1. **`<base>.json`** - 机器可读的JSON结果，包含：
   - 成功状态和退出码
   - 统计摘要（锚点、合并、覆盖、错误数量）
   - 所有锚点的详细信息（名称、位置、值预览）
   - 所有合并操作的详细信息
   - 所有值覆盖的详情
   - 完整的错误信息，包含位置和上下文

2. **`<base>.md`** - 专业的Markdown报告，包含：
   - 报告头部（生成时间、输入文件、状态）
   - 统计摘要表格
   - 锚点定义详情
   - 合并操作详情
   - 值覆盖详情表格
   - 错误信息（如有）
   - 完整的展开后YAML代码

3. **`<base>.expanded.yaml`** - 完全展开后的YAML文件，所有锚点都被解析为实际值

## 项目结构

```
.
├── src/
│   ├── cli.ts          # CLI入口，参数处理
│   ├── expander.ts     # 核心展开逻辑
│   ├── output.ts       # 输出生成器
│   └── types.ts        # TypeScript类型定义
├── examples/
│   ├── sample.yaml     # 复杂示例文件
│   └── invalid.yaml    # 错误示例文件
├── package.json
├── tsconfig.json
└── README.md
```

## 示例

### 输入YAML

```yaml
base_db: &base_db
  host: localhost
  port: 5432
  username: admin

development:
  <<: *base_db
  database: app_dev
  max_connections: 50

production:
  <<: *base_db
  database: app_prod
  username: prod_user
```

### 终端输出

```
📊 YAML锚点展开摘要

✅ 展开成功

统计信息:
  锚点数量: 1
  合并操作: 2
  覆盖操作: 1

输出文件:
  JSON结果: .../sample-expanded-xxx.json
  Markdown报告: .../sample-expanded-xxx.md
  展开YAML: .../sample-expanded-xxx.expanded.yaml
```

## 开发

**监听模式开发：**
```bash
npm run dev
```

**构建：**
```bash
npm run build
```

## License

MIT
