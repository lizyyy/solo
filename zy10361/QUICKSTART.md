# 🚀 快速开始指南

## 环境要求
- JDK 8 或更高版本
- curl (用于测试 API)

## 三步启动服务

### 第一步：执行快速启动脚本
```bash
# 赋予执行权限
chmod +x quick-start.sh remove-lombok.sh test-full.sh

# 启动服务（会自动处理依赖、编译、启动）
./quick-start.sh
```

首次启动会：
1. ✅ 移除 Lombok 依赖（兼容所有 JDK）
2. ✅ 设置 Java 8 编译模式
3. ✅ 自动下载和配置 Maven
4. ✅ 清理旧编译文件
5. ✅ 编译并启动服务

等待看到类似以下日志表示启动成功：
```
Started CompensationApplication in X.XXX seconds
Tomcat started on port(s): 8080 (http)
```

---

### 第二步：打开另一个终端，运行完整测试
```bash
./test-full.sh
```

这个测试会自动验证所有核心功能：

| 测试项 | 说明 |
|--------|------|
| ✅ 创建补偿流程 | 批量创建 2 个失败节点、4 条补偿指令 |
| ✅ 幂等性测试 | 重复创建相同流程，验证不产生脏数据 |
| ✅ 查看流程详情 | 验证所有数据正确保存 |
| ✅ 启动补偿流程 | 状态从 FAILED → COMPENSATING |
| ✅ 获取下一条指令 | 验证只返回顺序 1 的指令 |
| ✅ 顺序控制测试 | 尝试跳过前序执行指令 3，验证被拦截 |
| ✅ 人工确认 | 确认需要人工审核的指令 2 |
| ✅ 执行指令 | 按顺序执行指令 1、2、4 |
| ✅ 重试机制 | 连续 3 次强制失败指令 3，验证重试逻辑 |
| ✅ 历史查询 | 验证流程状态和执行统计 |
| ✅ 导出一致性 | 两次导出结果完全一致 |

---

### 第三步：手动测试（可选）

服务启动后，可以手动执行以下 curl 命令：

#### 1. 创建补偿流程
```bash
curl -X POST http://localhost:8080/api/v1/compensation \
  -H "Content-Type: application/json" \
  -d @src/test/resources/test-request.json
```

#### 2. 启动补偿
```bash
curl -X POST http://localhost:8080/api/v1/compensation/ORDER-TEST-001/start
```

#### 3. 获取下一条可执行指令
```bash
curl http://localhost:8080/api/v1/compensation/ORDER-TEST-001/next
```

#### 4. 执行指令（成功）
```bash
curl -X POST http://localhost:8080/api/v1/compensation/instruction/INST-ORDER-TEST-001-1/execute \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-001","executor":"tester"}'
```

#### 5. 执行指令（强制失败，测试重试）
```bash
curl -X POST http://localhost:8080/api/v1/compensation/instruction/INST-ORDER-TEST-001-3/execute \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-003","executor":"tester","forceFail":true}'
```

#### 6. 查询历史记录
```bash
curl http://localhost:8080/api/v1/compensation/history
```

#### 7. 导出执行报告
```bash
curl http://localhost:8080/api/v1/compensation/ORDER-TEST-001/export
```

---

## 核心功能验证要点

### ✅ 1. 幂等性验证
- 重复创建相同 `processId` → 返回已有数据，不新建
- 重复提交相同 `executionId` → 返回幂等处理，不重复执行

### ✅ 2. 顺序控制验证
- `/next` 只返回最小的、可执行的 `executionOrder`
- 跳步执行会返回错误：`前序指令未完成`

### ✅ 3. 失败原因可追溯
- 状态错误：`当前状态不允许执行，状态: WAITING_MANUAL_CONFIRM`
- 前序依赖：`前序指令未完成: INST-XXX (顺序: 1, 状态: PENDING)`

### ✅ 4. 重试机制
- 失败 1-2 次：状态回到 PENDING，`retryCount` +1
- 失败 ≥ maxRetry 次：状态变为 FAILED

### ✅ 5. 导出一致性
- 同一流程多次导出，内容完全相同
- 导出报告包含：流程信息、执行汇总、失败节点详情、每条指令执行记录

---

## 常见问题

### Q: 启动时提示 "Permission denied"
A: 执行 `chmod +x *.sh` 赋予脚本执行权限

### Q: Maven 下载慢
A: 可以配置国内镜像，在 `~/.m2/settings.xml` 中添加阿里云镜像

### Q: 8080 端口被占用
A: 修改 `src/main/resources/application.yml` 中的 `server.port`

### Q: 如何停止服务
A: 按 `Ctrl + C` 停止启动脚本中的服务

---

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/compensation` | 创建补偿流程 |
| GET | `/api/v1/compensation/{processId}` | 查看流程详情 |
| POST | `/api/v1/compensation/{processId}/start` | 启动补偿流程 |
| POST | `/api/v1/compensation/instruction/{id}/confirm` | 人工确认指令 |
| POST | `/api/v1/compensation/instruction/{id}/execute` | 执行补偿指令 |
| GET | `/api/v1/compensation/{processId}/next` | 获取下一条可执行指令 |
| GET | `/api/v1/compensation/history` | 查询历史记录 |
| GET | `/api/v1/compensation/{processId}/export` | 导出执行报告 |
