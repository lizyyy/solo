# 充电桩运维站充电告警聚类 CLI 样例目录

## 目录结构

```
charging-alert-cluster/
├── alert_cluster_cli.py    # CLI演示脚本
├── README.md               # 本说明文档
├── normal/                 # 正常文件目录
├── bad/                    # 坏文件目录
├── empty/                  # 空文件和边界情况目录
└── output/                 # 输出目录
```

## 文件用途汇总

### normal/ - 正常文件目录

| 文件名 | 格式 | 用途说明 |
|--------|------|----------|
| [station_a_alert_20260519.csv](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/normal/station_a_alert_20260519.csv) | CSV | 科技园A站充电桩告警数据，包含过流告警、过压告警、温度过高告警，以及恢复事件记录 |
| [station_b_storm_event.json](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/normal/station_b_storm_event.json) | JSON | 软件园B站通讯中断告警风暴事件，包含风暴时间、涉及充电桩、告警列表、恢复事件、可复跑标记和聚类结果 |
| [station_c_recovery_log.txt](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/normal/station_c_recovery_log.txt) | TXT | 商业中心C站绝缘故障告警聚类恢复日志，包含完整处理流程、恢复率统计和可复跑输出 |

### bad/ - 坏文件目录

| 文件名 | 格式 | 用途说明 |
|--------|------|----------|
| [station_d_malformed.csv](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/bad/station_d_malformed.csv) | CSV | 科技园D站格式错误CSV，包含：列数不足（第2行）、充电桩ID为空（第3行）、无效时间（第4行）、告警级别为空（第5行）、无效状态值（第6行）、列数多余（第7行） |
| [station_e_bad_json.json](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/bad/station_e_bad_json.json) | JSON | 物流园E站语法错误JSON，包含：缺少逗号（第4行）、数组末尾多余逗号（第9行）、对象间缺少逗号（第12行）、缺少结尾大括号 |
| [station_f_inconsistent.txt](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/bad/station_f_inconsistent.txt) | TXT | 居民区F站数据不一致日志，包含：告警风暴标记错误、恢复数量统计错误、可复跑标记错误、退出码错误 |

### empty/ - 空文件和边界情况目录

| 文件名 | 格式 | 用途说明 |
|--------|------|----------|
| [empty_alert.csv](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/empty/empty_alert.csv) | CSV | 完全空文件，无任何内容，测试空文件处理逻辑 |
| [header_only.csv](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/empty/header_only.csv) | CSV | 只有表头没有数据行，测试边界情况处理 |
| [no_recovery_event.json](file:///Users/mac/pro/solo/workspaces/xy11141/charging-alert-cluster/empty/no_recovery_event.json) | JSON | 有告警风暴但无恢复事件，测试部分成功场景（退出码1） |

## CLI脚本使用说明

### 运行方式

```bash
cd charging-alert-cluster
python3 alert_cluster_cli.py
```

### 退出码说明

| 退出码 | 含义 | 场景 |
|--------|------|------|
| 0 | 全部成功 | 所有文件处理成功，无错误 |
| 1 | 部分成功 | 存在告警风暴、恢复事件、可复跑输出需要确认，或部分文件有错误 |
| 2 | 全部失败 | 所有文件处理失败 |

### 异常摘要特性

异常摘要会包含以下信息，运营同事不用打开源码也能修数据：
- **来源文件**: 出错的文件名
- **行号**: 出错的具体行号
- **错误摘要**: 问题的简短描述

## 业务场景说明

本样例目录针对充电桩运维站充电告警聚类的典型业务场景：

1. **告警风暴**: 短时间内大量相同类型告警集中触发（如通讯中断、绝缘故障）
2. **恢复事件**: 批量告警自动或人工恢复的记录
3. **可复跑输出**: 支持重新运行聚类算法，便于核对和追溯

月底核对时，可通过本CLI工具统一处理分散在表格、截图和口头确认中的告警数据，避免核对不一致问题。