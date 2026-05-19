# 校车调度迟到责任判定系统

## 功能特性

### 核心功能
- **接收数据**: 家长申诉、GPS轨迹、司机打卡
- **智能匹配**: 自动关联申诉与相关GPS、打卡数据
- **规则裁定**: 基于规则引擎自动判定迟到责任
- **人工复核**: 支持管理员对裁定结果进行复核
- **数据导出**: 支持JSON、CSV、Excel等格式导出

### 业务规则
- **跨站点迟到检测**: 同线路多站点迟到模式识别
- **GPS缺口检测**: 识别GPS数据缺失情况
- **重复申诉合并**: 自动检测并合并重复申诉
- **打卡异常检测**: 司机打卡时间异常检测

### 可靠性保证
- **幂等性处理**: 重复提交/导入结果稳定
- **审计日志**: 所有操作均有完整审计记录
- **批量操作**: 失败不影响已成功记录，支持重试

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 接收家长申诉
```bash
python cli.py receive_appeal \
    --parent_id P001 \
    --parent_name "张三爸爸" \
    --student_name "张三" \
    --bus_id BUS001 \
    --route_id R001 \
    --stop_name "阳光小区站" \
    --scheduled_time "2026-05-19T08:00:00" \
    --actual_arrival_time "2026-05-19T08:15:00" \
    --appeal_time "2026-05-19T08:20:00" \
    --description "校车今天迟到了15分钟" \
    --operator "调度员001"
```

### 2. 接收GPS轨迹
```bash
python cli.py receive_gps \
    --bus_id BUS001 \
    --route_id R001 \
    --date "2026-05-19" \
    --points_file test_data.json \
    --operator "系统"
```

### 3. 接收司机打卡
```bash
python cli.py receive_checkin \
    --driver_id D001 \
    --driver_name "李司机" \
    --bus_id BUS001 \
    --route_id R001 \
    --checkin_time "2026-05-19T07:00:00" \
    --location "停车场"
```

### 4. 匹配申诉
```bash
# 匹配单个申诉
python cli.py match --appeal_id appeal_xxx --operator "调度员001"

# 批量匹配所有待处理申诉
python cli.py match --operator "调度员001"
```

### 5. 裁定案例
```bash
# 裁定单个案例
python cli.py rule --case_id case_xxx --operator "调度员001"

# 批量裁定所有已匹配案例
python cli.py rule --operator "调度员001"
```

### 6. 复核裁定
```bash
python cli.py review \
    --case_id case_xxx \
    --uphold true \
    --reason "经核查，裁定准确无误" \
    --operator "管理员001"
```

### 7. 导出数据
```bash
# 导出申诉记录JSON
python cli.py export --type appeals_json --output output/appeals.json

# 导出裁定结果CSV
python cli.py export --type rulings_csv --output output/rulings.csv

# 导出完整Excel报表
python cli.py export --type excel --output output/full_report.xlsx

# 导出摘要报告
python cli.py export --type summary --output output/summary.json
```

### 8. 查看案例详情
```bash
python cli.py show_case --case_id case_xxx
```

### 9. 检查重复申诉
```bash
python cli.py merge_check
```

### 10. 查看审计日志
```bash
# 查看所有审计日志
python cli.py audit_log

# 查看特定申诉的审计日志
python cli.py audit_log --entity_type appeal --entity_id appeal_xxx
```

## 角色说明

系统支持以下角色:
- `dispatcher`: 调度员 - 日常操作
- `driver`: 司机 - 打卡操作
- `parent`: 家长 - 提交申诉
- `admin`: 管理员 - 复核裁定
- `auditor`: 审计员 - 查看日志

## 裁定结果说明

- `driver_fault`: 司机责任（迟到且无合理理由）
- `traffic_delay`: 交通延误（跨站点迟到且GPS有缺口）
- `gps_error`: GPS设备问题（GPS有缺口但非跨站点迟到）
- `no_fault`: 无责任（在允许误差范围内）
- `parent_mistake`: 家长误报

## 项目结构

```
bus_scheduler/
├── __init__.py
├── models.py      # 数据模型定义
├── storage.py     # 存储层（含幂等性处理）
├── rules.py       # 规则引擎
├── service.py     # 业务服务层
└── exporter.py    # 数据导出模块
cli.py             # 命令行接口
requirements.txt   # 依赖清单
```
