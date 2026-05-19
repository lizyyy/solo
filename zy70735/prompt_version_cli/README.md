# 模型提示版本实验流量命中摘要排查CLI

一个用于管理大模型提示词版本、流量分配和命中追踪的命令行工具。

## 功能特性

- **版本发布管理**: 发布和管理提示词的不同版本
- **流量实验分配**: 为不同版本分配实验流量百分比
- **命中记录追踪**: 记录每个请求命中的版本
- **回滚幂等支持**: 安全的版本回滚机制，幂等执行
- **双格式报告**: 同时生成人类可读报告和机器可读报告
- **一致性验证**: 确保两种格式的报告数据一致性

## 安装

```bash
cd prompt_version_cli
pip install -e .
```

或直接使用模块运行：

```bash
python -m prompt_cli.main --help
```

## 快速开始

### 1. 发布版本

```bash
prompt-cli publish customer_service v1 examples/normal_v1.txt --publisher alice --description "初始版本"
```

### 2. 分配流量

```bash
prompt-cli traffic customer_service '{"v1": 70, "v2": 30}' --operator admin
```

### 3. 记录命中

```bash
prompt-cli hit req_001 customer_service v1 --content "用户的问题"
```

### 4. 生成摘要报告

```bash
# 人类可读格式
prompt-cli summary customer_service --format human

# 机器可读格式
prompt-cli summary customer_service --format machine

# 两种格式同时生成并验证一致性
prompt-cli summary customer_service --format both --output reports/summary
```

### 5. 版本回滚

```bash
prompt-cli rollback customer_service v2 v1 --operator admin --reason "效果不佳，回滚"
```

## 完整命令参考

| 命令 | 功能 | 参数说明 |
|------|------|----------|
| `publish` | 发布新版本 | TEMPLATE_NAME VERSION_ID CONTENT_FILE --publisher PUBLISHER [--description DESC] |
| `traffic` | 分配流量 | TEMPLATE_NAME ALLOCATIONS_JSON --operator OPERATOR |
| `hit` | 记录命中 | REQUEST_ID TEMPLATE_NAME VERSION_ID [--content CONTENT] |
| `rollback` | 回滚版本 | TEMPLATE_NAME FROM_VERSION TO_VERSION --operator OPERATOR [--reason REASON] |
| `summary` | 生成摘要 | TEMPLATE_NAME [--format human/machine/both] [--output PATH] |
| `verify` | 验证版本内容 | TEMPLATE_NAME VERSION_ID CONTENT_FILE |
| `list-versions` | 列出版本 | TEMPLATE_NAME |
| `list-templates` | 列出所有模板 | (无参数) |

## 运行演示

项目包含完整的演示脚本，覆盖所有场景：

```bash
python examples/demo_script.py
```

演示包含以下场景：
1. ✅ 正常输入场景 - 版本发布、流量分配、命中记录
2. ⚠️  边界冲突场景 - 重复发布、流量总和错误、分配不存在版本
3. 🔄 回滚幂等场景 - 重复执行相同回滚操作
4. 🧹 脏数据场景 - 不完整数据发布、不存在版本命中
5. 📭 空结果场景 - 查询不存在的模板
6. 📊 报告生成场景 - 双格式报告输出与一致性验证
7. 🔍 内容验证场景 - 版本内容哈希校验

## 验收标准

### 机器可读输出
- JSON格式，包含完整的版本、流量、命中和回滚数据
- 可直接被其他系统解析和处理
- 文件扩展名: `.json`

### 人类可读报告
- 格式化表格展示
- 清晰的统计摘要
- 易于阅读和排查
- 文件扩展名: `.txt`

### 一致性验证
两种格式的报告必须包含一致的数据，系统会自动验证：
- 模板名称
- 总版本数
- 总命中数
- 总回滚数
- 所有版本ID的存在性

## 项目结构

```
prompt_version_cli/
├── prompt_cli/
│   ├── __init__.py      # 包初始化
│   ├── models.py        # 数据模型
│   ├── storage.py       # 存储管理
│   ├── service.py       # 业务逻辑
│   ├── report.py        # 报告生成
│   └── main.py          # CLI入口
├── examples/
│   ├── normal_v1.txt    # 正常样例v1
│   ├── normal_v2.txt    # 正常样例v2
│   ├── dirty_data.txt   # 脏数据样例
│   └── demo_script.py   # 演示脚本
├── setup.py             # 安装配置
├── requirements.txt     # 依赖列表
└── README.md            # 本文档
```

## 数据存储

所有数据存储在当前目录下的 `.prompt_version_data/` 目录中：

```
.prompt_version_data/
└── templates/
    └── {template_name}/
        ├── version_{version_id}.json
        ├── traffic_history.json
        ├── hit_records.json
        └── rollback_events.json
```

## 核心规则实现

1. **版本发布**: 版本ID唯一，内容不能为空，发布人必填
2. **流量分配**: 总和必须为100%，版本必须存在，权重不能为负
3. **命中记录**: 版本必须存在，自动生成请求哈希
4. **回滚幂等**: 相同from/to/reason的回滚只执行一次，自动调整流量
5. **摘要导出**: 双格式输出，自动一致性验证
