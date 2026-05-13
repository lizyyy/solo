# 叉车充电排班系统

## 项目简介

这是一个全栈Web应用，用于管理叉车电池充电排班业务。主要功能包括：

- **异常看板**: 日常处理充电桩故障、电池健康异常、低电量报警等
- **任务管理**: 创建、分配、开始、完成、取消充电任务
- **批量导入**: 支持Excel批量导入电池和作业波次数据
- **历史报表**: 列表筛选、导出复盘，支持按责任人和处理时间筛选
- **变更历史**: 记录电池健康、充电桩占用、作业波次的修改前后值

## 技术栈

- **前端**: Vue 3 + Vite + Element Plus + Pinia + ECharts
- **后端**: Spring Boot 2.7 + MyBatis-Plus
- **数据库**: MySQL 8.0+

## 目录结构

```
forklift-charging-scheduling/
├── backend/           # Spring Boot后端
├── frontend/          # Vue3前端
├── schema.sql         # 数据库表结构
├── demo_data.sql      # 演示数据
└── README.md
```

## 快速开始

### 1. 数据库准备

确保已安装MySQL 8.0+

```bash
# 登录MySQL
mysql -u root -p

# 执行表结构初始化
source /path/to/schema.sql

# 执行演示数据初始化
source /path/to/demo_data.sql
```

或者在MySQL客户端中依次执行这两个SQL文件。

**数据库配置** (backend/src/main/resources/application.yml):
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/forklift_charging?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai
    username: root
    password: your_password  # 修改为你的MySQL密码
```

### 2. 启动后端

```bash
cd backend

# 编译项目
mvn clean package -DskipTests

# 运行
mvn spring-boot:run

# 或者运行打包后的jar
java -jar target/forklift-charging-0.0.1-SNAPSHOT.jar
```

后端服务将在 `http://localhost:8080` 启动

### 3. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

### 4. 访问系统

打开浏览器访问: `http://localhost:3000`

## 功能模块

### 1. 异常看板 (Dashboard)
- 统计卡片: 待处理异常、紧急任务、故障充电桩、低电量电池
- 待处理异常列表
- 紧急充电任务列表
- 充电桩状态面板
- 电量预测汇总

### 2. 任务管理 (Tasks)
- 任务列表筛选（状态、优先级）
- 创建充电任务（校验作业波次）
- 分配充电桩
- 开始/完成/取消充电
- 调整优先级（人工调整留痕）
- 查看变更历史

### 3. 充电桩管理 (Stations)
- 卡片式展示充电桩状态
- 标记故障（自动创建异常记录）
- 查看/编辑充电桩信息

### 4. 电池管理 (Batteries)
- 电池列表（电量、健康状态）
- 更新健康状态（记录变更历史）
- 更新当前电量

### 5. 作业波次 (Waves)
- 波次列表与筛选
- 新增/编辑波次
- 开始/完成波次状态流转
- 查看关联任务和变更历史

### 6. 异常处理 (Anomalies)
- 异常列表筛选（状态、类型）
- 异常详情查看
- 分配处理人
- 处理异常并填写备注

### 7. 批量导入 (Import)
- 导入电池数据（Excel）
- 导入作业波次（Excel）
- 查看导入历史和错误日志

### 8. 历史报表 (Reports)
- 任务记录和异常记录
- 筛选条件: 责任人、处理人、时间范围
- 导出Excel报告

### 9. 变更历史 (History)
- 所有实体的变更记录
- 清晰展示 oldValue → newValue
- 按实体类型、操作人、时间段筛选

## 核心业务规则

### 1. 作业波次校验
创建任务时自动校验关联波次的有效性：
- 波次必须存在
- 波次状态必须是 PLANNED 或 ACTIVE
- 当前时间不能晚于波次结束时间

### 2. 故障桩位异常处理
充电桩标记为故障时：
- 自动创建 STATION_FAULT 类型异常
- 优先级设为 HIGH
- 记录到 change_history

### 3. 电量预测汇总
Dashboard 实时计算：
- 当前总功率需求
- 预计完成时间
- 分充电桩充电详情

### 4. 人工调整留痕
所有手动修改都会记录到 `change_history` 表：
- entity_type: 实体类型
- entity_id: 实体ID
- field_name: 变更字段
- old_value: 修改前值
- new_value: 修改后值
- operation: 操作类型（MANUAL表示人工调整）
- operator: 操作人
- remarks: 备注说明

### 5. 导出报告筛选
支持多维度筛选：
- `assignedOperator`: 责任人
- `handledBy`: 处理人
- `startTime`: 开始时间
- `endTime`: 结束时间

## 演示数据说明

执行 `demo_data.sql` 后将包含：

| 表名 | 数量 | 说明 |
|------|------|------|
| charging_stations | 8 | 8个充电桩（含1个故障） |
| batteries | 10 | 10块电池（含需更换和预警） |
| work_waves | 8 | 8个作业波次（含历史完成/取消） |
| charging_tasks | 10 | 10个任务（含各状态） |
| anomaly_records | 7 | 7条异常（含待处理和已处理） |
| change_history | 28 | 28条变更历史（含old/new值） |
| import_batches | 4 | 4条导入批次记录 |
| operation_logs | 15 | 15条操作日志 |

## 典型操作流程

### 日常值班流程
1. 打开「异常看板」查看待处理异常
2. 点击「异常处理」进入异常页面
3. 查看异常详情，分配处理人或直接处理
4. 查看「紧急任务」，优先处理高优先级任务
5. 在「任务管理」分配充电桩并开始充电

### 创建充电任务
1. 进入「任务管理」页面
2. 点击「新建任务」
3. 选择电池、目标电量、作业波次
4. 填写责任人，确认创建
5. 系统自动校验波次有效性

### 复盘导出
1. 进入「历史报表」页面
2. 设置筛选条件（责任人、时间范围等）
3. 点击「查询」查看结果
4. 点击「导出报告」下载Excel

## API 接口概览

### 看板
- `GET /api/dashboard/stats` - 看板统计
- `GET /api/dashboard/power-forecast` - 电量预测

### 任务
- `GET /api/tasks` - 任务列表
- `POST /api/tasks` - 创建任务
- `POST /api/tasks/{id}/assign` - 分配充电桩
- `POST /api/tasks/{id}/start` - 开始充电
- `POST /api/tasks/{id}/complete` - 完成充电
- `POST /api/tasks/{id}/cancel` - 取消任务
- `POST /api/tasks/{id}/priority` - 调整优先级

### 异常
- `GET /api/anomalies` - 异常列表
- `GET /api/anomalies/pending` - 待处理异常
- `POST /api/anomalies/{id}/assign` - 分配异常
- `POST /api/anomalies/{id}/handle` - 处理异常

### 报表
- `GET /api/reports/charge-history` - 充电历史
- `GET /api/reports/export` - 导出报告
- `GET /api/reports/import-history` - 导入历史

### 变更历史
- `GET /api/history` - 全部变更历史
- `GET /api/history/{entityType}` - 按类型查询
- `GET /api/history/{entityType}/{entityId}` - 按实体查询

## 注意事项

1. **数据库持久化**: 使用MySQL存储，重启后数据不会丢失
2. **变更留痕**: 所有关键修改都会记录oldValue和newValue
3. **请求头**: 前端会自动携带 `X-Operator` 请求头，后端用于记录操作人
4. **时间格式**: 使用 ISO 8601 格式 (YYYY-MM-DDTHH:mm:ss)
