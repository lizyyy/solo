# 门店品控管理系统

一个完整的后端服务，用于门店菜品留样、冰箱温度监控、废弃记录管理，支持追溯和抽检。

## 功能特性

- **菜品留样管理**: 留样登记、查询、销毁、过期自动隔离
- **温度监控**: 冰箱温度记录、异常检测、间隔检查
- **废弃管理**: 废弃记录登记、批次追踪
- **业务规则引擎**: 自动执行留样过期、温度异常、间隔检查等规则
- **提醒系统**: 到期提醒、异常提醒
- **报表导出**: 日报表、批次汇总、CSV导出
- **敏感字段脱敏**: 手机号、身份证等自动脱敏
- **幂等性保证**: 防止重复提交

## 技术栈

- 语言: Go 1.21+
- 框架: Gin
- 数据库: SQLite
- 配置: YAML

## 项目结构

```
quality-control-system/
├── cmd/server/           # 主程序入口
├── internal/
│   ├── config/          # 配置管理
│   ├── model/           # 数据模型
│   ├── repository/      # 数据访问层
│   ├── service/         # 业务逻辑层
│   ├── handler/         # API处理层
│   └── middleware/      # 中间件
├── pkg/
│   └── utils/           # 工具函数
├── docs/                # 文档
├── scripts/             # 脚本
├── config.yaml          # 配置文件
└── go.mod               # 依赖管理
```

## 快速开始

### 1. 安装依赖

```bash
cd quality-control-system
go mod download
```

### 2. 配置

编辑 `config.yaml`:

```yaml
server:
  port: 8080
  mode: debug

database:
  driver: sqlite3
  dsn: ./qc_system.db

rules:
  sample_retention_hours: 48
  min_temperature: 0
  max_temperature: 8
  temperature_check_interval_minutes: 60
```

### 3. 运行

```bash
go run cmd/server/main.go
```

服务将在 `http://localhost:8080` 启动

## API 文档

详细API文档请查看 [docs/API.md](docs/API.md)

### 主要接口

- `POST /api/v1/samples` - 创建留样记录
- `GET /api/v1/samples` - 查询留样列表
- `POST /api/v1/temperature` - 创建温度记录
- `POST /api/v1/waste` - 创建废弃记录
- `GET /api/v1/reports/daily` - 获取日报表
- `GET /api/v1/reports/batch/:dish_batch` - 获取批次汇总

## 业务规则

### 留样规则
- 留样保留时间：48小时（可配置）
- 过期自动隔离
- 销毁需记录操作人及原因

### 温度规则
- 正常范围：0-8°C（可配置）
- 建议检测间隔：60分钟
- 异常自动记录并提醒

### 敏感字段
- 手机号：中间4位脱敏
- 身份证：中间8位脱敏
- 脱敏在服务端统一处理

## 数据安全

- 所有敏感字段在返回、导出、日志中统一脱敏
- 操作日志完整记录所有变更
- 规则执行日志可追溯每条数据的处理原因

## 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| server.port | 服务端口 | 8080 |
| rules.sample_retention_hours | 留样保留时间(小时) | 48 |
| rules.min_temperature | 最低正常温度 | 0 |
| rules.max_temperature | 最高正常温度 | 8 |
| rules.temperature_check_interval_minutes | 温度检测间隔 | 60 |
| export.output_dir | 导出文件目录 | ./exports |

## 预置门店数据

系统默认预置以下门店：
- ST001: 中关村店
- ST002: 国贸店
- ST003: 望京店

可根据实际需求修改 `scripts/init_db.sql` 中的门店数据。
