# 4S店销售主管车辆追踪系统

基于 Node.js + Express + SQLite 开发的后端服务，用于管理试驾车辆的借还记录、异常追踪和里程追溯。

## 功能特性

### 1. 批次管理
- 创建批次（自动生成批次号）
- 批次列表查询（支持按状态筛选）
- 批次详情查看
- 标记处理完成
- 退回修改（记录退回原因）

### 2. 数据导入
- 借还记录 CSV 导入
- 车辆信息 JSON 导入  
- 违章回执 JSON 导入

### 3. 记录处理
- 还车处理（自动计算里程变化）
- 违章处理（记录归属结果）

### 4. 异常追踪
- 超时未还自动检测
- 油卡余额异常记录
- 违章归属处理记录
- 退回修改原因留存

### 5. 查询导出
- 按试驾路线查询历史
- 按销售顾问查询历史
- 按里程范围查询历史
- 导出明细 CSV（数量与查询结果一致）
- 车辆里程追溯（可追踪每一次里程变化来源）
- 操作日志查询
- 审计追踪（完整记录每一条记录的处理历程）

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

服务启动后访问 http://localhost:3000

### 运行测试
```bash
npm test
```

## API 接口

### 批次管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches | 创建批次 |
| GET | /api/batches | 批次列表 |
| GET | /api/batches/:id | 批次详情 |
| POST | /api/batches/:id/process | 标记处理完成 |
| POST | /api/batches/:id/return | 退回修改 |

### 数据导入
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches/:id/import/borrow-return | 导入借还CSV |
| POST | /api/batches/:id/import/vehicles | 导入车辆JSON |
| POST | /api/batches/:id/import/violations | 导入违章回执 |

### 记录处理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/records/return/:id | 处理还车 |
| POST | /api/records/violation/:id/handle | 处理违章 |

### 查询导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/query/history | 历史查询 |
| GET | /api/query/mileage-tracking/:vin | 里程追溯 |
| GET | /api/query/exceptions | 异常记录 |
| GET | /api/query/operations | 操作日志 |
| GET | /api/query/export | 导出CSV |
| GET | /api/query/audit-trail/:type/:id | 审计追踪 |

## 示例数据

在 `examples/` 目录下提供了示例数据文件：
- `borrow_return.csv` - 借还记录示例
- `vehicles.json` - 车辆信息示例  
- `violations.json` - 违章记录示例

## 数据模型

### 核心表结构
1. **batches** - 批次表
2. **vehicles** - 车辆表
3. **borrow_return_records** - 借还记录表
4. **violation_records** - 违章记录表
5. **exception_logs** - 异常日志表
6. **operation_logs** - 操作日志表
7. **mileage_tracking** - 里程追溯表

## 使用流程

1. 销售主管创建新批次
2. 导入该批次的车辆信息、借还记录、违章回执
3. 系统自动检测超时、油卡异常等情况并记录
4. 处理还车，系统自动记录里程变化
5. 处理违章归属，记录处理人和时间
6. 标记批次完成或退回修改
7. 通过历史查询功能按路线、顾问、里程筛选
8. 导出查询结果的明细CSV
9. 通过里程追溯功能查看每辆车的里程变化历史
10. 通过审计追踪向他人说明记录的处理历程