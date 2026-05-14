# 回调签名自测台

一个用于调试回调签名问题的全栈Web应用，帮助开发人员快速定位签名验证失败的原因。

## 核心功能

### 后端API
- **商家配置管理**: 支持多商家密钥配置
- **签名记录**: 创建、查询、导出签名验证记录
- **验证引擎**: HMAC-SHA256签名验证
- **时间窗口校验**: 检查请求是否在有效时间内
- **重放攻击检测**: 通过nonce防重放
- **状态追踪**: 完整的状态变更历史
- **样例库**: 保存典型成功/失败案例
- **数据导出**: CSV格式导出

### 前端界面
- **总览页面**: 记录列表、状态筛选
- **详情页面**: 前后对比、签名复核
- **创建记录**: 模拟外部回调
- **商家配置**: 密钥管理
- **样例库**: 典型案例管理

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── server.js       # 主入口
│   │   ├── database.js     # 数据库初始化
│   │   ├── routes.js       # API路由
│   │   └── signatureService.js  # 签名逻辑
│   └── package.json
└── frontend/               # 前端页面
    ├── index.html
    └── app.js
```

## 快速开始

### 1. 安装后端依赖
```bash
cd backend
npm install
```

### 2. 启动后端服务
```bash
npm start
```
服务运行在 http://localhost:3001

### 3. 打开前端页面
直接在浏览器打开 `frontend/index.html`，或使用任意静态文件服务器：
```bash
cd frontend
python3 -m http.server 8080
```

## API接口说明

### 商家配置
- `POST /api/merchants` - 添加商家
- `GET /api/merchants` - 获取商家列表

### 签名记录
- `POST /api/records` - 创建记录
- `GET /api/records` - 查询记录列表
- `GET /api/records/:recordId` - 获取记录详情
- `POST /api/records/:recordId/verify` - 执行验证
- `POST /api/records/:recordId/retry` - 重试验证
- `POST /api/records/:recordId/save-sample` - 保存到样例库

### 样例库
- `GET /api/samples` - 查询样例列表

### 导出
- `GET /api/export/records` - 导出记录CSV
- `GET /api/export/samples` - 导出样例CSV

### 工具
- `POST /api/generate-signature` - 生成签名

## 验收流程

### 页面操作验收
1. 在"商家配置"页面添加一个测试商家
2. 在"创建记录"页面：
   - 选择商家
   - 填写测试JSON载荷
   - 点击"生成正确签名"
   - 点击"创建记录"
3. 在"记录列表"点击记录ID进入详情
4. 点击"执行验证"查看结果
5. 故意修改签名或时间戳测试失败场景
6. 保存到样例库并查看

### API接口验收
```bash
# 添加商家
curl -X POST http://localhost:3001/api/merchants \
  -H "Content-Type: application/json" \
  -d '{"merchant_id":"TEST001","merchant_name":"测试商家","secret_key":"test123456"}'

# 创建记录
curl -X POST http://localhost:3001/api/records \
  -H "Content-Type: application/json" \
  -d '{"merchant_id":"TEST001","payload":{"order_id":"123"},"signature":"xxx","timestamp":1735689600}'

# 执行验证
curl -X POST http://localhost:3001/api/records/{recordId}/verify
```

## 数据模型

### merchant_configs
- merchant_id: 商家唯一标识
- merchant_name: 商家名称
- secret_key: HMAC密钥
- algorithm: 签名算法
- time_window: 时间窗口(秒)

### signature_records
- record_id: 记录ID
- merchant_id: 商家ID
- original_payload: 原始载荷
- signature: 提交的签名
- timestamp: 请求时间戳
- nonce: 防重放随机数
- status: 状态(PENDING/SUCCESS/FAILED)
- error_message: 错误信息

### sample_library
- sample_id: 样例ID
- record_id: 关联记录ID
- expected_signature: 预期签名
- is_success: 是否成功
- notes: 备注

### verification_history
- 状态变更历史追踪
