# 开发者访问申请台

外包协作开发者访问凭证管理系统

## ✅ 问题修复记录（第二轮）

### 1. SQLite 数据库路径修复
**问题**: 使用相对路径 `sqlite:///./dev_access.db`，在只读环境或不同工作目录下启动时报 `sqlite3.OperationalError: unable to open database file`

**修复**: 
- 使用绝对路径，基于 `database.py` 文件位置动态计算
- 添加目录可写性检查
- 提供内存数据库作为备选方案（目录不可写时自动降级）

**修改文件**: [backend/app/database.py](file:///Users/mac/pro/solo/workspaces/xy10897/backend/app/database.py)


### 2. 延迟数据库表创建
**问题**: 导入 `main.py` 时立即执行 `models.Base.metadata.create_all(bind=engine)`，导入即触发数据库操作

**修复**: 将数据库初始化和表创建移到 FastAPI lifespan 中，应用启动时才执行

**修改文件**: [backend/main.py](file:///Users/mac/pro/solo/workspaces/xy10897/backend/main.py#L37-L61)


### 3. 启动前验证测试
**问题**: 无法确认项目是否真的可安装、可运行、可验证

**修复**: 更新 `start.sh` 启动脚本，启动前先运行 `test_verification.py` 验证所有功能

**修改文件**:
- [start.sh](file:///Users/mac/pro/solo/workspaces/xy10897/start.sh)
- [backend/test_verification.py](file:///Users/mac/pro/solo/workspaces/xy10897/backend/test_verification.py)


## ✅ 问题修复记录（第一轮）

### 1. Pydantic 2.x 兼容性修复
**问题**: schemas.py 使用 `orm_mode = True`（Pydantic 1.x 语法），在 Pydantic 2.5.0 中失效

**修复**: 改为 Pydantic 2.x 标准语法 `model_config = {"from_attributes": True}`

**修改文件**: [backend/app/schemas.py](file:///Users/mac/pro/solo/workspaces/xy10897/backend/app/schemas.py)


### 2. 前端表单提交处理修复
**问题**: applicationForm 和 testAccessForm 缺少 submit 事件处理，用户无法提交申请或进行访问测试

**修复**: 添加 `submitApplication()` 和 `testAccess()` 函数处理表单提交，并在 DOMContentLoaded 时绑定事件

**修改文件**: [frontend/app.js](file:///Users/mac/pro/solo/workspaces/xy10897/frontend/app.js)


### 3. 自动到期回收机制
**问题**: 到期回收不是自动机制，需要手动触发

**修复**: 使用 FastAPI lifespan 添加后台任务 `auto_expire_credentials()`，每分钟自动检查并回收过期凭证

**修改文件**: [backend/main.py](file:///Users/mac/pro/solo/workspaces/xy10897/backend/main.py)


### 4. 演示数据 - 真正已过期凭证
**问题**: `createExpiredCredential` 只创建 7 天后过期的凭证，没有真正的过期回收流水

**修复**: 添加 `create_expired_credential_demo()` 服务函数，创建过期时间为昨天的凭证，并自动生成"签发"和"过期"两条审计日志

**修改文件**:
- [backend/app/services.py](file:///Users/mac/pro/solo/workspaces/xy10897/backend/app/services.py)
- [backend/main.py](file:///Users/mac/pro/solo/workspaces/xy10897/backend/main.py)
- [frontend/app.js](file:///Users/mac/pro/solo/workspaces/xy10897/frontend/app.js)


## 功能特性

- **申请管理**: 开发者申请接口访问权限，选择权限范围和有效期
- **审批流程**: 管理员审批申请，自动校验权限范围
- **凭证签发**: 审批通过后自动生成 API Key 和 Secret
- **访问审计**: 记录所有 API 访问和操作日志
- **凭证回收**: 支持提前撤销和**自动过期回收**（后台任务每分钟检查）
- **完整链路追踪**: 查看凭证从申请到回收的完整审计链路

## 四类演示场景

1. **正常申请流程**: 张三申请用户和订单读取权限 → 审批通过 → 生成凭证
2. **超范围被拒**: 李四申请包含无效权限范围 → 自动拒绝
3. **提前撤销**: 王五的凭证在项目结束后提前回收
4. **到期回收**: 赵六的短期测试凭证**已过期**，已自动回收

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py      # 数据库配置
│   │   ├── models.py        # 数据模型
│   │   ├── schemas.py       # Pydantic 模式（Pydantic 2.x 兼容）
│   │   ├── auth.py          # 认证工具
│   │   └── services.py      # 业务逻辑（含自动回收逻辑）
│   ├── main.py              # FastAPI 主应用（含后台任务）
│   ├── test_verification.py # 验证测试脚本
│   └── requirements.txt
├── frontend/
│   ├── index.html           # 管理后台界面
│   └── app.js               # 前端交互逻辑（表单提交已修复）
├── start.sh                 # 一键启动脚本
└── README.md
```

## 快速开始

### 方法 1: 自动验证 + 启动
```bash
cd backend
pip install -r requirements.txt
python test_verification.py  # 运行验证测试
cd .. && ./start.sh
```

### 方法 2: 直接启动
```bash
chmod +x start.sh && ./start.sh
```

后端将在 http://localhost:8000 启动

### 访问前端
直接在浏览器中打开 `frontend/index.html`

### 加载演示数据
在前端首页点击"加载演示数据"按钮，创建四类演示场景

## 验收测试场景

### 1. 重复提交申请 ✅
- 在"提交申请"页面填写信息并提交
- 使用相同申请人邮箱+相同权限范围重复提交
- 系统自动识别并返回已存在的申请（不会重复创建）

### 2. 超范围申请被拒 ✅
- 提交包含无效 scope 的申请（如 admin:full, invalid:scope）
- 审批时系统自动校验 scope 合法性
- 包含无效 scope 的申请会被**自动拒绝**

### 3. 越权访问测试 ✅
- 审批通过一个仅有 `users:read` 权限的申请
- 在"功能测试"页面使用该凭证的 API Key/Secret
- 选择 `/api/orders` 接口进行访问测试
- 系统**拒绝访问**，并记录审计日志
- 在"审计日志"页面可查看本次越权访问记录

### 4. 完整链路审计 ✅
- 在"审计日志"页面输入任意凭证 ID
- 可查看完整链路：
  - 申请人信息
  - 申请详情（权限范围、有效期、理由）
  - 凭证信息（签发时间、过期时间、状态）
  - **完整审计日志链**（签发→访问→撤销/过期）

### 5. 自动到期回收 ✅
- 系统启动后，后台任务每分钟检查一次
- 过期凭证会自动标记为 `expired` 状态
- 自动生成 `credential_expired` 审计日志
- 回收流水可在"回收流水"页面查看

## API 文档

启动后端后访问 http://localhost:8000/docs 查看完整的 API 文档

### 主要 API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/applications` | 提交申请 |
| GET | `/api/applications/pending` | 待审批列表 |
| POST | `/api/approvals` | 审批申请 |
| GET | `/api/credentials/active` | 有效凭证列表 |
| POST | `/api/credentials/revoke` | 撤销凭证 |
| POST | `/api/credentials/expire` | 手动触发过期回收 |
| POST | `/api/verify-access` | 访问验证（带审计） |
| GET | `/api/audit-chain/{credential_id}` | 完整审计链路 |
| POST | `/api/demo/create-expired-credential` | 创建已过期演示凭证 |

## 数据库模型

- **Applicant**: 申请人信息
- **Application**: 申请记录（包含权限范围、有效期、理由、状态）
- **Credential**: 访问凭证（API Key、Secret 哈希、状态、签发/过期时间）
- **AuditLog**: 审计日志（所有操作记录）

## 后台自动任务

系统启动后自动运行以下后台任务：
- **凭证过期检查**: 每分钟执行一次，自动回收所有已过期的凭证
- 回收时自动生成审计日志，可在"审计日志"页面查看完整流水
