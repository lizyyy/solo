# dep-break-scanner

依赖升级破坏面CLI工具 - 在升级基础包前，分析哪些源码文件和测试最可能受影响。

## 功能特性

- **引用扫描**: 使用AST静态分析源码，发现对指定依赖的所有引用
- **版本差异分析**: 分析两个版本间的API废弃、移除、签名变更和行为变化
- **影响分组**: 按CRITICAL/HIGH/MEDIUM/LOW四个级别分组展示
- **测试建议**: 生成P0-P3优先级的测试建议和行动项
- **多格式输出**:
  - 终端彩色摘要 (带表格和高亮)
  - JSON机器可读格式
  - Markdown同事友好报告
  - 异常样本JSON (保留原始位置和原因)
- **可重复执行**: 带时间戳的文件名，不会污染旧结果
- **支持配置**: 可指定源码目录和输出目录

## 安装

```bash
pip install -e .
```

## 使用方法

### 基本扫描

```bash
dep-break scan <依赖名> <旧版本> <新版本>
```

### 示例

```bash
# 扫描 requests 2.25.0 升级到 2.31.0 的影响
dep-break scan requests 2.25.0 2.31.0

# 指定源码目录和输出目录
dep-break scan requests 2.25.0 2.31.0 -s ./my-project -o ./reports

# 只输出JSON格式
dep-break scan requests 2.25.0 2.31.0 --json-only
```

### 查看报告

```bash
# 查看指定报告
dep-break view ./break-reports/requests_2.25.0_to_2.31.0_xxx.json

# 列出所有报告
dep-break list-reports
```

## 输出文件

每次扫描会生成以下文件（带时间戳确保不冲突）：

- `{依赖}_{旧版本}_to_{新版本}_{时间戳}.json` - 完整机器可读报告
- `{依赖}_{旧版本}_to_{新版本}_{时间戳}.md` - 同事友好Markdown报告
- `{依赖}_{旧版本}_to_{新版本}_{时间戳}_errors.json` - 异常样本详情

## 影响级别说明

| 级别 | 颜色 | 说明 |
|------|------|------|
| CRITICAL | 🔴 红 | API已被移除，代码将无法编译/运行 |
| HIGH | 🟡 黄 | 函数签名变更，需要更新调用方式 |
| MEDIUM | 🔵 蓝 | API已废弃或行为变更，建议迁移 |
| LOW | 🟢 绿 | 使用了依赖但不涉及已知破坏性变更 |

## 测试建议优先级

| 优先级 | 说明 |
|--------|------|
| P0 | 紧急 - 涉及被移除API的测试 |
| P1 | 高 - 签名变更的API调用测试 |
| P2 | 中 - 废弃API和行为变更测试 |
| P3 | 低 - 完整回归测试套件 |

## 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
python -m pytest
```

## 项目结构

```
src/dep_break_scanner/
├── __init__.py      # 版本信息
├── models.py        # 数据模型定义
├── scanner.py       # 依赖引用扫描器
├── version_diff.py  # 版本差异分析
├── impact_analyzer.py # 影响分组分析
├── reporter.py      # 报告生成器
└── cli.py           # CLI入口
```

## License

MIT
