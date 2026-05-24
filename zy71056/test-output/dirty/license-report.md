# NPM 工作区许可证清单报告

> 生成时间: 2026-05-24T11:12:06.197Z
> CLI 版本: 1.0.0

## 📊 概览

| 指标 | 数值 |
|------|------|
| 总包数 | 6 |
| 工作区包 | 1 |
| 外部依赖 | 5 |
| 私有包 | 0 |
| 有许可证 | 5 |
| 缺失许可证 | 1 |
| 双许可证 | 1 |
| 违规项 | 2 |
| 例外项 | 0 |

## 🚪 执行结果

- **退出码**: `1`
- **说明**: 发现许可证违规，需审查

## ⚠️  违规项

| 包名 | 版本 | 类型 | 许可证 | 严重程度 | 说明 |
|------|------|------|--------|----------|------|
| some-gpl-lib | 1.0.0 | unallowed_license | GPL-3.0 | error | 许可证 GPL-3.0 不在允许列表中 |
| no-license-pkg | 3.0.0 | missing_license | - | warning | 缺失许可证信息 |

## 📦 工作区包

| 包名 | 版本 | 许可证 | 私有 | 路径 |
|------|------|--------|------|------|
| @dirty/public-pkg | 1.0.0 | `Apache-2.0` |  | `/Users/lzy/pro/solo/workspaces/zy71056/test-fixtures/dirty-project/packages/public-pkg` |

## 📚 外部依赖许可证清单

### (MIT OR Apache-2.0) (1)

- `dual-license-pkg@2.0.0`

### GPL-3.0 (1)

- `some-gpl-lib@1.0.0`

### MIT (2)

- `chalk@4.1.2`
- `ansi-styles@4.3.0`

### UNKNOWN (1)

- `no-license-pkg@3.0.0`

### ❓ 缺失许可证文件

- `no-license-pkg@3.0.0`

