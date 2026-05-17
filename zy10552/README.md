# OpenAPI 权限矩阵 CLI

一个命令行工具，用于从 OpenAPI 规范文件中提取权限信息，生成角色-接口权限矩阵报告。

## 功能特性

- ✅ **OpenAPI 契约解析**: 支持 YAML/JSON 格式的 OpenAPI 3.0+ 规范
- 🔍 **角色抽取**: 从 security scopes、扩展字段(x-roles)和描述文本中自动提取角色
- ⚠️ **缺失检测**: 检测未配置鉴权、未配置角色、缺少鉴权说明等问题
- 📊 **矩阵导出**: 输出终端摘要、机器可读(JSON)和Markdown报告
- 🚪 **退出码**: 严格模式下发现问题返回非0退出码，支持CI集成
- 🔄 **去重处理**: 相同(method+path)的接口自动去重，记录来源
- 📁 **目录支持**: 支持递归扫描整个目录下的所有OpenAPI文件

## 安装

```bash
npm install
```

## 使用方法

### 基本用法

```bash
node bin/cli.js generate
```

### 指定输入输出目录

```bash
node bin/cli.js generate -i ./my-openapi -o ./reports
```

### 指定预定义角色

```bash
node bin/cli.js generate -r admin,manager,user
```

### 严格模式（有缺失项时退出码为1）

```bash
node bin/cli.js generate --strict
```

### 不清空输出目录（保留旧结果）

```bash
node bin/cli.js generate --no-clean
```

## 完整选项

```
-i, --input <dir>    OpenAPI文件输入目录 (默认: "./openapi")
-o, --output <dir>   输出目录 (默认: "./output")
-r, --roles <roles>  角色列表，逗号分隔
--strict             严格模式，发现缺失权限时退出码为1
--no-clean           不清空输出目录，保留旧结果
```

## 输出文件

每次运行会生成以下文件：

- `permission-matrix-<timestamp>.json` - 完整的机器可读数据
- `permission-matrix-latest.json` - 最新结果的符号链接
- `permission-matrix-<timestamp>.md` - 适合分享的Markdown报告
- `permission-matrix-latest.md` - 最新报告的符号链接

## OpenAPI 约定

工具会从以下位置提取权限信息：

1. **Security Scopes**: `security[].bearerAuth[]` 中的scope值作为角色
2. **扩展字段**: `components.securitySchemes.<name>.x-roles` 数组
3. **描述文本**: 从接口description中匹配关键词如"需要 admin 角色"

### 示例

```yaml
paths:
  /api/users:
    get:
      summary: 获取用户列表
      description: 需要 admin 或 manager 角色
      security:
        - bearerAuth:
            - admin
            - manager
```

## 检测的缺失项类型

- `no_auth_required`: 接口未配置鉴权要求（公开接口）
- `no_roles_defined`: 接口需要鉴权但未配置具体角色
- `no_auth_description`: 接口缺少鉴权说明文本

## 退出码说明

- `0`: 成功，或非严格模式下有缺失项
- `1`: 严格模式下发现缺失项
- `2`: 解析错误

## 项目结构

```
.
├── bin/
│   └── cli.js              # CLI入口
├── src/
│   ├── index.js            # 主生成器
│   ├── parser.js           # OpenAPI解析器
│   ├── roles.js            # 角色抽取器
│   ├── matrix.js           # 矩阵生成器
│   ├── report.js           # 报告生成器
│   ├── detector.js         # 缺失检测器
│   ├── deduplicator.js     # 去重处理器
│   └── errors.js           # 错误收集器
├── openapi/                # 示例输入文件
└── package.json
```
