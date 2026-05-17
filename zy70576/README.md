# Envoy 路由模拟工具

上线前验证 Envoy 路由规则的命令行工具，快速判断请求最终命中哪个 cluster。

## 功能特性

- ✅ **配置解析**: 支持 Envoy YAML/JSON 配置文件解析
- 🎯 **条件匹配**: 支持前缀匹配、精确匹配、正则匹配、Header条件匹配
  - `exact_match`: Header精确值匹配
  - `regex_match`: Header正则匹配
  - `prefix_match`: Header前缀匹配
  - `present_match`: 仅检查Header是否存在
- 📊 **优先级解释**: 按路由定义顺序匹配，显示匹配原因
- ❌ **未命中样本**: 明确标记未匹配路由的请求
- 📋 **多格式报告**: 终端彩色摘要、JSON机器可读、HTML详细报告
- 🐛 **错误处理**: 保留坏行原始位置和原因，优雅处理异常

## 安装

```bash
pip install pyyaml jinja2 rich
```

## 使用方法

### CLI 用法
```bash
python -m envoy_route_simulator.cli -c examples/config/envoy.yaml -r examples/requests/test.jsonl
```

参数说明:
- `-c, --config`: Envoy 配置文件路径 (YAML/JSON)
- `-r, --requests`: 请求样本文件 (JSONL格式)
- `-o, --output`: 报告输出目录 (默认: ./reports)

### 完整运行示例
```bash
# 1. 安装依赖
pip install pyyaml jinja2 rich

# 2. 使用示例配置运行
python -m envoy_route_simulator.cli \
  -c examples/config/envoy.yaml \
  -r examples/requests/test.jsonl \
  -o ./reports
```

### 请求样本格式
每行一个JSON对象:
```json
{"path": "/api/v1/users/profile", "headers": {"host": "api.internal.example.com", "x-service-version": "v1"}}
{"path": "/health", "headers": {"host": "any.example.com"}}
{"path": "/index.html", "headers": {"host": "www.example.com"}}
```

## 目录结构

```
.
├── envoy_route_simulator/    # 核心代码
│   ├── __init__.py
│   └── cli.py               # 主入口
├── examples/                # 示例目录
│   ├── config/
│   └── requests/
├── reports/                # 报告输出
├── requirements.txt        # 依赖
└── setup.py              # 包配置
```

## 输出说明

### 终端输出
- 匹配摘要统计（总计/匹配/未匹配/无效）
- 请求匹配详情表格（彩色）

### 报告文件
- `reports/report_YYYYMMDD_HHMMSS.json`: 机器可读结果
- `reports/report_YYYYMMDD_HHMMSS.html`: 可视化HTML报告（适合分享）

## 坏数据处理

- 无效JSON行 → 标记为"无效"，保留行号和错误信息
- 配置解析警告 → 显示警告，继续执行
- 匹配异常 → 记录错误，不中断流程

## 测试运行

使用Python直接测试:
```python
from envoy_route_simulator.cli import parse_envoy_config, load_requests, match_request
# 加载配置和请求，运行匹配...
```
