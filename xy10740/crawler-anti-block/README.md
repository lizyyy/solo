# 爬虫任务反封监控系统

## 项目简介

这是一个全栈的爬虫任务反封监控系统，集成了目标站点、代理池、失败原因、频率策略、验证码事件、采集报表等数据，提供统一的监控和管理界面。

## 技术栈

- **后端**: Python + FastAPI + SQLAlchemy + SQLite
- **前端**: Vue 3 + Element Plus + Vite + Axios

## 主要功能

### 后端接口
- 创建任务（带幂等性处理，防止重复提交）
- 任务列表查询（支持多条件筛选）
- 任务详情查询
- 任务审批
- 任务回滚
- 任务重试
- 验证码事件确认
- 数据导出（Excel格式）
- 版本、站点、代理池列表获取

### 前端功能
- 版本列表选择筛选
- 目标站点、代理池、状态多条件筛选
- 任务表格展示
- 新建任务弹窗
- 任务详情（包含失败原因、验证码事件、频率异常、采集报表四个标签页）
- 审批、回滚、重试操作按钮
- 数据导出功能
- 验证码事件人工确认

## 幂等性设计

系统通过 `idempotency_key` 字段实现幂等性控制：
- 创建任务时，如果使用相同的 `idempotency_key` 重复提交，系统会直接返回已存在的任务，不会重复创建
- 前端新建任务时自动生成基于时间戳的幂等Key
- 用户也可以自定义幂等Key

## 安装和运行

### 后端启动

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端服务将在 `http://localhost:8000` 启动

API文档地址: `http://localhost:8000/docs`

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

## 验收测试

### 页面操作测试
1. 打开前端页面 `http://localhost:3000`
2. 点击"新建任务"按钮
3. 填写任务信息（注意幂等Key会自动生成）
4. 提交任务，查看任务列表是否新增

### 接口重复提交测试
```bash
# 第一次提交
curl -X POST "http://localhost:8000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test_001",
    "idempotency_key": "test_key_123",
    "target_site": "https://example.com",
    "proxy_pool": "pool_01",
    "version": "v1.0",
    "frequency_strategy": "10s/request"
  }'

# 第二次提交（使用相同的idempotency_key）
curl -X POST "http://localhost:8000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test_001",
    "idempotency_key": "test_key_123",
    "target_site": "https://example.com",
    "proxy_pool": "pool_01",
    "version": "v1.0",
    "frequency_strategy": "10s/request"
  }'

# 验证：查询任务列表，应该只有1条记录
curl "http://localhost:8000/api/tasks"
```

预期结果：两次提交后，数据库中只有一条任务记录。