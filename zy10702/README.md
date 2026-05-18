# 设备升级日志固件失败分桶 CLI

按型号和阶段对设备升级失败日志进行分桶分析的命令行工具。

## 功能特性

- ✅ **配置化分桶规则**：无需修改源码，通过配置文件调整分桶维度
- ✅ **多格式支持**：支持 JSON 和 CSV 格式的日志输入
- ✅ **异常检测**：自动检测设备离线、版本号缺段、重复上报
- ✅ **灵活输出**：支持人类可读格式和机器可读 JSON 格式
- ✅ **diff友好**：规则变更后，输出变化可通过 diff 清晰查看

## 文件说明

| 文件 | 用途 |
|------|------|
| `firmware_failure_bucket.py` | 主CLI程序 |
| `config.json` | 默认配置文件（按型号+阶段分桶） |
| `config_v2.json` | 备选配置文件（仅按型号分桶） |
| `samples/firmware_logs_normal.json` | 正常场景样例日志 |
| `samples/firmware_logs_with_anomalies.json` | 含异常场景样例日志 |
| `samples/firmware_logs.csv` | CSV格式样例日志 |
| `test_firmware_bucket.py` | 自动化测试脚本 |
| `expected_outputs/` | 期望输出目录 |

## 快速开始

### 基本用法

```bash
# 使用默认配置分析日志
python3 firmware_failure_bucket.py -i samples/firmware_logs_normal.json

# 指定配置文件
python3 firmware_failure_bucket.py -i samples/firmware_logs_normal.json -c config_v2.json

# 输出到文件
python3 firmware_failure_bucket.py -i samples/firmware_logs_normal.json -o result.txt

# JSON格式输出
python3 firmware_failure_bucket.py -i samples/firmware_logs_normal.json -f json

# 显示完整日志详情
python3 firmware_failure_bucket.py -i samples/firmware_logs_normal.json --show-logs
```

### 配置说明

`config.json` 配置项：

```json
{
  "bucket_by": ["model", "stage"],      // 分桶维度，可任意组合
  "failure_statuses": ["fail", "failure", "failed", "error"],  // 失败状态定义
  "description": "配置说明"
}
```

**常用分桶维度组合：**
- `["model", "stage"]` - 按型号+阶段（默认）
- `["model"]` - 仅按型号
- `["stage"]` - 仅按阶段
- `["model", "firmware_version"]` - 按型号+版本

## 样例运行

### 正常路径

```bash
python3 firmware_failure_bucket.py -i samples/firmware_logs_normal.json
```

**输出包含：**
- 总失败数
- 分桶数量
- 各分桶详情（按型号+阶段）
- 设备离线数、版本缺段数、重复上报数

### 异常路径

```bash
python3 firmware_failure_bucket.py -i samples/firmware_logs_with_anomalies.json
```

**输出包含：**
- 设备离线统计
- 版本号缺段统计（如 "2.3"、"2"、空字符串）
- 重复上报统计（相同设备+时间+版本+阶段）

### 配置变更对比

演示配置变更前后的差异：

```bash
# 使用v1配置
python3 firmware_failure_bucket.py -i samples/firmware_logs_with_anomalies.json -c config.json -o output_v1.txt

# 使用v2配置
python3 firmware_failure_bucket.py -i samples/firmware_logs_with_anomalies.json -c config_v2.json -o output_v2.txt

# 查看差异
diff output_v1.txt output_v2.txt
```

## 自动化测试

运行完整测试套件：

```bash
python3 test_firmware_bucket.py -v
```

测试覆盖：
- 正常日志分桶
- 异常场景检测（离线、缺版本、重复）
- CSV格式支持
- 配置变更影响
- 边界情况处理

## 日志字段说明

工具识别的关键字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| `device_id` | 设备唯一标识 | DEV001 |
| `model` | 设备型号 | SmartCam-X1 |
| `stage` | 升级阶段 | download/install/verify/reboot |
| `firmware_version` | 固件版本号 | 2.3.5 |
| `status` | 升级状态 | fail/success/error |
| `error_message` | 错误详情 | 网络超时 |
| `timestamp` | 时间戳 | 2024-01-15T10:30:00Z |
| `is_offline` | 是否离线 | true/false |

## 常见问题

**Q: 如何添加新的分桶维度？**

A: 修改 `config.json` 中的 `bucket_by` 数组，添加日志中存在的字段名即可。

**Q: 如何判断版本号缺段？**

A: 版本号分段少于3段（如 "1.0"、"2"）或为空时，标记为缺段。

**Q: 如何判断重复上报？**

A: 相同 device_id + timestamp + firmware_version + stage 视为重复上报。
