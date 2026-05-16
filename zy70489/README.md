# 依赖探活命令行工具

## 项目概述

这是一个功能完整的依赖探活命令行工具，支持DNS、TCP端口和HTTP服务的健康检查，并提供了采购询价单的数据管理和并发冲突模拟功能。

## 启动方式

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 运行CLI工具

```bash
# 查看帮助
node dist/cli.js --help

# 查看具体命令帮助
node dist/cli.js probe-dns --help
```

## 主要功能

### 1. 依赖探活功能

#### DNS探活
```bash
node dist/cli.js probe-dns --host www.baidu.com
```

#### TCP端口探活
```bash
node dist/cli.js probe-tcp --host 127.0.0.1 --port 8080
```

#### HTTP服务探活
```bash
node dist/cli.js probe-http --url https://www.baidu.com
```

**错误类型区分:**
- `dns`: DNS解析失败（域名不存在、超时等）
- `port`: 端口连接失败（连接被拒绝、主机不可达等）
- `business`: 业务响应异常（HTTP状态码非预期、超时等）

**返回码说明:**
- `0`: 探活成功
- `1`: 探活失败
- `2`: 命令执行错误

### 2. 采购询价单数据管理

#### 初始化测试数据
```bash
node dist/cli.js init-data
```

**样例来源:**
数据包含5条真实业务场景的采购询价单：
1. 服务器CPU采购（深圳市华星电子科技有限公司）
2. DDR4服务器内存采购（北京创新精密部件有限公司）
3. 企业级固态硬盘采购（上海科创信息技术有限公司）
4. 万兆以太网交换机采购（广州市鑫科网络设备有限公司）
5. 企业级路由器采购（杭州云存储技术有限公司）

每条数据包含：询价单号、供应商、材料名称、数量、单价、总价、状态、权限临时票等字段。

#### 列出所有询价单
```bash
node dist/cli.js list-inquiries
```

### 3. 并发写入测试

```bash
# 首先获取询价单ID
node dist/cli.js list-inquiries

# 执行并发写入测试
node dist/cli.js concurrent-test --id <inquiryId>
```

**功能说明:**
- 模拟3个并发请求同时写入同一条询价单
- 每个请求设置不同的状态和权限票
- 最终数据会被最后完成的请求覆盖
- 系统保留所有处理记录，可以查看并发冲突历史

### 4. 处理询价单

```bash
node dist/cli.js process --id <inquiryId> --conclusion pass --reason "材料审核通过"
```

### 5. 人工修正功能

```bash
# 仅修正结论
node dist/cli.js correct \
  --id <inquiryId> \
  --conclusion pass \
  --reason "经复核，材料符合要求" \
  --operator "张三" \
  --remark "修正并发写入导致的错误状态"

# 同时修正结论和权限临时票
node dist/cli.js correct \
  --id <inquiryId> \
  --conclusion pass \
  --reason "经复核，材料符合要求" \
  --operator "张三" \
  --remark "修正并发写入导致的错误状态" \
  --permission-ticket "PERM-2024-0515-001"
```

**重要特性:**
- 人工修正不会覆盖原有处理记录
- 系统会记录变更前后的结论和原因
- 支持更新权限临时票，并记录变更前后的值
- 保留操作人信息和修正备注
- 所有历史记录可追溯

### 6. 生成材料摘要

```bash
node dist/cli.js summary --id <inquiryId>
```

**权限临时票变更记录:**
摘要中会包含权限临时票的完整变更历史，并根据实际状态动态显示结论：

**场景1: 未执行人工修正**
```
【权限临时票变更记录】
  - 变更前: PERM-2024-0515-001
  - 变更后: PERM-CONCURRENT-2
  - 异常: 权限临时票在并发写入时被覆盖，导致权限验证失败
  - 修正: 尚未执行人工修正
  - 结论: 未修正，权限票仍为并发覆盖状态
```

**场景2: 已执行人工修正并恢复正常**
```
【权限临时票变更记录】
  - 变更前: PERM-2024-0515-001
  - 变更后: PERM-2024-0515-001
  - 异常: 权限临时票在并发写入时被覆盖，导致权限验证失败
  - 修正: 已执行人工修正权限票状态
  - 结论: 已修正，权限票已恢复正常
```

**场景3: 已执行修正但仍保留并发测试值**
```
【权限临时票变更记录】
  - 变更前: PERM-2024-0515-001
  - 变更后: PERM-CONCURRENT-2
  - 异常: 权限临时票在并发写入时被覆盖，导致权限验证失败
  - 修正: 已执行人工修正权限票状态
  - 结论: 已修正，但权限票仍为并发测试值
```

### 7. 统一查询入口

#### ✨ 询价单处理状态概览（统一入口）
```bash
# 查看所有询价单的处理状态概览
node dist/cli.js list-overview
```
**功能说明：**
- 显示所有询价单基本信息
- 显示处理记录数
- 标记是否有过人工修正
- 标记是否已生成摘要
- 高亮显示并发测试状态的权限票

#### ✨ 查看完整处理历史（成功/异常路径统一展示）
```bash
# 查看单个询价单的完整处理链路
node dist/cli.js query-history --id <inquiryId>
```
**功能说明：**
- 统一展示询价单基本信息
- 列出所有处理记录（系统处理 + 人工修正）
- 自动识别并标记路径类型：
  - ✅ 成功路径 - 正常流程处理
  - ⚠️ 异常路径 - 并发写入
  - 🛠️ 人工修正路径 - 审计追踪
- 展示权限票变更历史
- 展示完整材料摘要
- 底部统计系统处理次数和人工修正次数

#### 查询探活结果
```bash
# 查询所有结果
node dist/cli.js query-probes

# 只查询失败的结果
node dist/cli.js query-probes --status failure

# 只查询成功的结果
node dist/cli.js query-probes --status success
```

#### 列出所有询价单
```bash
node dist/cli.js list-inquiries
```

#### 列出所有摘要
```bash
node dist/cli.js list-summaries
```

## 可复跑处理链路

### 幂等初始化
```bash
# init-data 命令支持重复执行，不会因为唯一约束报错
node dist/cli.js init-data
```
**实现方式：**
- 执行前先清除所有旧数据（采购询价单、处理结论、材料摘要）
- 重新生成5条测试数据
- 保证每次运行后状态一致，便于重复测试

### 完整复跑链路示例
```bash
# 第1次运行 - 初始化
node dist/cli.js init-data
# 执行测试...

# 第2次运行 - 重新初始化（不会报错）
node dist/cli.js init-data
# 再次执行测试...
```

## 主流程

### 正常处理流程

```
1. 初始化采购询价单数据
   ↓
2. 依赖探活（DNS/TCP/HTTP）
   ↓
3. 处理询价单（通过/拒绝/复核）
   ↓
4. 生成材料摘要
   ↓
5. 查询历史记录
```

### 异常处理流程

```
1. 并发写入测试 → 产生数据覆盖问题
   ↓
2. 发现权限临时票异常
   ↓
3. 人工修正处理结论
   ↓
4. 系统保留历史变更痕迹
   ↓
5. 摘要中展示完整的异常-修正-结论链路
```

## 失败路径说明

### 1. DNS探活失败场景

**可能原因:**
- 域名不存在：`ENOTFOUND`
- DNS查询超时
- DNS服务器拒绝连接

**错误提示示例:**
```
✗ DNS-www.nonexistent-domain-test.com - 失败
   错误类型: DNS
   错误信息: DNS解析失败: 域名 www.nonexistent-domain-test.com 不存在
   响应时间: 123ms
```

### 2. TCP端口探活失败场景

**可能原因:**
- 端口未监听：`ECONNREFUSED`
- 主机不可达：`EHOSTUNREACH`
- 网络不可达：`ENETUNREACH`
- 连接超时

**错误提示示例:**
```
✗ TCP-127.0.0.1:9999 - 失败
   错误类型: PORT
   错误信息: 端口连接被拒绝: 127.0.0.1:9999 服务未监听
   响应时间: 5ms
```

### 3. HTTP服务探活失败场景

**可能原因:**
- 服务未启动（底层表现为TCP连接失败）
- HTTP状态码非预期（如404、500）
- 请求超时
- 业务逻辑异常

**错误提示示例:**
```
✗ HTTP-https://httpbin.org/status/500 - 失败
   错误类型: BUSINESS
   错误信息: 业务响应异常: 期望状态码 200, 实际 500
   响应时间: 256ms
```

### 4. 并发写入冲突场景

**现象:**
- 同一条询价单被多次处理
- 状态字段被覆盖
- 权限临时票被覆盖
- 但所有处理记录都保留在数据库中

**检测方式:**
- 查询处理记录数：`处理记录数: 3`
- 摘要中会显示：`⚠️ 注意: 存在并发写入记录`

## 数据持久化

系统使用SQLite数据库存储所有数据，本地重启后数据不会丢失：

- `probe_results`: 探活结果记录
- `purchase_inquiries`: 采购询价单主数据
- `processing_conclusions`: 处理结论历史（包含人工修正记录）
- `material_summaries`: 材料摘要记录

数据库文件默认为 `probe.db`，位于当前工作目录。

## 项目结构

```
.
├── src/
│   ├── cli.ts           # CLI入口文件
│   ├── database.ts      # 数据库操作层
│   ├── prober.ts        # 探活核心逻辑
│   ├── inquiryProcessor.ts  # 询价单处理逻辑
│   └── types.ts         # TypeScript类型定义
├── dist/                # 编译输出目录
├── package.json
├── tsconfig.json
└── README.md
```

## 注意事项

1. **并发写入测试仅用于演示**，生产环境应使用乐观锁或分布式锁
2. **人工修正功能保留完整审计 trail**，符合企业级数据管理要求
3. **所有探活结果都会持久化**，便于后续分析和问题排查
4. **返回码设计符合Unix命令行规范**，便于集成到脚本和监控系统
5. **错误信息清晰明确**，可以快速定位问题类型和原因
