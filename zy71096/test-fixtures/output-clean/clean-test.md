# Pip 依赖哈希校验报告

**生成时间**: 2026-05-24T21:27:42.613358

## 整体状态 ✅

- **退出码**: `0`
- **说明**: 所有检查通过，未发现问题

## 输入文件

- `requirements`: `/Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/clean/requirements.txt`
- `constraints`: `/Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/clean/constraints.txt`

## 统计汇总

- 包数量: **4**
- 依赖项: **4**
- 哈希校验通过率: **4/4** (100.0%)

## 哈希校验详情

| 包名 | 版本 | 状态 | 详情 |
|------|------|------|------|
| click | 8.1.7 | ✅ 通过 | - |
| packaging | 24.0 | ✅ 通过 | - |
| jinja2 | 3.1.3 | ✅ 通过 | - |
| markupsafe | 2.1.5 | ✅ 通过 | - |

## 包源归因

| 包名 | 版本 | 主要来源 | 置信度 | Wheelhouse 路径 |
|------|------|----------|--------|-----------------|
| click | 8.1.7 | requirements_file | 50% | - |
| packaging | 24.0 | requirements_file | 50% | - |
| jinja2 | 3.1.3 | requirements_file | 50% | - |
| markupsafe | 2.1.5 | constraints_file | 50% | - |

## 退出码说明

| 退出码 | 含义 |
|--------|------|
| `0` | 所有检查通过，未发现问题 ← 当前 |
| `1` | 输入参数错误或文件读取失败  |
| `2` | 发现哈希值不匹配  |
| `3` | 缺少必需的包或哈希值  |
| `4` | 依赖约束存在冲突  |
| `5` | 包来源不匹配预期  |
| `10` | 发生未知错误  |
