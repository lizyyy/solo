# Gitleaks 基线整理 CLI 工具

解决 Gitleaks 扫描报告中历史基线和新增泄漏混淆的问题，帮助团队精准识别新增的密钥泄漏。

## 功能特性

- ✅ **报告解析**: 支持 Gitleaks JSON/CSV 格式报告解析
- 🔍 **基线匹配**: 通过指纹精确匹配历史基线条目
- 🎯 **新增识别**: 高亮显示不在基线中的新增泄漏
- 📊 **状态归并**: 区分新增、基线匹配、位置变更、异常样本
- 📋 **多格式输出**:
  - 终端摘要（重点突出，便于快速查看）
  - 机器可读 JSON 结果
  - 美观的 HTML 报告（适合发给同事）
- ⚠️ **异常处理**: 保留坏行原始位置和原因，可追溯到原文件

## 安装

```bash
npm install
npm run build
npm link
```

## 使用方法

### 基本用法

```bash
# 仅解析扫描报告（无基线）
gitleaks-baseline examples/sample-scan.json

# 使用基线文件进行对比
gitleaks-baseline examples/sample-scan.json -b examples/sample-baseline.json
```

### 完整选项

```bash
gitleaks-baseline <scan-report> [options]

参数:
  scan-report              Gitleaks 扫描报告文件路径 (JSON 或 CSV)

选项:
  -b, --baseline <path>     基线文件路径 (JSON)
  -o, --output-json <path>     输出 JSON 报告路径 (默认: report/result.json)
  -h, --output-html <path>    输出 HTML 报告路径 (默认: report/result.html)
  --output-baseline <path>    输出更新后的基线文件
  -v, --verbose               显示详细信息
  --strict                    严格模式，有新增泄漏时退出码为 1
  -V, --version               输出版本号
```

### 示例

```bash
# 基本使用
gitleaks-baseline scan-result.json -b baseline.json

# 指定输出路径
gitleaks-baseline scan.json -b baseline.json -o output/result.json -h output/result.html

# 生成更新后的基线
gitleaks-baseline scan.json -b baseline.json --output-baseline new-baseline.json

# 详细模式
gitleaks-baseline scan.json -b baseline.json -v

# 严格模式（CI/CD 中使用）
gitleaks-baseline scan.json -b baseline.json --strict
```

## 输出说明

### 终端摘要

终端只显示关键信息：
- 统计摘要（总数、新增、基线、异常等）
- 新增泄漏详情（需立即关注）
- 异常样本（需检查数据）
- 解析错误
- 结论和建议

### JSON 报告

包含完整的处理结果，适合机器处理：
- 统计信息
- 所有泄漏的详细信息（含状态分类）
- 异常样本和解析错误
- 原始扫描数据

### HTML 报告

适合团队分享的美观报告，包含：
- 可视化统计卡片
- 新增泄漏高亮展示
- 异常样本详情
- 可折叠的基线匹配列表
- 结论和建议

## 基线文件格式

```json
[
  {
    "fingerprint": "fingerprint_aws_001",
    "file": "src/config/aws.js",
    "line": 42,
    "status": "accepted",
    "notes": "已确认的测试环境密钥",
    "addedAt": "2024-01-20T00:00:00Z"
  }
]
```

## 状态分类

| 状态 | 说明 | 处理建议 |
|------|------|----------|
| 新增 | 不在基线中的新泄漏 | ⚠️ 需立即确认和处理 |
| 基线匹配 | 指纹匹配的历史基线 | ✅ 已确认，可忽略 |
| 位置变更 | 指纹匹配但文件/行号变更 | 🔄 需检查是否真实迁移 |
| 异常 | 数据格式异常（空字段、非法值等） | ❓ 检查扫描数据源 |

## 项目结构

```
.
├── src/
│   ├── index.ts      # CLI 入口
│   ├── types.ts      # 类型定义
│   ├── parser.ts     # 报告解析器
│   ├── processor.ts  # 核心处理逻辑
│   ├── printer.ts    # 终端输出
│   └── exporter.ts   # 报告导出
├── examples/         # 示例数据
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 编译
npm run build

# 监听模式
npm run dev

# 测试
npm test
```

## 许可证

MIT
