# Pip 依赖哈希校验报告

**生成时间**: 2026-05-24T23:50:28.652105

## 整体状态 ❌

- **退出码**: `4`
- **说明**: 依赖约束存在冲突

## 输入文件

- `requirements`: `/Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/dirty/requirements.txt`
- `constraints`: `/Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/dirty/constraints.txt`
- `wheelhouse`: `/Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/wheelhouse`

## 统计汇总

- 包数量: **5**
- 依赖项: **4**
- 哈希校验通过率: **1/3** (33.3%)

## 哈希校验详情

| 包名 | 版本 | 状态 | 详情 |
|------|------|------|------|
| click | 8.1.7 | ❌ 失败 | sha256 哈希不匹配: 期望 [0000000000000000000000000000000000000000000000000000000000000000, ca9853ad459e787e2192211578cc907e7594e294c7ccc834310722b41b9ca6d1], 实际 [ae74fb96c20a0277a1d615f1e4d73c8414f5a98db8b799a7931d1582f3390c28] |
| packaging | 24.0 | ❌ 失败 | sha256 哈希不匹配: 期望 [026ed72c8ed3fcce5bf8950572258698927fd1dbda10a5e981cdf0ac37f4f002], 实际 [2ddfb553fdf02fb784c234c7ba6ccc288296ceabec964ad2eae3777778130bc5] |
| jinja2 | 3.1.3 | ✅ 通过 | - |

## 包源归因

| 包名 | 版本 | 主要来源 | 置信度 | Wheelhouse 路径 |
|------|------|----------|--------|-----------------|
| click | 8.1.7 | wheelhouse | 90% | /Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/wheelhouse/click-8.1.7-py3-none-any.whl |
| packaging | 24.0 | wheelhouse | 90% | /Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/wheelhouse/packaging-24.0-py3-none-any.whl |
| jinja2 | 3.1.3 | wheelhouse | 90% | /Users/lzy/pro/solo/workspaces/zy71096/test-fixtures/wheelhouse/Jinja2-3.1.3-py3-none-any.whl |

## ⚠️ 约束冲突

| 包名 | Requirements | Constraints |
|------|--------------|-------------|
| packaging | `>=23.0` | `<22.0` |
| jinja2 | `==3.1.3` | `==3.0.0` |

## ⚠️ 缺失哈希的包

| 包名 | 版本要求 |
|------|----------|
| pyyaml |  |

## 退出码说明

| 退出码 | 含义 |
|--------|------|
| `0` | 所有检查通过，未发现问题  |
| `1` | 输入参数错误或文件读取失败  |
| `2` | 发现哈希值不匹配  |
| `3` | 缺少必需的包或哈希值  |
| `4` | 依赖约束存在冲突 ← 当前 |
| `5` | 包来源不匹配预期  |
| `10` | 发生未知错误  |
