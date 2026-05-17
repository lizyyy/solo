# 电商开放平台商家回调签名轮换 API

## 服务概述

本服务用于管理电商开放平台商家回调签名版本的轮换流程，支持创建、修改、审核、撤回、列表查询、详情查看和CSV导出功能。

### 核心数据字段
- 应用密钥 (app_key)
- 回调地址 (callback_url)
- 旧签名版本 (old_signature_version)
- 新签名版本 (new_signature_version)
- 当前签名版本 (current_signature_version)
- 失败次数 (fail_count)
- 旧密钥过期时间 (old_key_expire_time)

### 状态说明
| 状态码 | 中文说明 |
|--------|----------|
| not_enabled | 未启用 |
| in_gray | 灰度中 |
| switched | 已切换 |
| rolled_back | 已回滚 |

### 边界处理
- 相同app_key + 旧签名版本 + 新签名版本不能重复创建，不能静默覆盖
- 老密钥过期后仍有重试回调到达时，会记录重试日志并累加失败次数

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 造数（填充测试数据）
```bash
npm run seed
```

### 4. 启动服务
```bash
npm start
```
服务默认运行在 http://localhost:3000

### 5. 运行测试
```bash
npm test
```

## API 接口文档

### 健康检查
```bash
curl http://localhost:3000/health
```

### 1. 创建轮换记录
```bash
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "test_app001",
    "callback_url": "https://api.example.com/callback",
    "old_signature_version": "v1",
    "new_signature_version": "v2",
    "old_key_expire_time": "2024-12-31 23:59:59",
    "operator": "admin"
  }'
```

### 2. 修改轮换记录
```bash
curl -X PUT http://localhost:3000/api/rotations/1 \
  -H "Content-Type: application/json" \
  -d '{
    "callback_url": "https://api.example.com/callback/v2",
    "old_key_expire_time": "2025-01-31 23:59:59",
    "operator": "admin",
    "remark": "调整过期时间"
  }'
```
*注意：仅未启用状态的记录可修改*

### 3. 开始灰度
```bash
curl -X POST http://localhost:3000/api/rotations/1/gray \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'
```

### 4. 审核切换
```bash
curl -X POST http://localhost:3000/api/rotations/1/approve \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'
```

### 5. 回滚
```bash
curl -X POST http://localhost:3000/api/rotations/1/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin",
    "remark": "发现兼容性问题，临时回滚"
  }'
```

### 6. 获取列表
```bash
# 获取全部
curl "http://localhost:3000/api/rotations"

# 分页查询
curl "http://localhost:3000/api/rotations?page=1&pageSize=10"

# 按应用筛选
curl "http://localhost:3000/api/rotations?app_key=test_app001"

# 按状态筛选
curl "http://localhost:3000/api/rotations?status=in_gray"
```

### 7. 获取详情
```bash
curl http://localhost:3000/api/rotations/1
```
返回内容包含操作历史和重试记录

### 8. 获取操作历史
```bash
curl http://localhost:3000/api/rotations/1/history
```

### 9. 导出CSV
```bash
curl http://localhost:3000/api/export -o signature_rotations.csv
```

### 10. 记录回调重试（内部使用）
```bash
curl -X POST http://localhost:3000/api/callback-retry \
  -H "Content-Type: application/json" \
  -d '{
    "app_key": "test_app001",
    "signature_version": "v1",
    "callback_url": "https://api.example.com/callback"
  }'
```
*当老密钥过期后仍有重试回调到达时调用此接口*

## 验收测试流程

### 完整流转测试（1条）
```bash
# 1. 创建
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -d '{"app_key":"flow_test001","callback_url":"https://flow.com/cb","old_signature_version":"v1","new_signature_version":"v2","old_key_expire_time":"2024-12-31 23:59:59","operator":"tester"}'

# 2. 开始灰度（假设返回ID为1）
curl -X POST http://localhost:3000/api/rotations/1/gray \
  -H "Content-Type: application/json" \
  -d '{"operator":"admin"}'

# 3. 审核切换
curl -X POST http://localhost:3000/api/rotations/1/approve \
  -H "Content-Type: application/json" \
  -d '{"operator":"admin"}'

# 4. 回滚
curl -X POST http://localhost:3000/api/rotations/1/rollback \
  -H "Content-Type: application/json" \
  -d '{"operator":"admin","remark":"兼容性问题"}'

# 查看详情验证完整历史
curl http://localhost:3000/api/rotations/1
```

### 冲突记录测试（1条）
```bash
# 第一次创建（成功）
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -d '{"app_key":"conflict_test001","callback_url":"https://conflict.com/cb","old_signature_version":"v1","new_signature_version":"v2","old_key_expire_time":"2024-12-31 23:59:59","operator":"tester"}'

# 第二次创建（应该失败，不能静默覆盖）
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -d '{"app_key":"conflict_test001","callback_url":"https://conflict.com/cb","old_signature_version":"v1","new_signature_version":"v2","old_key_expire_time":"2024-12-31 23:59:59","operator":"tester"}'
```

### 导入坏行测试（老密钥重试）
```bash
# 创建一条记录
curl -X POST http://localhost:3000/api/rotations \
  -H "Content-Type: application/json" \
  -d '{"app_key":"retry_test001","callback_url":"https://retry.com/cb","old_signature_version":"v1","new_signature_version":"v2","old_key_expire_time":"2024-12-31 23:59:59","operator":"tester"}'

# 模拟老密钥过期后仍有重试回调到达
curl -X POST http://localhost:3000/api/callback-retry \
  -H "Content-Type: application/json" \
  -d '{"app_key":"retry_test001","signature_version":"v1","callback_url":"https://retry.com/cb"}'

# 再次触发重试
curl -X POST http://localhost:3000/api/callback-retry \
  -H "Content-Type: application/json" \
  -d '{"app_key":"retry_test001","signature_version":"v1","callback_url":"https://retry.com/cb"}'

# 查看详情，失败次数应该变为2
curl http://localhost:3000/api/rotations/3
```

### 数据一致性验证
```bash
# 列表
curl "http://localhost:3000/api/rotations"

# 详情（取列表中的第一条ID）
curl http://localhost:3000/api/rotations/1

# 历史
curl http://localhost:3000/api/rotations/1/history

# 导出
curl http://localhost:3000/api/export
```

以上四个接口返回的数据应该互相对应。

## 项目结构
```
.
├── package.json
├── README.md
├── data/
│   └── database.db    # SQLite数据库文件
├── src/
│   ├── app.js         # 应用入口
│   ├── db.js          # 数据库连接
│   ├── service.js     # 业务逻辑
│   └── routes.js      # 路由定义
└── scripts/
    ├── init-db.js     # 数据库初始化脚本
    ├── seed.js        # 造数脚本
    └── test.js        # 测试脚本
```
