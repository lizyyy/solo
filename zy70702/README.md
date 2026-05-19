# 包撤回依赖影响仲裁系统

基于 FastAPI + SQLite 的私有包版本撤回仲裁管理后端。

## 核心功能

- **版本状态机**: published → withdraw_requested → impact_calculating → pending_arbitration → withdrawn/republished
- **依赖影响计算**: 自动计算撤回对下游项目的影响
- **撤回幂等**: 防止重复申请和重复处理
- **人工仲裁**: 支持批准、拒绝、需要更多信息三种结果
- **影响报告**: 详细的影响项目列表和关键影响标记
- **清晰错误码**: 区分缺字段、状态不允许、需要复核、已处理等场景

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| `missing_field` | 缺少必要字段 |
| `invalid_status` | 当前状态不允许该操作 |
| `need_manual_review` | 需要人工复核说明 |
| `already_processed` | 已处理，无法重复操作 |
| `not_found` | 资源不存在 |
| `duplicate_request` | 请求重复 |

## API 接口

### 1. 创建包版本
```bash
POST /api/packages/
{
  "package_name": "my-package",
  "version": "1.0.0",
  "publisher": "user123",
  "dependencies": ["dep1", "dep2"]
}
```

### 2. 提交撤回申请
```bash
POST /api/withdraw-requests/
{
  "package_name": "my-package",
  "version": "1.0.0",
  "requester": "user456",
  "reason": "误发版本"
}
```

### 3. 计算依赖影响
```bash
POST /api/withdraw-requests/{request_id}/calculate-impact
```

### 4. 人工仲裁
```bash
POST /api/arbitrations/
{
  "request_id": "WR-my-package-1.0.0-1234567890",
  "arbitrator": "admin",
  "result": "approved",
  "comment": "经过评估确认撤回"
}
```

### 5. 查询撤回申请
```bash
GET /api/withdraw-requests/?status=pending_arbitration&package_name=my-package
```

### 6. 获取影响报告
```bash
GET /api/impact-reports/{request_id}
```

### 7. 添加依赖项目
```bash
POST /api/dependent-projects/?project_name=web-app&package_name=my-package&owner=team-a
```

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 运行服务
```bash
python main.py
```

服务启动后访问: http://localhost:8000/docs

### 运行自检脚本
```bash
python test_self_check.py
```

## 数据模型

- **PackageVersion**: 包版本信息（包名、版本号、发布人、状态）
- **WithdrawRequest**: 撤回申请记录
- **DependentProject**: 依赖项目信息
- **ImpactReport**: 影响分析报告
- **ArbitrationRecord**: 仲裁记录

## 仲裁流程

1. 发现误发版本 → 提交撤回申请
2. 系统计算依赖影响
3. 影响项目 > 5 个标记为"关键影响"
4. 关键影响的批准需要详细复核说明
5. 仲裁员审批通过后包状态变为 `withdrawn`