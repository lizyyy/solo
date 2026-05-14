# 缓存预热失效中心 - 部署指南

## 项目结构

```
.
├── backend/          # Python Flask 后端
│   ├── app.py        # 主应用
│   ├── models.py     # 数据模型
│   └── requirements.txt
├── frontend/         # Vue 3 前端
│   ├── src/
│   │   ├── views/    # 页面组件
│   │   ├── router/   # 路由配置
│   │   └── main.js   # 入口文件
│   ├── package.json
│   └── vite.config.js
├── README.md
├── start.sh
└── DEPLOYMENT.md
```

## 快速启动

### 方式一：使用启动脚本（推荐）

```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动

#### 启动后端

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

后端服务将运行在 http://localhost:5000

#### 启动前端（新终端）

```bash
cd frontend
npm install
npm run dev
```

前端服务将运行在 http://localhost:3000

## 功能特性

### 1. 缓存规则管理
- 创建、查看缓存键规则
- 支持按状态和关键词筛选
- 保留原始输入与处理结果

### 2. 预热批次管理
- 启动预热任务
- 追踪预热进度
- 记录命中率数据

### 3. 失效事件管理
- 创建失效事件
- 执行失效操作
- 状态流转：待执行 → 执行中 → 完成/失败

### 4. 幂等性保证
- 使用 `processingIds` Set 防止重复操作
- 重复点击时显示提示
- 刷新页面后状态不变

### 5. 回源压力留痕
- 每次失效执行时记录压力等级
- 记录预估 QPS
- 留存处理理由

### 6. 失效修正路径
- 失败事件可提交修正记录
- 记录修正原因、处理人、备注
- 支持复盘追溯

### 7. 复核抽屉
- 查看规则详情
- 原始输入与处理结果对比
- 复核操作与备注

### 8. 性能报告
- 生成缓存性能报告
- 包含命中率、批次统计等数据
- 报告详情查看

## API 接口

### 缓存规则
- `GET /api/rules` - 获取规则列表（支持分页筛选）
- `POST /api/rules` - 创建规则
- `GET /api/rules/{id}` - 获取规则详情
- `POST /api/rules/{id}/preheat` - 启动预热

### 预热批次
- `POST /api/batches/{id}/complete` - 完成预热批次

### 失效事件
- `POST /api/rules/{id}/invalidate` - 创建失效事件
- `POST /api/invalidations/{id}/execute` - 执行失效
- `POST /api/invalidations/{id}/complete` - 完成失效
- `POST /api/invalidations/{id}/correct` - 提交修正

### 性能报告
- `POST /api/reports` - 创建报告
- `GET /api/reports/{id}` - 获取报告

### 仪表盘
- `GET /api/dashboard/stats` - 获取统计数据

## 数据模型

### CacheRule（缓存规则）
- rule_key: 规则键
- rule_pattern: 匹配模式
- original_input: 原始输入（JSON）
- processed_result: 处理结果（JSON）
- status: 状态（pending/preheating/ready）
- current_hit_rate: 当前命中率

### PreheatBatch（预热批次）
- batch_key: 批次号
- total_keys: 总键数
- success_keys: 成功数
- hit_rate: 命中率
- status: 状态

### InvalidationEvent（失效事件）
- event_key: 事件号
- reason: 原因
- operator: 操作人
- status: 状态（pending/processing/completed/failed/corrected）
- failure_reason: 失败原因

### CorrectionRecord（修正记录）
- correction_reason: 修正原因
- handler: 处理人
- handler_comment: 备注

### SourcePressureLog（回源压力日志）
- pressure_level: 压力等级
- estimated_qps: 预估QPS
- reason: 原因

### PerformanceReport（性能报告）
- report_key: 报告号
- avg_hit_rate: 平均命中率
- total_preheat_batches: 预热批次总数
- total_invalidations: 失效总数
- report_data: 报告数据（JSON）

## 状态流转

### 缓存规则状态
```
pending (待处理)
    ↓ 启动预热
preheating (预热中)
    ↓ 预热完成
ready (已就绪)
    ↓ 失效完成
pending (待处理)
```

### 失效事件状态
```
pending (待执行)
    ↓ 执行
processing (执行中)
    ↓ 成功/失败
completed (已完成) / failed (失败)
                           ↓ 提交修正
                           corrected (已修正)
```

## 注意事项

1. 首次启动会自动创建 SQLite 数据库文件 `cache_center.db`
2. 前后端通过代理通信，前端访问 `/api/*` 会转发到后端
3. 所有操作都有状态检查，防止非法状态转换
4. 幂等性通过前端的 `processingIds` Set 实现，后端也有状态校验
