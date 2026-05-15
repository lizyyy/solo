# 下游超时画像 API

一个用于分析和追踪 API 请求下游服务超时情况的后端服务，支持样本创建、耗时分析、状态追踪和画像导出。

## 核心功能

### 数据对象
- **请求样本 (RequestSample)**: 完整的 API 请求记录，包含总耗时和下游分段
- **下游段 (DownstreamSegment)**: 每个下游调用的详细耗时和状态
- **耗时桶 (TimeBucket)**: 耗时区间统计分类
- **超时类型 (TimeoutType)**: 超时严重程度分级
- **排查备注 (TroubleshootNote)**: 问题排查过程记录
- **修复记录 (FixRecord)**: 解决方案和效果追踪

### 核心规则
1. **耗时拆分**: 自动拆分总耗时到各个下游段
2. **超时归类**: 根据阈值自动归类超时严重程度
3. **样本保留**: 完整保留样本数据用于后续分析
4. **修复跟踪**: 记录问题排查和修复全过程
5. **画像导出**: 生成完整的超时分析画像报告

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python app.py
```
服务默认运行在 `http://localhost:5000`

### 3. 运行测试脚本
```bash
chmod +x test_api.sh
./test_api.sh
```

## API 接口

### 基础接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/stats` | 统计信息 |

### 样本管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/samples` | 创建样本 |
| GET | `/api/samples` | 样本列表（支持筛选） |
| GET | `/api/samples/<request_id>` | 查询样本详情 |

### 状态管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/samples/<request_id>/advance` | 推进样本状态 |
| POST | `/api/samples/<request_id>/notes` | 添加排查备注 |
| POST | `/api/samples/<request_id>/fixes` | 添加修复记录 |
| POST | `/api/samples/<request_id>/revoke` | 撤销样本 |

### 导出与历史
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/profile` | 导出超时画像 |
| GET | `/api/history` | 查看处理记录 |

### 演示接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/demo/create-samples` | 生成演示数据 |
| POST | `/api/demo/trigger-error` | 触发异常演示 |

## 如何使用

### 造数据 - 生成演示样本
```bash
curl -X POST http://localhost:5000/api/demo/create-samples \
  -H "Content-Type: application/json" \
  -d '{"count": 20, "api_name": "order_service"}'
```

### 造数据 - 手动创建样本
```bash
curl -X POST http://localhost:5000/api/samples \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req-12345",
    "api_name": "user_service",
    "total_time_ms": 1500,
    "segments": [
      {
        "name": "auth_service",
        "start_time": 0,
        "end_time": 200,
        "duration_ms": 200,
        "status_code": 200
      },
      {
        "name": "db_query",
        "start_time": 200,
        "end_time": 1300,
        "duration_ms": 1100,
        "status_code": 200
      }
    ],
    "metadata": {
      "env": "prod",
      "region": "cn-north"
    }
  }'
```

### 触发异常
1. **验证错误** - 缺少必填字段
```bash
curl -X POST http://localhost:5000/api/samples \
  -H "Content-Type: application/json" \
  -d '{"request_id": "test-001"}'
```

2. **重复提交** - 同一 request_id 提交两次（返回 409）
```bash
# 先提交一次
curl -X POST http://localhost:5000/api/samples \
  -H "Content-Type: application/json" \
  -d '{"request_id": "unique-001", "api_name": "test", "total_time_ms": 100, "segments": []}'

# 再提交一次（会失败）
curl -X POST http://localhost:5000/api/samples \
  -H "Content-Type: application/json" \
  -d '{"request_id": "unique-001", "api_name": "test", "total_time_ms": 100, "segments": []}'
```

3. **状态流转错误**
```bash
curl -X POST http://localhost:5000/api/samples/<request_id>/advance \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid_status"}'
```

4. **使用演示接口触发**
```bash
curl -X POST http://localhost:5000/api/demo/trigger-error \
  -H "Content-Type: application/json" \
  -d '{"error_type": "transition"}'
```

可用的 error_type: `validation`, `duplicate`, `transition`, `notfound`

### 查看处理记录
1. **查看单个样本的处理历史**
```bash
curl "http://localhost:5000/api/history?request_id=<your_request_id>"
```

2. **查看全局处理历史**
```bash
curl "http://localhost:5000/api/history?limit=20"
```

3. **查看样本完整信息（含备注和修复记录）**
```bash
curl "http://localhost:5000/api/samples/<request_id>"
```

### 状态流转说明
```
CREATED → ANALYZED → TROUBLESHOOTING → RESOLVED
                      ↓
                   DISCARDED
```

有效状态转换:
- created → analyzed, discarded
- analyzed → troubleshooting, resolved, discarded
- troubleshooting → resolved, discarded

### 超时分级说明
| 级别 | 阈值 | 说明 |
|------|------|------|
| NORMAL | < 200ms | 正常 |
| WARNING | 200-500ms | 警告 |
| SEVERE | 500-1000ms | 严重 |
| CRITICAL | 1000-3000ms | 危急 |
| TIMEOUT | ≥ 10000ms | 超时 |

### 耗时桶分类
- `ultra_fast`: 0-50ms
- `fast`: 50-200ms
- `normal`: 200-500ms
- `slow`: 500-1000ms
- `very_slow`: 1000-3000ms
- `extreme`: 3000-10000ms
- `timeout`: ≥ 10000ms

## 项目结构
```
.
├── app.py              # Flask 应用主入口，API 路由
├── models.py           # 数据模型定义
├── core.py             # 核心业务逻辑：超时分析器
├── storage.py          # 内存存储层
├── demo.py             # 演示数据生成器
├── requirements.txt    # 依赖列表
├── test_api.sh         # API 测试脚本
└── README.md           # 使用说明文档
```

## 导出画像示例
```bash
# 导出完整画像
curl "http://localhost:5000/api/export/profile?api_name=order_service"

# 导出摘要格式
curl "http://localhost:5000/api/export/profile?api_name=order_service&format=summary"
```

## 自检功能
1. **重复提交检测**: 相同 request_id 不会重复创建
2. **状态流转校验**: 非法状态转换会被拒绝
3. **参数验证**: 必填字段缺失返回明确错误
4. **索引维护**: 多维度索引确保查询性能
