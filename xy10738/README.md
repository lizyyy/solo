# 消息队列积压诊断系统

## 核心功能

### 1. 四种状态区分
- **success (✅ 校验通过)**: 数据正常，无明显问题
- **pending_review (⚠️ 待复核)**: 存在风险但不致命，需人工确认
- **blocked (❌ 已拦截)**: 数据严重错误，已阻止进入系统
- **retryable (🔄 可重试)**: 积压量较高，建议应用限速策略后重试

### 2. 数据闭环
- Topic分区 + 消费组 + 积压量 + 重平衡事件 联合校验
- 限速策略配置与持久化
- 诊断建议保存与追踪

### 3. 导出功能
- 按负责人分组
- 按时间分组
- 按积压量级分组 (0-1K, 1K-10K, 10K-50K, 50K+)

## 快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动后端服务
```bash
cd backend
python main.py
```

API文档: http://localhost:8000/docs

### 3. 打开前端
直接在浏览器中打开 `frontend/index.html`

## API 接口

### POST /api/validate
数据校验入口

**Request Body:**
```json
{
    "topic": "order-events",
    "partition": 0,
    "consumer_group": "order-processor",
    "lag": 1500,
    "owner": "张三",
    "last_updated": "2024-01-01T00:00:00Z",
    "rebalance_events": []
}
```

### GET /api/sample-data
获取样例数据（包含脏数据）

### GET/POST /api/rate-limit-strategies
限速策略管理

### GET/POST /api/diagnosis-suggestions
诊断建议管理

### GET /api/export
导出Excel报表

## 样例数据说明

| 样例名称 | 预期状态 | 触发条件 |
|---------|---------|---------|
| 正常数据 | success | 积压量正常，无重平衡 |
| 高积压数据 | retryable | 积压量 > 50000 |
| 频繁重平衡数据 | pending_review | 重平衡事件 > 5次 |
| 脏数据-负积压量 | blocked | 分区为负 / 积压量为负 |
| 脏数据-缺失字段 | blocked | Topic/消费组为空 |

## 失败路径演示

1. **脏数据拦截**: 加载"脏数据"样例，点击校验，系统返回 blocked
2. **限速策略介入**: 加载"高积压数据"，系统返回 retryable，提示应用限速策略后重试
3. **重平衡预警**: 加载"频繁重平衡数据"，系统返回 pending_review，给出优化建议
4. **无数据导出**: 直接点击导出，系统返回 404 提示无数据
