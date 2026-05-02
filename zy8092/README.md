# Release Audit CLI

一个用于在软件发布前审核制品的 Node.js/TypeScript 命令行工具。

## 功能特性

- **制品摘要验证**: 验证制品的加密哈希值
- **构建者身份验证**: 验证制品由受信任的构建者构建
- **依赖许可证验证**: 验证依赖项使用的许可证
- **签名时间窗验证**: 验证签名是否在允许的时间范围内
- **制品-来源映射验证**: 验证每个制品都有对应的来源证明
- **重复摘要检测**: 检测多个制品是否有相同的哈希值
- **缺失证明检测**: 检测缺少来源证明的制品
- **时间戳乱序检测**: 检测构建开始时间晚于结束时间的情况

## 安装

```bash
npm install
```

## 使用方法

### 基本命令

```bash
npm run build
node dist/cli.js \
  --artifacts sample/artifacts.json \
  --sbom sample/sbom.json \
  --provenance sample/provenance.jsonl \
  --policy sample/policy.yaml \
  --output output
```

### 使用 Demo 脚本

```bash
npm run demo
```

## 命令行选项

- `-a, --artifacts <path>`: artifacts.json 文件路径（必填）
- `-s, --sbom <path>`: SPDX SBOM 文件路径（必填）
- `-p, --provenance <path>`: SLSA provenance JSONL 文件路径（必填）
- `-y, --policy <path>`: policy.yaml 文件路径（必填）
- `-o, --output <dir>`: 输出目录（默认: output）

## 输入文件格式

### artifacts.json

```json
{
  "version": "1.0.0",
  "artifacts": [
    {
      "name": "app-service:v1.2.3",
      "type": "image",
      "digest": "sha256:abcdef1234567890...",
      "tags": ["latest", "v1"]
    }
  ]
}
```

### policy.yaml

```yaml
version: "1.0"
allowedBuilders:
  - "https://github.com/MyOrg/MyRepo/.github/workflows/release.yml@refs/tags/v1"
allowedLicenses:
  - "MIT"
  - "Apache-2.0"
signatureWindowHours: 720
strict: false
```

## 输出文件

工具会生成以下文件：

- **release_audit.md**: 完整的审计报告（Markdown 格式）
- **violations.csv**: 违规记录（CSV 格式）
- **provenance_graph.html**: 可交互式的来源关系图（HTML 格式）

## 测试

```bash
npm test
```

## 核心规则

1. **duplicate-digest**: 检测重复的制品哈希
2. **missing-provenance**: 检测缺少来源证明的制品
3. **invalid-builder**: 检测不受信任的构建者
4. **time-window-exceeded**: 检测超过时间窗的签名
5. **timestamp-out-of-order**: 检测时间戳乱序
6. **missing-license**: 检测缺少许可证信息的依赖
7. **disallowed-license**: 检测不允许的许可证

## 项目结构

```
.
├── src/
│   ├── types.ts          # 类型定义
│   ├── parser.ts         # 输入文件解析
│   ├── validator.ts      # 校验逻辑
│   ├── output.ts         # 输出生成
│   ├── cli.ts            # CLI 主程序
│   └── validator.test.ts # 测试文件
├── sample/               # 示例数据
│   ├── artifacts.json
│   ├── sbom.json
│   ├── provenance.jsonl
│   └── policy.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## 许可证

MIT
