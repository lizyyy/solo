# 大文件分片上传 API

## 项目简介

解决客户上传几百 MB 对账文件时经常断网、重新上传浪费时间的问题。

## 功能特性

- 创建上传会话
- 上传分片（支持断点续传）
- 查看已收分片
- 完成合并
- 取消上传
- 清理过期会话
- 分片重复幂等处理
- 分片乱序支持
- 分片大小校验
- 总校验和验证

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/upload/sessions | 创建上传会话 |
| POST | /api/upload/sessions/:id/chunks/:n | 上传第 n 个分片 |
| GET | /api/upload/sessions/:id | 查看会话状态 |
| GET | /api/upload/sessions | 列出所有会话 |
| POST | /api/upload/sessions/:id/complete | 完成合并 |
| POST | /api/upload/sessions/:id/cancel | 取消上传 |
| POST | /api/upload/cleanup | 清理过期会话 |
| GET | /api/upload/sessions/:id/chunks | 查看分片记录 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成测试文件

```bash
node scripts/generateTestFiles.js
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 4. 使用 curl 测试

#### 4.1 正常上传流程

```bash
# 1. 创建上传会话
curl -X POST http://localhost:3000/api/upload/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test_file.txt",
    "fileSize": 10240,
    "totalChunks": 4,
    "chunkSize": 3072,
    "fileHash": "替换为脚本输出的文件哈希"
  }'

# 2. 上传所有分片（替换 SESSION_ID）
# 分片 1
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/1 \
  -F "chunk=@test_files/chunk_1" \
  -F "chunkHash=替换为分片1的哈希"

# 分片 2
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/2 \
  -F "chunk=@test_files/chunk_2" \
  -F "chunkHash=替换为分片2的哈希"

# 分片 3
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/3 \
  -F "chunk=@test_files/chunk_3" \
  -F "chunkHash=替换为分片3的哈希"

# 分片 4
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/4 \
  -F "chunk=@test_files/chunk_4" \
  -F "chunkHash=替换为分片4的哈希"

# 3. 查看会话状态
curl http://localhost:3000/api/upload/sessions/SESSION_ID

# 4. 完成上传
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/complete
```

## 复现断网续传场景

### 场景说明

模拟上传过程中断网，然后从断点继续上传。

### 复现步骤

```bash
# 1. 创建会话
SESSION_ID=$(curl -s -X POST http://localhost:3000/api/upload/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test_file.txt",
    "fileSize": 10240,
    "totalChunks": 4,
    "chunkSize": 3072,
    "fileHash": "替换为文件哈希"
  }' | jq -r '.sessionId')

echo "Session ID: $SESSION_ID"

# 2. 只上传分片 1 和 3（模拟断网，跳过分片 2）
curl -X POST http://localhost:3000/api/upload/sessions/$SESSION_ID/chunks/1 \
  -F "chunk=@test_files/chunk_1" \
  -F "chunkHash=替换为分片1的哈希"

curl -X POST http://localhost:3000/api/upload/sessions/$SESSION_ID/chunks/3 \
  -F "chunk=@test_files/chunk_3" \
  -F "chunkHash=替换为分片3的哈希"

# 3. 查看会话状态（发现缺少分片 2 和 4）
curl http://localhost:3000/api/upload/sessions/$SESSION_ID

# 4. 断点续传：上传缺失的分片 2 和 4
curl -X POST http://localhost:3000/api/upload/sessions/$SESSION_ID/chunks/2 \
  -F "chunk=@test_files/chunk_2" \
  -F "chunkHash=替换为分片2的哈希"

curl -X POST http://localhost:3000/api/upload/sessions/$SESSION_ID/chunks/4 \
  -F "chunk=@test_files/chunk_4" \
  -F "chunkHash=替换为分片4的哈希"

# 5. 再次查看状态（所有分片已接收）
curl http://localhost:3000/api/upload/sessions/$SESSION_ID

# 6. 完成上传
curl -X POST http://localhost:3000/api/upload/sessions/$SESSION_ID/complete
```

## 边界情况测试

### 1. 重复分片幂等

```bash
# 上传分片 1（第一次）
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/1 \
  -F "chunk=@test_files/chunk_1" \
  -F "chunkHash=分片1哈希"

# 再次上传分片 1（应返回"已存在，跳过重复上传"）
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/1 \
  -F "chunk=@test_files/chunk_1" \
  -F "chunkHash=分片1哈希"
```

### 2. 坏分片拒绝

```bash
# 上传错误哈希的分片（应拒绝）
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/1 \
  -F "chunk=@test_files/chunk_1" \
  -F "chunkHash=00000000000000000000000000000000"
```

### 3. 取消会话后再次上传

```bash
# 1. 创建会话
# 2. 上传分片 1
# 3. 取消会话
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/cancel

# 4. 尝试继续上传（应提示重新创建会话，返回 410）
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/2 \
  -F "chunk=@test_files/chunk_2" \
  -F "chunkHash=分片2哈希"
```

### 4. 完成后再次提交

```bash
# 1. 创建会话并上传所有分片
# 2. 完成上传
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/complete

# 3. 再次完成（应提示已完成）
curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/complete
```

## 会话查询结果说明

查询会话时返回以下信息：

- `progress`: 上传进度百分比
- `receivedChunks`: 已接收的分片编号列表
- `missingChunks`: 缺失的分片编号列表
- `lastError`: 最后一次错误信息
- `expiresAt`: 会话过期时间

## 补充说明

### 主要边界情况

1. **分片编号越界**：分片编号 < 1 或 > 总分片数时拒绝
2. **分片大小不一致**：每个分片大小必须符合约定
3. **分片哈希不匹配**：传输过程中损坏的分片会被拒绝
4. **会话过期**：24 小时后会话过期，需重新创建
5. **总校验和不匹配**：合并后验证文件完整性

### 一个失败路径

1. 创建会话
2. 上传分片 1（成功）
3. 上传分片 2（错误哈希，失败，记录错误）
4. 查看会话状态（看到 lastError）
5. 重新上传正确的分片 2（成功）
6. 上传分片 3（成功）
7. 上传分片 4（成功）
8. 完成合并（总校验和匹配，成功）

### 一次重复执行路径

1. 创建会话
2. 上传分片 1（成功）
3. 再次上传分片 1（幂等，提示已存在）
4. 上传分片 2（成功）
5. 查看状态（进度 50%）
6. 模拟断网，暂停上传
7. 恢复网络后查看状态（仍为 50%）
8. 上传分片 3（成功）
9. 再次上传分片 2（幂等，提示已存在）
10. 上传分片 4（成功）
11. 完成合并（成功）

## 项目结构

```
.
├── src/
│   ├── server.js          # 主服务入口
│   ├── routes/
│   │   └── uploadRoutes.js # API 路由
│   ├── services/
│   │   └── uploadService.js # 核心业务逻辑
│   └── utils/
│       └── fileUtils.js    # 文件工具函数
├── scripts/
│   └── generateTestFiles.js # 测试文件生成脚本
├── test_files/             # 测试文件目录
├── uploads/               # 上传文件目录
│   ├── sessions/          # 会话数据
│   └── completed/         # 完成的文件
└── package.json
```
