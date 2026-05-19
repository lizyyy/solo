# 开发门户样例保鲜运行检查排查CLI

一个用于检查开发门户中代码样例时效性和正确性的命令行工具。

## 功能特性

- **样例运行检查**: 自动检测代码样例是否能正常运行
- **版本匹配校验**: 检查样例API版本与当前版本是否一致
- **失败智能归因**: 自动分类失败原因（版本不匹配、API变更、数据错误等）
- **修复状态追踪**: 记录样例修复历史和状态
- **报告导出**: 支持机器可读(JSON)和人类友好两种报告格式

## 快速开始

### 1. 安装依赖

```bash
pip3 install click pydantic python-dateutil rich
```

### 2. 初始化测试样例

```bash
python3 init_samples.py
```

将创建6个测试样例，覆盖各种场景：
- S001: 正常用户查询（正常输入）
- S002: 脏数据测试（包含非法字符）
- S003: 边界冲突测试（请求频率超限）
- S004: 空结果查询（无数据返回）
- S005: 版本不匹配样例（API版本已升级）
- S006: API字段变更样例（接口字段已修改）

### 3. 常用命令

#### 检查所有样例

```bash
python3 main.py check --all
```

#### 检查单个样例

```bash
python3 main.py check S001
```

#### 列出所有样例

```bash
python3 main.py sample-list
```

#### 查看运行历史

```bash
python3 main.py history
python3 main.py history S001
```

#### 记录修复

```bash
python3 main.py fix S005 "更新API版本从1.0.0到2.0.0" -f "张三" -n "已同步到最新文档"
```

#### 生成保鲜报告

```bash
# 人类可读格式
python3 main.py report --human

# JSON格式（机器可读）
python3 main.py report -o report.json
```

## 项目结构

```
sample_freshness_cli/
├── cli/
│   ├── __init__.py
│   └── commands.py          # CLI命令定义
├── core/
│   ├── __init__.py
│   ├── models.py            # 数据模型定义
│   ├── storage.py           # 存储管理
│   ├── checker.py           # 样例检查引擎
│   └── report_generator.py  # 报告生成器
├── data/                    # 数据存储目录
│   ├── samples.json
│   ├── run_results.json
│   └── fix_records.json
├── reports/                 # 报告输出目录
├── main.py                  # 程序入口
├── init_samples.py          # 样例初始化脚本
└── requirements.txt         # 依赖列表
```

## 失败分类

| 分类 | 说明 |
|------|------|
| version_mismatch | API版本不匹配 |
| api_changed | 接口字段或参数已变更 |
| invalid_data | 输入数据格式错误 |
| timeout | 请求超时 |
| auth_error | 认证失败 |
| unknown | 未知错误 |

## 验收说明

### 正常样例 (应该通过)
- **S001**: 正常用户查询 - 输入输出匹配，版本正确 ✓
- **S003**: 边界冲突测试 - 返回预期错误信息 ✓
- **S004**: 空结果查询 - 返回空列表 ✓

### 异常样例 (应该失败并正确归因)
- **S002**: 脏数据测试 - 归类为 `api_changed`，提示参数格式错误 ✗
- **S005**: 版本不匹配 - 归类为 `version_mismatch` ✗
- **S006**: API变更 - 归类为 `api_changed` ✗

### 一致性验证
1. 运行历史中的失败原因与报告中的详情一致
2. 修复记录正确关联到对应样例和运行记录
3. JSON报告与人类可读报告数据一致
