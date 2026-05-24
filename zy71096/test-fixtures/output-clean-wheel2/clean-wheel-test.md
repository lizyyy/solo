# Pip 依赖哈希校验报告

**生成时间**: 2026-05-24T23:32:05.652437

## 整体状态 ❌

- **退出码**: `3`
- **说明**: 缺少必需的包或哈希值

## 输入文件

- `requirements`: `/Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/clean/requirements.txt`
- `wheelhouse`: `/Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/wheelhouse`

## 统计汇总

- 包数量: **3**
- 依赖项: **3**
- 哈希校验通过率: **2/2** (100.0%)

## 哈希校验详情

| 包名 | 版本 | 状态 | 详情 |
|------|------|------|------|
| click | 8.1.7 | ✅ 通过 | - |
| packaging | 24.0 | ✅ 通过 | - |

## 包源归因

| 包名 | 版本 | 主要来源 | 置信度 | Wheelhouse 路径 |
|------|------|----------|--------|-----------------|
| click | 8.1.7 | wheelhouse | 90% | /Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/wheelhouse/click-8.1.7-py3-none-any.whl |
| packaging | 24.0 | wheelhouse | 90% | /Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/wheelhouse/packaging-24.0-py3-none-any.whl |

## ❌ 缺失的包

| 包名 | 版本要求 |
|------|----------|
| jinja2 | ==3.1.3 |

## 退出码说明

| 退出码 | 含义 |
|--------|------|
| `0` | 所有检查通过，未发现问题  |
| `1` | 输入参数错误或文件读取失败  |
| `2` | 发现哈希值不匹配  |
| `3` | 缺少必需的包或哈希值 ← 当前 |
| `4` | 依赖约束存在冲突  |
| `5` | 包来源不匹配预期  |
| `10` | 发生未知错误  |
