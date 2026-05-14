# 数据导出权限水印管理系统

为测试负责人打造的数据安全管理平台，实现权限校验、水印追踪、审计台账全流程管理。

## 技术栈

- **后端**: Flask (Python) + SQLite
- **前端**: 原生 HTML/JS/CSS

## 项目结构

```
.
├── backend/
│   ├── app.py              # Flask 主应用
│   ├── init_data.py        # 初始化数据脚本
│   └── requirements.txt    # Python 依赖
└── frontend/
    └── index.html          # 前端页面
```

## 本地启动

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 3. 打开前端页面

直接用浏览器打开 `frontend/index.html` 文件

## 初始化数据

首次启动后，运行初始化脚本填充示例数据：

```bash
python init_data.py
```

这将创建：
- 10个字段权限配置（含不同敏感度等级）
- 3个水印规则模板
- 15个示例导出申请（包含各种状态）
- 随机的下载记录

## 核心数据模型

### 1. 字段权限 (field_permissions)
- `field_name`: 字段名称
- `description`: 字段描述
- `requires_approval`: 是否需要审批 (boolean)
- `sensitivity_level`: 敏感度等级 (1-3)

### 2. 水印规则 (watermark_rules)
- `rule_name`: 规则名称
- `content_template`: 内容模板（支持占位符）
- `opacity`: 透明度 (0-1)
- `font_size`: 字体大小

### 3. 导出申请 (export_applications)
- `applicant`: 申请人
- `responsible_person`: 负责人
- `fields`: 导出字段（逗号分隔）
- `purpose`: 导出用途
- `status`: 状态 (pending/approved/rejected/revoked)
- `reject_reason`: 拒绝原因
- `watermark_rule_id`: 关联的水印规则

### 4. 下载记录 (download_records)
- `application_id`: 关联申请ID
- `downloader`: 下载人
- `download_time`: 下载时间
- `success`: 是否成功
- `failure_reason`: 失败原因
- `ip_address`: IP地址

### 5. 撤销链接 (revoke_links)
- `application_id`: 关联申请ID
- `token`: 撤销令牌
- `expires_at`: 过期时间
- `is_revoked`: 是否已使用

### 6. 审计台账 (audit_logs)
- `action`: 操作类型
- `operator`: 操作人
- `application_id`: 关联申请ID
- `details`: 详情
- `created_at`: 创建时间

## 常用接口

### 导出申请相关

```bash
# 获取所有申请（支持分组）
GET /api/applications?group_by=responsible_person
# group_by 可选: responsible_person, created_at, watermark_rule_name

# 提交新申请
POST /api/applications
{
    "applicant": "张三",
    "responsible_person": "张经理",
    "fields": ["user_name", "user_email"],
    "purpose": "数据分析"
}

# 批量导入
POST /api/applications/batch
{
    "applications": [
        {
            "applicant": "张三",
            "responsible_person": "张经理",
            "fields": ["user_name"],
            "purpose": "报表"
        }
    ]
}

# 审批通过
POST /api/applications/:id/approve
{
    "approver": "审批人姓名"
}

# 审批拒绝
POST /api/applications/:id/reject
{
    "rejecter": "拒绝人姓名",
    "reason": "拒绝原因"
}
```

### 下载与撤销

```bash
# 记录下载
POST /api/applications/:id/download
{
    "downloader": "下载人姓名"
}

# 生成撤销链接
POST /api/applications/:id/revoke-link

# 使用撤销链接撤销权限
POST /api/revoke/:token
```

### 查询与导出

```bash
# 获取字段权限
GET /api/field-permissions

# 获取水印规则
GET /api/watermark-rules

# 获取统计数据
GET /api/stats

# 获取下载记录
GET /api/downloads

# 获取审计日志
GET /api/audit-logs

# 导出审计台账（CSV）
GET /api/audit-logs/export
```

## 权限校验规则

系统自动根据字段敏感度进行权限校验：

1. **等级 1 (低敏感)**: 直接通过，无需审批
2. **等级 2 (中敏感)**: 自动进入待审批状态，需要人工审批
3. **等级 3 (高敏感)**: 自动拒绝，需要特殊审批流程

> **注意**: 只要选中的字段中包含一个高敏感字段，整个申请会被自动拒绝。

## 会被规则挡住的操作示例

### 场景 1: 申请包含高敏感字段

**操作**:
1. 申请人选择 `user_idcard`（身份证号，L3 高敏感）字段
2. 填写申请人、负责人、用途
3. 点击提交申请

**结果**:
- 申请被自动拒绝
- 拒绝原因显示：`包含高敏感字段，需要特殊审批流程`
- 前端有红色警告提示

**接口响应**:
```json
{
    "id": 1,
    "status": "rejected",
    "reject_reason": "包含高敏感字段，需要特殊审批流程",
    "requires_approval": true,
    "message": "申请被拒绝"
}
```

### 场景 2: 申请包含需审批字段

**操作**:
1. 申请人选择 `user_phone`（手机号，L2 需审批）字段
2. 填写申请人、负责人、用途
3. 点击提交申请

**结果**:
- 申请进入 `pending`（待审批）状态
- 需要负责人手动审批后才能下载
- 前端有黄色警告提示

### 场景 3: 下载未批准的申请

**操作**:
1. 找到一个 `pending` 或 `rejected` 状态的申请
2. 点击「记录下载」按钮
3. 输入下载人姓名

**结果**:
- 下载记录被记录为失败
- 失败原因：`申请未批准`
- 审计台账中记录此次失败操作

### 场景 4: 使用撤销链接

**操作**:
1. 找到一个 `approved` 状态的申请
2. 点击「生成撤销链接」
3. 使用 curl 或其他工具 POST 请求撤销链接

**结果**:
- 申请状态变为 `revoked`（已撤销）
- 后续下载该申请都会失败
- 审计台账记录撤销操作

## 功能特性

### 前端功能
- ✅ 新建导出申请表单
- ✅ 字段敏感级实时提示
- ✅ JSON 批量导入
- ✅ 导出申请分组展示（按负责人/时间/水印规则）
- ✅ 审批操作（通过/拒绝）
- ✅ 下载记录管理（含失败原因）
- ✅ 审计台账查看与 CSV 导出
- ✅ 撤销链接生成
- ✅ 实时统计面板

### 后端功能
- ✅ 字段敏感级自动校验
- ✅ 水印规则自动关联
- ✅ 完整的审计日志追踪
- ✅ 下载失败原因记录
- ✅ 撤销链接机制（7天有效期）
- ✅ 分组查询支持
- ✅ CSV 导出功能

## 分组展示说明

系统支持三种分组方式：

1. **按负责人分组**: 方便测试负责人查看自己负责的所有申请
2. **按申请时间分组**: 按日期维度查看申请分布
3. **按水印规则分组**: 了解不同水印规则被应用的情况

## 使用提示

1. **测试高敏感拦截**: 选择 `user_idcard` 或 `payment_info` 字段，观察自动拒绝效果
2. **测试审批流程**: 选择 `user_phone` 或 `login_ip` 字段，观察待审批状态，然后进行审批操作
3. **测试撤销功能**: 对已通过的申请生成撤销链接，使用后观察状态变化
4. **测试下载失败**: 对未批准的申请点击下载，观察失败原因记录
5. **导出审计台账**: 在审计台账标签页点击导出按钮，下载 CSV 文件
