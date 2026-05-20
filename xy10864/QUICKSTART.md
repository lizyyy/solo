# 快速启动指南

## 📋 前置准备检查清单

### ✅ 依赖已安装状态

- [x] **前端依赖**: 已安装 (162 packages)
- [x] **TypeScript 编译**: 已验证通过
- [x] **后端依赖**: 已安装 (23 packages)

### ⚠️ 需要准备

- **MongoDB**: 需要本地 MongoDB 服务运行在 `mongodb://localhost:27017`

---

## 🚀 启动项目

### 方式一：手动启动（推荐）

#### 1. 启动 MongoDB（如果未启动）

**MacOS (brew):**
```bash
brew services start mongodb-community
```

**或使用 Docker:**
```bash
docker run -d -p 27017:27017 --name mongo-incident mongo:latest
```

#### 2. 启动后端服务 (端口 3001)

```bash
cd backend
npm start
# 或开发模式: npm run dev
```

#### 3. 启动前端服务 (端口 3000)

```bash
cd frontend
npm run dev
```

#### 4. 访问页面

打开浏览器访问: **http://localhost:3000**

---

### 方式二：快速启动脚本

```bash
# 后端
cd backend && npm start &

# 前端（新开终端）
cd frontend && npm run dev
```

---

## ✅ 验证流程（验收步骤）

### 1. 基础功能验证

1. **创建事故单**
   - 点击「新建事故单」按钮
   - 填写标题、描述、选择严重程度
   - 填写发现人、责任人
   - 提交，验证创建成功

2. **推进状态**
   - 进入详情页
   - 依次点击「推进到：验证中」→「推进到：修复中」→ 等
   - 验证：状态严格按流程推进，不允许跳步

3. **尝试跳步（验证规则）**
   - 创建新事故（状态：发现中）
   - 直接调用 API 尝试推进到「修复中」
   - 预期：返回 400 错误，提示非法状态转换

### 2. 幂等性验证

1. **重复提交时间线**
   - 添加一条时间线事件
   - 立即再次提交相同内容
   - 预期：返回 409 错误，提示重复

2. **重复添加相同证据**
   - 添加一条证据，URL 设为 `http://test.com`
   - 再次添加相同 URL 的证据
   - 预期：返回 409 错误

3. **行动项同状态更新**
   - 创建一个行动项，状态：pending
   - 再次设置状态为 pending
   - 预期：返回 409 跳过，时间线不重复记录

### 3. 失败原因追溯验证

1. 添加失败原因时填写：
   - 原因描述
   - 记录人
   - 分类（可选）

2. 验证列表显示：
   - 分类标签
   - 记录人姓名
   - 记录时间

### 4. 导出功能验证

1. 在详情页点击「导出Excel」
2. 打开下载的文件
3. 验证包含以下 Sheet：
   - 基本信息
   - 影响接口
   - 证据链
   - 时间线
   - 行动项
   - 失败原因追溯
   - 手动补偿记录
   - 复盘结论

---

## 🔧 API 测试命令

### 创建事故单
```bash
curl -X POST http://localhost:3001/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "支付系统超时",
    "description": "用户反馈支付页面加载缓慢，部分订单超时",
    "severity": "high",
    "startTime": "2024-01-15T10:00:00.000Z",
    "detectedBy": "张三",
    "owner": "李四"
  }'
```

### 推进状态（验证合法）
```bash
# 替换 {id} 为实际 ID
curl -X PATCH http://localhost:3001/api/incidents/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"verifying","operator":"张三","reason":"已确认问题存在"}'
```

### 尝试非法跳步（预期失败）
```bash
curl -X PATCH http://localhost:3001/api/incidents/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"fixing","operator":"张三"}'
# 预期返回 400: Invalid status transition
```

### 添加失败原因
```bash
curl -X POST http://localhost:3001/api/incidents/{id}/failure-reason \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Redis 连接池耗尽，导致请求排队超时",
    "operator": "王五",
    "category": "基础设施"
  }'
```

### 导出 Excel
```bash
curl -O -J http://localhost:3001/api/incidents/{id}/export
```

---

## 📊 项目端口

| 服务 | 端口 | 地址 |
|------|------|------|
| 前端 | 3000 | http://localhost:3000 |
| 后端 | 3001 | http://localhost:3001 |
| MongoDB | 27017 | mongodb://localhost:27017 |

---

## 🐛 常见问题

### Q: 后端启动报错 "MongoDB connection error"
**A**: 检查 MongoDB 是否启动：
```bash
# MacOS
brew services list | grep mongo

# 或检查端口
lsof -i :27017
```

### Q: 前端启动后页面空白
**A**: 检查后端是否启动，或者查看浏览器控制台错误

### Q: TypeScript 编译报错
**A**: 重新安装依赖：
```bash
cd frontend && rm -rf node_modules && npm install
```
