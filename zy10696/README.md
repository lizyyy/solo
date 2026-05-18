# 缓存管理后台热点Key手工降级 API

## 项目概述

本系统提供缓存热点Key的手工降级管理功能，支持降级记录创建、恢复申请、旧缓存清理标记、数据查询和导出等核心功能，解决手工命令操作容易遗漏的问题。

## 技术栈

- Node.js + Express
- SQLite (本地数据库)
- csv-writer (数据导出)

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── database.js            # 数据库初始化与连接
│   ├── routes/
│   │   └── degradeRoutes.js   # API路由定义
│   └── services/
│       ├── degradeService.js  # 降级业务逻辑
│       ├── exportService.js   # 数据导出服务
│       └── mockCacheService.js # 模拟缓存服务(演示用)
├── examples/
│   └── null_cache_demo.js     # 本地场景演示脚本
├── tests/
│   └── acceptance_tests.js    # 验收测试脚本
├── data/                       # SQLite数据库文件目录
├── exports/                    # 导出文件目录
├── test-results/               # 测试结果目录
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动API服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

### 3. 健康检查

```bash
curl http://localhost:3000/health
```

## API 接口文档

### 基础路径

所有API接口的基础路径: `http://localhost:3000/api/cache`

### 1. 创建降级记录

**接口**: `POST /degrade`

**输入参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cache_key | string | 是 | 缓存Key |
| business_line | string | 是 | 业务线 |
| degrade_reason | string | 是 | 降级原因 |
| executor | string | 是 | 执行人 |

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/cache/degrade \
  -H "Content-Type: application/json" \
  -d '{
    "cache_key": "user:10001",
    "business_line": "用户中心",
    "degrade_reason": "热点Key流量突增，QPS达5000",
    "executor": "张三"
  }'
```

**输出示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "cache_key": "user:10001",
    "business_line": "用户中心",
    "degrade_reason": "热点Key流量突增，QPS达5000",
    "executor": "张三",
    "status": "degraded"
  }
}
```

### 2. 申请恢复

**接口**: `POST /restore/:id`

**输入参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | path | 是 | 降级记录ID |
| applicant | string | 是 | 申请人 |

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/cache/restore/1 \
  -H "Content-Type: application/json" \
  -d '{"applicant": "李四"}'
```

**输出示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "restore_applied",
    "applicant": "李四"
  }
}
```

### 3. 确认清理完成

**接口**: `POST /cleanup/:taskId/confirm`

**输入参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | path | 是 | 清理任务ID |
| operator | string | 是 | 操作人 |

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/cache/cleanup/1/confirm \
  -H "Content-Type: application/json" \
  -d '{"operator": "王五"}'
```

**输出示例**:
```json
{
  "success": true,
  "data": {
    "taskId": 1,
    "status": "confirmed",
    "operator": "王五"
  }
}
```

### 4. 查询降级记录

**接口**: `GET /records`

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态过滤: degraded/restore_applied/completed |
| business_line | string | 否 | 业务线过滤 |
| cache_key | string | 否 | Key模糊搜索 |
| limit | number | 否 | 返回数量限制 |

**请求示例**:
```bash
# 查询所有记录
curl http://localhost:3000/api/cache/records

# 查询降级中的记录
curl "http://localhost:3000/api/cache/records?status=degraded"

# 按业务线查询
curl "http://localhost:3000/api/cache/records?business_line=用户中心"
```

### 5. 查询单个降级记录

**接口**: `GET /records/:id`

**请求示例**:
```bash
curl http://localhost:3000/api/cache/records/1
```

### 6. 查询清理任务

**接口**: `GET /cleanup-tasks`

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态过滤: pending/confirmed |

**请求示例**:
```bash
# 查询待清理任务
curl "http://localhost:3000/api/cache/cleanup-tasks?status=pending"
```

### 7. 记录缓存命中并标记清理

**接口**: `POST /cache-hit`

**说明**: 当旧缓存Key被访问时调用此接口，系统会自动检查并标记为待清理任务。

**输入参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cache_key | string | 是 | 缓存Key |
| value_type | string | 否 | 值类型 |
| is_null_cache | boolean | 否 | 是否为空值缓存 |

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/cache/cache-hit \
  -H "Content-Type: application/json" \
  -d '{
    "cache_key": "user:10001",
    "value_type": "null",
    "is_null_cache": true
  }'
```

### 8. 导出降级记录

**接口**: `GET /export/records`

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 否 | 导出格式: csv/json (默认csv) |
| status | string | 否 | 状态过滤 |
| business_line | string | 否 | 业务线过滤 |

**请求示例**:
```bash
# 导出CSV格式
curl "http://localhost:3000/api/cache/export/records?format=csv" -o records.csv

# 导出JSON格式
curl "http://localhost:3000/api/cache/export/records?format=json" -o records.json
```

### 9. 导出清理任务

**接口**: `GET /export/cleanup-tasks`

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 否 | 导出格式: csv/json |
| status | string | 否 | 状态过滤 |

**请求示例**:
```bash
curl "http://localhost:3000/api/cache/export/cleanup-tasks?format=csv" -o tasks.csv
```

## 状态流转说明

```
降级记录状态:
degraded (已降级) 
    ↓
restore_applied (已申请恢复)
    ↓
completed (已完成)

清理任务状态:
pending (待清理)
    ↓
confirmed (已确认清理)
```

## 本地场景演示

### 场景1: 空值缓存降级与恢复

演示空值缓存导致的热点Key降级流程。

**运行命令**:
```bash
# 终端1: 启动服务
npm start

# 终端2: 运行演示脚本
node examples/null_cache_demo.js
```

**处理流程**:
1. 设置空值缓存 `user:123` = null
2. 创建降级记录，记录Key、业务线、原因、执行人
3. 申请恢复，记录申请人和时间
4. 模拟旧空值缓存被命中，自动标记待清理
5. 确认清理完成，状态流转为completed

### 场景2: Key前缀变更导致旧缓存失效

演示业务线切换或版本升级导致Key前缀变更时的旧缓存清理流程。

**演示内容**:
- 变更Key前缀: v1 → v2
- 旧前缀Key被访问时自动标记
- 记录命中次数，便于判断清理优先级

## 验收测试

### 测试数据准备

系统包含三组验收测试:

1. **正常流程记录** - 完整的降级->恢复->清理流程
2. **异常流程记录** - 参数校验、状态流转异常处理
3. **重复运行记录** - 并发、多次命中、批量查询

### 运行验收测试

```bash
# 终端1: 启动服务
npm start

# 终端2: 运行验收测试
node tests/acceptance_tests.js
```

### 测试结果查看

测试结果将保存在 `test-results/` 目录下，包含:
- 总测试数
- 通过/失败数
- 通过率
- 每条测试的输入、期望、实际结果

### 人工复核说明

1. **查看数据库**: 可使用SQLite客户端打开 `data/cache_degrade.db`
2. **查看导出文件**: exports/ 目录下的CSV/JSON文件
3. **查看测试结果**: test-results/ 目录下的测试报告
4. **验证状态流转**: 确认每条记录的状态变更符合预期

## 数据库表结构

### degrade_records (降级记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| cache_key | TEXT | 缓存Key |
| business_line | TEXT | 业务线 |
| degrade_reason | TEXT | 降级原因 |
| executor | TEXT | 执行人 |
| status | TEXT | 状态 |
| restore_time | DATETIME | 恢复申请时间 |
| restore_applicant | TEXT | 恢复申请人 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### cleanup_tasks (清理任务表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| degrade_record_id | INTEGER | 关联降级记录ID |
| cache_key | TEXT | 缓存Key |
| hit_count | INTEGER | 命中次数 |
| status | TEXT | 状态 |
| marked_at | DATETIME | 标记时间 |
| confirmed_at | DATETIME | 确认时间 |
| confirmed_by | TEXT | 确认人 |

### cache_hits (缓存命中记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| cache_key | TEXT | 缓存Key |
| hit_time | DATETIME | 命中时间 |
| value_type | TEXT | 值类型 |
| is_null_cache | INTEGER | 是否为空值缓存 |

## 常见问题

### Q: 如何清理数据库重新测试?
A: 删除 `data/cache_degrade.db` 文件，重启服务会自动重建。

### Q: 导出的文件在哪里?
A: 导出文件保存在 `exports/` 目录下。

### Q: 如何查看所有API返回结果?
A: 可以使用 curl 的 `-v` 参数查看详细请求响应。

## 命令速查

```bash
# 启动服务
npm start

# 安装依赖
npm install

# 运行演示
node examples/null_cache_demo.js

# 运行验收测试
node tests/acceptance_tests.js

# 健康检查
curl http://localhost:3000/health

# 创建降级
curl -X POST http://localhost:3000/api/cache/degrade \
  -H "Content-Type: application/json" \
  -d '{"cache_key":"test","business_line":"测试","degrade_reason":"测试","executor":"测试"}'

# 查询记录
curl http://localhost:3000/api/cache/records
```