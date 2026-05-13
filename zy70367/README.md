# 用户导入撤销 API

一个完整的用户批量导入和撤销管理系统，支持：
- 创建导入批次
- 预检用户数据（发现已存在用户、角色/部门缺失等）
- 确认导入（创建新用户，更新老用户）
- 绑定部门和角色
- 撤销整批或单个用户
- 生成详细报告
- 支持幂等操作
- 保护导入前已存在的用户

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译项目

```bash
npm run build
```

### 启动服务

```bash
npm start
# 或开发模式
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 运行演示脚本

```bash
chmod +x scripts/demo.sh
./scripts/demo.sh
```

## API 接口

### 参考数据

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/reference/departments` | 获取部门列表 |
| GET | `/api/reference/roles` | 获取角色列表 |

### 导入管理

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/api/import/batches` | 创建导入批次 |
| GET | `/api/import/batches` | 获取所有批次 |
| GET | `/api/import/batches/:id` | 获取批次详情 |
| POST | `/api/import/batches/:id/precheck` | 预检批次 |
| POST | `/api/import/batches/:id/confirm` | 确认导入 |

### 撤销管理

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/revoke/batches/:id/can-revoke` | 检查可撤销状态 |
| POST | `/api/revoke/batches/:id/revoke` | 撤销整批 |
| POST | `/api/revoke/batches/:id/revoke/:email` | 撤销单个用户 |

### 报告与查询

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/api/report/batches/:id/report` | 获取批次报告 |
| GET | `/api/report/users` | 获取所有用户（含批次来源） |
| GET | `/api/report/users/:email` | 获取用户详情 |
| GET | `/api/report/batches/:id/reimport-context` | 获取重新导入上下文 |

## 核心特性

### 1. 用户保护机制

- **导入前已存在的用户**：标记为 `isPreExisting=true`，撤销时**永不删除**
- **老用户更新**：保存原角色快照，撤销时恢复原角色，不删除用户
- **新创建用户**：撤销时物理删除

### 2. 撤销幂等性

- 并发请求保护（`processingBatches` Set）
- 已撤销批次再次撤销返回相同结果
- 已撤销用户再次撤销返回 `already_revoked` 状态

### 3. 补偿机制

- 角色绑定失败时，仍创建用户但角色为空
- 撤销时正确处理这种部分成功状态
- 记录详细的补偿操作日志

### 4. 详细报告

- 显示每个用户的导入状态（CREATED/UPDATED/SKIPPED/FAILED）
- 显示撤销结果（REVOKED/NOT_REVOCABLE/REVOKE_FAILED）
- 明确标注哪些用户可以撤销，哪些不能
- 提供重新导入上下文，复用上次的错误信息

## 内置样例数据

### 预置用户（老员工，originalUser=true）

| 邮箱 | 姓名 | 部门 | 角色 |
|-----|-----|------|------|
| wanggang@company.com | 王刚 | 技术部 | 经理、开发人员 |
| liming@company.com | 李明 | 人力资源部 | HR管理员 |
| zhangwei@company.com | 张伟 | 财务部 | 财务人员 |

### 可用部门

- 技术部 (dept-tech)
- 人力资源部 (dept-hr)
- 财务部 (dept-finance)
- 市场部 (dept-marketing)
- 运营部 (dept-ops)

### 可用角色

- 管理员 (role-admin)
- 经理 (role-manager)
- 开发人员 (role-developer)
- HR管理员 (role-hr-admin)
- 财务人员 (role-finance)
- 市场人员 (role-marketing)
- 运营人员 (role-operator)
- 实习生 (role-intern)

## 补充文档

详细的边界条件、失败路径和重复执行路径说明请参见：
[SUPPLEMENT_NOTES.md](./SUPPLEMENT_NOTES.md)
