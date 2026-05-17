# API网关路由体检报告

**生成时间**: 2026-05-17 22:16:08

## 概览统计

| 指标 | 数值 |
|------|------|
| 路由规则总数 | 6 |
| 请求样本总数 | 14 |
| 成功匹配 | 12 |
| 未命中请求 | 2 |
| 解析错误行数 | 0 |

## 上游服务分布

| 上游服务 | 匹配次数 |
|----------|----------|
| auth-service | 2 |
| user-service | 2 |
| order-service | 2 |
| product-service | 2 |
| static-service | 2 |
| health-service | 2 |


## 路由规则优先级

| 优先级排序 | 路径匹配规则 | 上游服务 | 匹配类型 | 优先级值 |
|------------|--------------|----------|----------|----------|
| 1 | `/api/v1/users/login` | auth-service | exact | 20 |
| 2 | `/health` | health-service | exact | 0 |
| 3 | `^/public/.*` | static-service | regex | 0 |
| 4 | `/api/v1/users` | user-service | prefix | 10 |
| 5 | `/api/v1/orders` | order-service | prefix | 5 |
| 6 | `/api/v1/products` | product-service | prefix | 0 |


## 匹配结果详情

| # | 请求路径 | 方法 | 匹配状态 | 上游服务 | 匹配说明 |
|---|----------|------|----------|----------|----------|
| 1 | `/api/v1/users/login` | POST | ✅ 匹配 | auth-service | 匹配类型: exact, 路由优先级: 20, 请求方法: POST 匹配, 共找到 2 个候选路由，按优先级排序后选择此路由 |
| 2 | `/api/v1/users/123` | GET | ✅ 匹配 | user-service | 匹配类型: prefix, 路由优先级: 10, 请求方法: GET 匹配 |
| 3 | `/api/v1/orders/456` | GET | ✅ 匹配 | order-service | 匹配类型: prefix, 路由优先级: 5, 请求方法: GET 匹配 |
| 4 | `/api/v1/products` | GET | ✅ 匹配 | product-service | 匹配类型: prefix, 路由优先级: 0, 请求方法: GET 匹配 |
| 5 | `/public/index.html` | GET | ✅ 匹配 | static-service | 匹配类型: regex, 路由优先级: 0, 请求方法: GET 匹配 |
| 6 | `/health` | GET | ✅ 匹配 | health-service | 匹配类型: exact, 路由优先级: 0, 请求方法: GET 匹配 |
| 7 | `/api/v2/notfound` | GET | ❌ 未匹配 | - | 未找到匹配的路由规则 |
| 8 | `/api/v1/users/login` | POST | ✅ 匹配 | auth-service | 匹配类型: exact, 路由优先级: 20, 请求方法: POST 匹配, 共找到 2 个候选路由，按优先级排序后选择此路由 |
| 9 | `/api/v1/users/123` | GET | ✅ 匹配 | user-service | 匹配类型: prefix, 路由优先级: 10, 请求方法: GET 匹配 |
| 10 | `/api/v1/orders/456` | GET | ✅ 匹配 | order-service | 匹配类型: prefix, 路由优先级: 5, 请求方法: GET 匹配 |
| 11 | `/api/v1/products` | GET | ✅ 匹配 | product-service | 匹配类型: prefix, 路由优先级: 0, 请求方法: GET 匹配 |
| 12 | `/public/index.html` | GET | ✅ 匹配 | static-service | 匹配类型: regex, 路由优先级: 0, 请求方法: GET 匹配 |
| 13 | `/health` | GET | ✅ 匹配 | health-service | 匹配类型: exact, 路由优先级: 0, 请求方法: GET 匹配 |
| 14 | `/api/v2/notfound` | GET | ❌ 未匹配 | - | 未找到匹配的路由规则 |


## 未命中请求列表

| # | 请求路径 | 方法 | 来源文件 | 行号 | 原始内容 |
|---|----------|------|----------|------|----------|
| 1 | `/api/v2/notfound` | GET | `test_routes.yaml` | 7 | `method: GET
path: /api/v2/notfound
` |
| 2 | `/api/v2/notfound` | GET | `test_routes.yaml` | 14 | `method: GET
path: /api/v2/notfound
` |


---

*此报告由 route-checker 工具自动生成*
