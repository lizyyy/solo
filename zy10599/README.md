# Mock Contract Checker

接口Mock数据与OpenAPI契约一致性检查CLI工具。

## 功能特性

- ✅ **契约解析**: 支持 OpenAPI 3.0+ (YAML/JSON)
- 🔍 **样例比对**: 自动匹配 Mock 数据与接口定义
- ❌ **字段缺失定位**: 精确标记缺失的必填字段
- 📝 **类型检查**: 严格的类型一致性校验
- 📊 **报告输出**: 机器可读(JSON) + 人类可读(Markdown)
- 📁 **批量检查**: 支持单个文件或整个目录
- ⏱️ **历史留存**: 重复运行不会覆盖旧报告

## 安装

```bash
npm install
npm link
```

## 使用示例

### 基本用法

```bash
mock-check ./openapi.yaml ./mocks/
```

### 指定输出目录

```bash
mock-check ./openapi.yaml ./mocks/ -o ./my-reports
```

### 禁用严格类型检查

```bash
mock-check ./openapi.yaml ./mocks/ --no-strict-type
```

### 检查可选字段

```bash
mock-check ./openapi.yaml ./mocks/ --check-optional
```

### 警告也视为失败

```bash
mock-check ./openapi.yaml ./mocks/ --fail-on-warning
```

## 输入格式

### OpenAPI 契约文件

支持 YAML 或 JSON 格式的 OpenAPI 3.0+ 规范文件。

```yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      summary: 获取用户信息
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                required:
                  - id
                  - name
                properties:
                  id:
                    type: string
                    description: 用户ID
                  name:
                    type: string
                    description: 用户名
                  email:
                    type: string
                    description: 邮箱
```

### Mock 文件格式

支持 JSON 和 JS 格式。

**方式一：标准格式（推荐）**
```json
{
  "method": "GET",
  "path": "/users/123",
  "statusCode": 200,
  "response": {
    "id": "123",
    "name": "张三"
  }
}
```

**方式二：直接返回数据**
```json
{
  "id": "123",
  "name": "张三",
  "email": "zhangsan@example.com"
}
```

**方式三：JS 模块**
```javascript
export default {
  method: 'GET',
  path: '/users/123',
  statusCode: 200,
  response: {
    id: '123',
    name: '张三'
  }
};
```

## 报告说明

### 报告分类

1. **✅ 正常项**: 所有检查通过的 Mock 文件
2. **⚠️ 风险项**: 存在字段缺失、类型不匹配等问题的文件
3. **❌ 无法处理的样本**: 解析错误、未匹配到接口、无 Schema 定义

### 检查项说明

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| `missing_field` | error/warning | 字段缺失 |
| `type_mismatch` | error/warning | 类型不匹配 |
| `extra_field` | warning | 契约中未定义的额外字段 |
| `invalid_enum` | error | 枚举值不在允许范围内 |

## 失败时的返回表现

| 退出码 | 说明 |
|--------|------|
| 0 | 检查通过（可能有警告） |
| 1 | 检查失败（存在错误或 --fail-on-warning 时存在警告） |
| 2 | 程序执行错误（文件不存在、解析错误等） |

## 报告文件

每次运行会在输出目录生成两个带时间戳的文件：

- `mock-consistency-report-YYYY-MM-DDTHH-MM-SS.json` - 机器可读的完整报告
- `mock-consistency-report-YYYY-MM-DDTHH-MM-SS.md` - 人类可读的 Markdown 报告

重复运行不会覆盖旧文件，所有历史报告都会保留。

## 目录结构

```
.
├── src/
│   ├── cli.js              # CLI 入口
│   └── lib/
│       ├── openapi-parser.js    # OpenAPI 契约解析器
│       ├── mock-parser.js      # Mock 文件解析器
│       ├── consistency-checker.js  # 一致性检查核心
│       └── report-generator.js    # 报告生成器
├── examples/              # 示例数据
├── reports/            # 报告输出目录（自动生成）
├── package.json
└── README.md
```

## 示例

运行示例检查：

```bash
npm run example
```

## License

MIT