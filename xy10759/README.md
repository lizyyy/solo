# 电子签署流程台

一个面向技术向的全栈练习项目，模拟电子签署中的异常处理流程。

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py    # Flask API 应用
│   │   └── models.py      # 数据模型定义
│   ├── requirements.txt    # Python 依赖
│   └── run.py             # 启动脚本
├── frontend/
│   └── index.html         # 前端页面（纯HTML+JS）
├── database/              # SQLite 数据库目录
└── README.md
```

## 功能特性

### 后端 (Python Flask)
- **合同管理**：创建、查看合同，维护版本历史
- **签署人管理**：录入签署人信息，维护签署顺序
- **异常处理**：记录和处理各类签署异常
  - `dirty_data` - 脏数据（格式错误）
  - `sms_blocked` - 短信验证被拦截
  - `recall_reissue` - 撤回重签
- **证据链管理**：记录签署操作日志，维护证据哈希

### 前端
- **异常列表页**：展示所有异常，支持跳转到详情
- **异常详情页**：
  - 展示异常基本信息（谁处理、何时处理、为什么处理）
  - 原始数据标签页：展示脏数据详情
  - 签署人信息标签页：对比原始输入和处理结果
  - 合同版本标签页：展示版本变更历史
- **操作按钮**：标记已解决、重试签署、回滚
- **权限提示**：业务分析师角色操作提醒
- **证据链页面**：时间线展示操作日志和证据数据

## 快速开始

### 1. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
python -m app.__init__
```

后端将在 `http://localhost:5000` 启动。

### 2. 打开前端

直接在浏览器中打开 `frontend/index.html` 文件。

### 3. 初始化样例数据

点击导航栏的"初始化样例数据"按钮，将自动创建：
- 2 个合同（其中1个有3个版本）
- 5 个签署人（包含脏数据、正常签署、失败、撤回等状态）
- 3 个异常样例：
  - 脏数据：电话号码含字母、邮箱格式错误
  - 短信被拦截：运营商拦截场景
  - 撤回重签：合同条款变更后重新签署

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/contracts | 获取所有合同 |
| GET | /api/contracts/:id | 获取合同详情（含版本、签署人） |
| POST | /api/contracts | 创建新合同 |
| POST | /api/contracts/:id/signers | 添加签署人 |
| POST | /api/contracts/:id/start | 开始签署流程 |
| GET | /api/exceptions | 获取所有异常 |
| GET | /api/exceptions/:id | 获取异常详情 |
| POST | /api/exceptions/:id/handle | 处理异常 |
| POST | /api/exceptions/:id/retry | 重试签署 |
| POST | /api/exceptions/:id/rollback | 回滚操作 |
| GET | /api/signers/:id/evidence | 获取签署人证据链 |
| POST | /api/init-sample-data | 初始化样例数据 |

## 数据模型

### Contract (合同)
- id, title, content, version, status, created_by, created_at, updated_at

### Signer (签署人)
- id, contract_id, name, phone, email, order, status
- original_input (原始输入JSON)
- processed_result (处理结果JSON)
- signed_at, created_at, updated_at

### ContractVersion (合同版本)
- id, contract_id, version, content, change_log, created_by, created_at

### SignException (签署异常)
- id, contract_id, signer_id, type, status, description
- raw_data (原始数据JSON)
- handled_by, handled_at, handling_notes
- created_at, updated_at

### SignLog (签署日志)
- id, signer_id, action, detail, ip_address, user_agent, evidence_hash, created_at

### SignEvidence (签署证据)
- id, contract_id, signer_id, evidence_type, evidence_data, evidence_hash, timestamp

## 练习扩展建议

1. **添加用户认证**：实现登录、权限控制
2. **完善合同管理**：添加合同编辑、版本对比功能
3. **短信服务集成**：对接真实短信服务商API
4. **添加WebSocket**：实时更新异常状态
5. **数据导出**：导出异常报告、证据链
6. **单元测试**：为API和业务逻辑编写测试
7. **Docker化**：容器化部署
