# 服务目录孤儿条目存活证据排查CLI

用于检测服务目录中失效的孤儿条目，检查仓库和告警规则的存活证据。

## 功能特性

- **目录解析**: 支持 YAML/CSV 格式的服务目录
- **仓库探测**: 检查本地 Git 仓库的活跃度，识别远程仓库
- **告警引用检查**: 验证 Prometheus 告警规则是否存在
- **负责人归并**: 支持负责人别名映射，来源追踪
- **报告导出**: JSON/Excel/Text 三种格式，稳定排序
- **坏行保留**: 无效条目保留原始文件位置和内容

## 安装

```bash
pip install -e .
```

## 使用方法

### 基本检查

```bash
orphan-checker check examples/service_catalog.yaml
```

### 带告警规则检查

```bash
orphan-checker check examples/service_catalog.yaml \
  --alert-dir examples/alerts \
  --output-dir reports
```

### 带本地仓库检查

```bash
orphan-checker check examples/service_catalog.yaml \
  --repo-base-path /path/to/repos \
  --alert-dir examples/alerts
```

### 仅解析目录

```bash
orphan-checker parse examples/service_catalog.yaml
```

## 服务目录格式

### YAML 格式

```yaml
- service_name: "user-service"
  repository: "https://github.com/example/user-service"
  owners:
    - "zhangsan@example.com"
    - "lisi"
  alert_rules:
    - "UserServiceHighErrorRate"
    - "UserServiceHighLatency"
```

### CSV 格式

```csv
service_name,repository,owners,alert_rules
user-service,https://...,zhangsan,lisi,Rule1,Rule2
```

## 孤儿判定规则

满足以下任一条件即判定为孤儿：
1. 本地仓库不存在或超过365天无提交
2. 未配置仓库地址
3. 配置的告警规则不存在
4. 既无有效仓库也无有效告警规则

## 输出报告

报告生成在指定的输出目录，包含：
- `orphan_report.json`: 完整的 JSON 格式报告
- `orphan_report.xlsx`: Excel 格式报告（含多个工作表）
- `orphan_report.txt`: 纯文本格式报告

## 退出码

- `0`: 检查完成，未发现孤儿服务
- `1`: 发现孤儿服务需要处理
- `2`: 检查执行失败（已知错误）
- `3`: 未预期的错误
