# 校车调度责任判定系统

## 项目概述

本系统旨在解决校车调度中家长申诉、GPS轨迹和司机打卡三者数据不一致的问题，通过自动化匹配和裁定，快速确定迟到责任，提高调度效率。

## 主要功能

### 1. 数据导入
- **站点时刻表CSV导入**：导入校车线路和站点计划
- **GPS轨迹JSON导入**：导入车辆实时GPS定位数据
- **家长申诉单CSV导入**：导入家长申诉记录

### 2. 数据匹配
- 自动将申诉与对应GPS、打卡记录进行匹配
- 计算时间差异和距离差异
- 给出匹配置信度

### 3. 责任裁定
- 基于规则的自动裁定
- 支持司机责任、交通原因等多种结果
- 提供详细的裁定理由

### 4. 人工复核
- 支持对裁定结果进行复核
- 可以确认或推翻原裁定
- 记录复核人和复核备注

### 5. 数据导出
- 导出裁定结果（CSV/JSON格式）
- 导出坏记录（包含失败原因和修改建议）
- 导出审计日志
- 生成单条裁定的详细报告

### 6. 敏感数据保护
- 后端层脱敏处理（非展示层）
- 基于用户角色的权限控制
- 姓名、手机号等敏感信息自动脱敏

### 7. 坏记录处理
- 坏记录不直接丢弃，全部保存
- 记录原始数据、失败原因
- 提供修改建议，便于人工修正

## 技术架构

- **语言**：TypeScript / Node.js
- **数据库**：SQLite（轻量嵌入式）
- **CLI框架**：Commander.js
- **CSV解析**：csv-parser
- **日志记录**：内置审计日志

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译项目

```bash
npm run build
```

### 查看系统状态

```bash
npm run dev -- status
# 或编译后
node dist/cli.js status
```

### 导入示例数据

```bash
# 导入站点时刻表
npm run dev -- import-schedule examples/schedule.csv

# 导入GPS轨迹
npm run dev -- import-gps examples/gps.json

# 导入申诉单
npm run dev -- import-complaint examples/complaints.csv
```

### 匹配申诉数据

```bash
# 匹配所有待处理申诉
npm run dev -- match --all

# 匹配指定申诉
npm run dev -- match --id 1
```

### 裁定申诉责任

```bash
# 裁定所有已匹配申诉
npm run dev -- adjudicate --all

# 裁定指定申诉
npm run dev -- adjudicate --id 1
```

### 查看裁定解释

```bash
npm run dev -- explain --id 1
```

### 复核裁定结果

```bash
npm run dev -- review --id 1 --status confirmed --reviewer 张调度 --notes "经核实情况属实"
```

### 导出数据

```bash
# 导出裁定结果
npm run dev -- export --type adjudications --output report.csv

# 导出坏记录
npm run dev -- export --type bad-records --output bad-records.csv

# 导出审计日志
npm run dev -- export --type audit-logs --output audit.csv

# 导出JSON格式
npm run dev -- export --type adjudications --format json --output report.json

# 包含敏感数据（需要admin权限）
npm run dev -- export --type adjudications --include-sensitive --output report.csv
```

### 生成裁定报告

```bash
npm run dev -- report --id 1 --output adjudication-report.txt
```

## 数据格式说明

### 站点时刻表CSV

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| routeId | string | 线路ID | ROUTE001 |
| stopId | string | 站点ID | STOP001 |
| stopName | string | 站点名称 | 东门站 |
| scheduledTime | string | 计划时间 | 2024-05-20 07:30:00 |
| latitude | number | 纬度 | 39.9042 |
| longitude | number | 经度 | 116.4074 |

### GPS轨迹JSON

```json
[
  {
    "deviceId": "GPS001",
    "driverId": "DRIVER001",
    "timestamp": "2024-05-20 07:30:00",
    "latitude": 39.9042,
    "longitude": 116.4074,
    "speed": 25,
    "accuracy": 5
  }
]
```

### 申诉单CSV

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| complaintId | string | 申诉单号 | COMP001 |
| parentName | string | 家长姓名 | 张三 |
| parentPhone | string | 家长电话 | 13800138000 |
| studentName | string | 学生姓名 | 张小明 |
| routeId | string | 线路ID | ROUTE001 |
| stopId | string | 站点ID | STOP001 |
| scheduledDate | string | 计划日期 | 2024-05-20 |
| scheduledTime | string | 计划时间 | 07:30:00 |
| complaintType | string | 申诉类型 | late/no_show/early/other |
| description | string | 申诉描述 | 校车迟到 |

## 裁定规则

系统根据以下因素进行责任判定：

1. **时间差异**：GPS记录与计划时间的差异
   - ≤5分钟：正常范围
   - 5-15分钟：轻微延迟
   - >15分钟：严重延迟
   - >30分钟：司机责任可能性高

2. **距离差异**：最近GPS点与站点的距离
   - ≤200米：正常到站
   - >200米：可能未到站

3. **打卡记录**：司机是否在站点打卡
   - 有打卡：降低司机责任
   - 无打卡：增加司机责任

4. **GPS记录数量**：站点附近是否有足够GPS点
   - ≥3个：数据可靠
   - <3个：数据不足

## 角色权限

| 角色 | 权限 | 敏感数据访问 |
|------|------|-------------|
| admin | 全部操作 | 可访问 |
| auditor | 复核、导出 | 可访问 |
| dispatcher | 常规操作 | 脱敏后 |
| viewer | 查看 | 脱敏后 |

## 数据库结构

- `stop_schedules`：站点时刻表
- `gps_records`：GPS轨迹记录
- `driver_checkins`：司机打卡记录
- `parent_complaints`：家长申诉记录
- `bad_records`：坏记录（包含失败原因）
- `match_records`：匹配结果
- `adjudications`：裁定记录
- `audit_logs`：操作审计日志

## 特点

1. **命令间共享历史**：使用SQLite存储，所有命令共享同一数据库
2. **幂等性**：重复导入/提交结果稳定（使用唯一约束）
3. **可追溯**：完整的审计日志，所有操作可追溯
4. **可解释**：每条裁定都有详细理由，便于向家长解释
5. **轻量**：无需单独数据库服务，SQLite嵌入式运行
