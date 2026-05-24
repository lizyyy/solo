# 印刷打样确认 API

## 启动服务

```bash
./print-proof-api
```

服务默认运行在 `http://localhost:8080/api/v1`

## 业务流程

### 完整流程示例

1. **创建订单** → POST /api/v1/orders
2. **添加纸张** → POST /api/v1/papers
3. **提交打样材料** → POST /api/v1/versions/material
4. **提交版本审核** → POST /api/v1/versions/:id/submit
5. **自动校验** → POST /api/v1/versions/:id/autocheck
6. **人工审核** → POST /api/v1/versions/:id/review
7. **批准/拒绝/要求补充** → /approve, /reject, /supplement/request
8. **补录后重新提交** → POST /api/v1/versions/:id/supplement
9. **最终确认结案** → POST /api/v1/versions/:id/finalize
10. **生成生产报告** → POST /api/v1/versions/:id/report

## API 端点

### 订单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/orders | 创建订单 |
| GET | /api/v1/orders | 获取订单列表 |
| GET | /api/v1/orders/:id | 获取订单详情 |
| GET | /api/v1/orders/:id/versions | 获取订单的所有版本 |
| GET | /api/v1/orders/:id/summary | 获取订单汇总 |

### 纸张管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/papers | 添加纸张 |
| GET | /api/v1/papers | 获取纸张列表 |

### 打样版本管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/versions/material | 提交打样材料 |
| POST | /api/v1/versions/:id/submit | 提交版本审核 |
| GET | /api/v1/versions/:id/autocheck | 获取自动校验结果 |
| POST | /api/v1/versions/:id/autocheck | 执行自动校验并更新状态 |
| POST | /api/v1/versions/:id/review | 开始人工审核 |
| POST | /api/v1/versions/:id/approve | 批准版本 |
| POST | /api/v1/versions/:id/reject | 拒绝版本 |
| POST | /api/v1/versions/:id/supplement/request | 要求补充材料 |
| POST | /api/v1/versions/:id/supplement | 补充材料后重新提交 |
| POST | /api/v1/versions/:id/finalize | 最终确认结案 |
| GET | /api/v1/versions/:id | 获取版本详情 |
| GET | /api/v1/versions/:id/changes | 获取版本变更日志 |
| GET | /api/v1/versions/:id/can-produce | 检查是否可以生产 |
| POST | /api/v1/versions/:id/report | 创建生产报告 |
| GET | /api/v1/versions/:id/export | 导出版本详情到CSV |

### 处理人管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/handlers | 添加处理人 |
| GET | /api/v1/handlers | 获取处理人列表 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/actions?state=xxx | 获取状态下可执行的操作 |

## 状态机说明

### 版本状态

- `draft` - 草稿
- `submitted` - 已提交
- `auto_pass` - 自动校验通过
- `auto_fail` - 自动校验失败
- `reviewing` - 人工审核中
- `approved` - 已批准
- `rejected` - 已拒绝
- `need_supplement` - 需要补充材料
- `finalized` - 已结案（最终版本）

### 状态流转

```
draft → submit → submitted
submitted → auto_pass → auto_pass
submitted → auto_fail → auto_fail
submitted → start_review → reviewing
auto_pass → finalize → finalized
auto_pass → reject → rejected
auto_fail → need_supplement → need_supplement
auto_fail → reject → rejected
reviewing → approve → approved
reviewing → reject → rejected
reviewing → need_supplement → need_supplement
approved → finalize → finalized
need_supplement → resubmit → submitted
rejected → resubmit → submitted
```

## 请求示例

### 创建订单

```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORD2024001",
    "customer_name": "客户A",
    "product_name": "宣传册",
    "quantity": 5000
  }'
```

### 提交打样材料

```bash
curl -X POST http://localhost:8080/api/v1/versions/material \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORD2024001",
    "paper_id": "paper-uuid",
    "colors": [
      {
        "color_type": "cmyk",
        "color_name": "主色",
        "c_value": 100,
        "m_value": 50,
        "y_value": 0,
        "k_value": 0
      }
    ],
    "notes": "首次打样",
    "created_by": "张三"
  }'
```

### 自动校验

```bash
curl -X POST http://localhost:8080/api/v1/versions/{version_id}/autocheck \
  -H "Content-Type: application/json" \
  -d '{"operator": "李四"}'
```

### 最终确认

```bash
curl -X POST http://localhost:8080/api/v1/versions/{version_id}/finalize \
  -H "Content-Type: application/json" \
  -d '{"operator": "王五"}'
```

## 核心特性

1. **版本状态机** - 严格控制版本状态流转，防止非法操作
2. **色值校验** - CMYK 数值范围检查、色域越界检测
3. **确认留痕** - 所有确认操作记录确认人、时间、结果
4. **差异记录** - 补录操作保留改动前后的完整差异
5. **重复生产拦截** - 检查版本是否已结案、是否已有生产报告
6. **报告导出** - 支持导出版本详情为 CSV 文件
