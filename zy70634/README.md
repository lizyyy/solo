# 波次拣货缺货拆单复核差异后端API

基于 FastAPI + SQLite 的仓储波次拣货管理系统，支持多订单合并拣货、缺货拆单、复核差异追踪和完成报告导出。

## 功能特性

- **波次管理**：多订单合并拣货、波次生成、状态追踪
- **库位管理**：库位路径排序、拣货路径优化
- **缺货拆单**：自动识别缺货、生成拆分订单
- **复核差异**：差异记录、状态管理、处理追踪
- **报告导出**：Excel格式波次完成报告
- **清晰的错误响应**：缺字段、状态不允许、需人工复核、已处理过

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload
```

服务启动后访问：
- API文档：http://localhost:8000/docs
- 备选文档：http://localhost:8000/redoc

### 3. 运行自检脚本

```bash
python self_test.py
```

自检脚本将验证：
- ✓ 服务健康检查
- ✓ 基础数据导入（库位、SKU、订单）
- ✓ 订单筛选查询
- ✓ 波次创建（多订单合并）
- ✓ 拣货任务生成
- ✓ 库位路径排序
- ✓ 拣货处理 & 缺货拆单
- ✓ 复核差异记录
- ✓ 差异筛选查询
- ✓ 差异解决
- ✓ 波次完成
- ✓ 报告生成
- ✓ Excel导出

## 核心数据模型

| 模型 | 说明 | 关键字段 |
|------|------|----------|
| Wave | 波次 | wave_code, status, total_orders, total_skus |
| Order | 订单 | order_code, wave_id, is_split, parent_order_id |
| OrderItem | 订单商品 | sku_code, ordered_quantity, picked_quantity, is_shortage |
| Location | 库位 | location_code, aisle, rack, level, position, sort_order |
| SKUStock | 商品库存 | sku_code, location_id, quantity |
| PickTask | 拣货任务 | task_code, sku_code, required_quantity, is_shortage |
| ReviewDiff | 复核差异 | diff_code, expected/actual_quantity, status, handler |
| CompletionReport | 完成报告 | report_code, 各维度统计数据 |

## 主要API接口

### 订单管理
- `POST /api/orders/` - 创建订单
- `GET /api/orders/` - 查询订单列表（支持按状态、波次筛选）

### 库位与库存
- `POST /api/locations/` - 创建库位
- `POST /api/sku-stocks/` - 创建SKU库存

### 波次管理
- `POST /api/waves/` - 创建波次（多订单合并）
- `GET /api/waves/` - 查询波次列表（支持状态筛选）
- `POST /api/waves/{wave_id}/generate-tasks/` - 生成拣货任务
- `GET /api/waves/{wave_id}/sorted-tasks/` - 获取路径排序的拣货任务
- `POST /api/waves/{wave_id}/complete/` - 完成波次
- `GET /api/waves/{wave_id}/report/` - 获取详细报告
- `GET /api/waves/{wave_id}/export/` - 导出Excel报告

### 拣货任务
- `POST /api/pick-tasks/{task_id}/process/` - 处理拣货任务（支持缺货拆单）

### 复核差异
- `POST /api/review-diffs/` - 创建复核差异
- `GET /api/waves/{wave_id}/review-diffs/` - 查询波次差异
- `POST /api/review-diffs/{diff_id}/resolve/` - 解决复核差异

## 错误响应规范

| HTTP状态码 | error_code | 说明 |
|------------|------------|------|
| 400 | MISSING_FIELDS | 缺少必填字段 |
| 400 | INVALID_STATE | 当前状态不允许此操作 |
| 400 | REVIEW_REQUIRED | 需要人工复核（有未处理差异） |
| 409 | ALREADY_HANDLED | 已经处理过 |
| 404 | *_NOT_FOUND | 资源不存在 |

### 响应示例

```json
{
  "error_code": "REVIEW_REQUIRED",
  "message": "还有 2 个复核差异待处理，需要人工复核",
  "details": {"wave_id": 1}
}
```

## 核心业务规则

### 1. 波次生成规则
- 同一订单只能属于一个波次
- 波次创建后状态为 pending，生成拣货任务后变为 picking
- 所有拣货任务完成且所有复核差异解决后才能完成波次

### 2. 库位排序规则
- 按通道(aisle) → 货架(rack) → 层数(level) → 位置(position) 排序
- 支持自定义 sort_order 字段调整优先级

### 3. 缺货拆单规则
- 实际拣货量 < 应拣量时触发缺货
- 缺货商品生成新订单（标记 is_split=True）
- 原订单保留已拣货部分

### 4. 复核差异规则
- 同一订单同一SKU只能有一个待处理差异
- 差异解决后状态变为 resolved，记录处理人和时间

## 项目结构

```
.
├── main.py              # FastAPI主应用 & 接口定义
├── models.py            # SQLAlchemy数据模型
├── services.py          # 核心业务逻辑
├── database.py          # 数据库连接配置
├── requirements.txt     # Python依赖
└── self_test.py         # 自检脚本
```

## 运行方式

### 开发模式
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 生产模式
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 数据库

使用 SQLite，数据库文件 `wave_picking.db` 会在首次启动时自动创建。