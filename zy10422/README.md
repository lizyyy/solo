# 设备可信证据API (Device Evidence API)

IoT设备异常上报复核系统，实现证明材料与策略判定一体化复核的REST API。

## 技术栈

- **Go 1.21+** - 后端语言
- **Gin** - Web框架
- **SQLite** - 本地持久化存储

## 项目结构

```
.
├── model/          # 数据模型定义
│   └── evidence.go
├── database/       # 数据库层
│   └── sqlite.go
├── service/        # 业务逻辑层
│   └── evidence_service.go
├── handler/        # API处理器
│   └── evidence_handler.go
├── main.go         # 程序入口
├── go.mod          # 依赖管理
└── test_api.sh     # API测试脚本
```

## 核心功能

### 数据模型
- **设备编号 (device_id)** - 设备唯一标识
- **证明材料 (proof_material)** - 哈希、签名、证书、时间戳、测量值
- **固件版本 (firmware_version)** - 固件版本校验
- **策略结果 (strategy_result)** - 策略判定规则、风险等级、建议动作
- **隔离动作 (isolation_action)** - none/quarantine/suspend/release
- **证据状态 (status)** - success(成功)/pending(待复核)/blocked(被拦截)/compensated(已补偿)

### 核心规则
1. **证明材料校验** - 哈希验证、签名完整性检查
2. **固件匹配** - 设备允许的固件版本白名单
3. **隔离状态** - 设备隔离状态跟踪与联动
4. **重复上报幂等** - 通过Idempotent-Key头保证幂等性
5. **证据报告** - 生成结构化的复核报告

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/evidences` | 创建证据记录 |
| GET | `/api/v1/evidences/{id}` | 获取单个证据详情 |
| POST | `/api/v1/evidences/query` | 分页查询证据列表 |
| PUT | `/api/v1/evidences/{id}/status` | 推进证据状态 |
| PUT | `/api/v1/evidences/{id}/correct` | 人工修正补偿 |
| GET | `/api/v1/evidences/export` | 导出所有证据数据 |
| GET | `/api/v1/evidences/{id}/report` | 生成证据报告 |
| GET | `/health` | 健康检查 |

## 快速开始

### 1. 安装依赖

```bash
go mod tidy
```

### 2. 启动服务

```bash
go run main.go
```

服务将在 `http://localhost:8099` 启动

### 3. 运行测试脚本

```bash
chmod +x test_api.sh
./test_api.sh
```

## 接口示例

### 创建证据

```bash
curl -X POST http://localhost:8099/api/v1/evidences \
  -H "Content-Type: application/json" \
  -H "Idempotent-Key: your-unique-key" \
  -d '{
    "device_id": "device-001",
    "firmware_version": "v1.2.0",
    "proof_material": {
      "hash": "7a8f9d2c...",
      "signatures": ["sig1", "sig2"],
      "certificate": "cert-001",
      "timestamp": 1700000000,
      "measurements": ["m1", "m2"]
    },
    "strategy_result": {
      "passed": true,
      "rules": [
        {"rule_id": "r1", "rule_name": "完整性校验", "passed": true, "details": "通过"}
      ],
      "risk_level": "low",
      "recommended_action": "none"
    }
  }'
```

### 查询证据列表

```bash
curl -X POST http://localhost:8080/api/v1/evidences/query \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-001",
    "status": "success",
    "page": 1,
    "page_size": 10
  }'
```

### 状态推进

```bash
curl -X PUT http://localhost:8080/api/v1/evidences/{id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "success",
    "isolation_action": "release",
    "remark": "复核通过",
    "operator": "admin",
    "conclusion": "经人工复核，设备可信"
  }'
```

### 人工修正

```bash
curl -X PUT http://localhost:8080/api/v1/evidences/{id}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "isolation_action": "release",
    "remark": "误判，解除隔离",
    "operator": "admin",
    "override_strategy": true
  }'
```

### 生成报告

```bash
# JSON格式报告
curl http://localhost:8080/api/v1/evidences/{id}/report?type=full

# 纯文本格式报告
curl http://localhost:8080/api/v1/evidences/{id}/report?type=full&format=text
```

## 数据持久化

- 数据库文件: `./device-evidence.db`
- 服务重启后历史数据保留
- 支持导出完整JSON格式数据

## 预置设备固件白名单

| 设备ID | 允许的固件版本 |
|--------|----------------|
| device-001 | v1.2.0, v1.2.1, v1.3.0 |
| device-002 | v2.0.0, v2.0.1 |
| device-003 | v1.5.0, v1.5.1, v1.6.0 |

不在列表中的设备会标记为 pending（待复核）状态。
