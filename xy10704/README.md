# 多租户配置发布台 - 诊断控制台

## 项目概述

这是一个全栈应用，用于解决多租户配置发布中的灰度范围问题。系统提供了配置快照、回滚记录管理、发布日志追踪等功能，并包含样例数据展示灰度拦截机制。

## 技术栈

- **后端**: Python + Flask + SQLite
- **前端**: HTML + CSS + 原生JavaScript

## 主要功能

### 1. 配置快照管理
- 记录配置变更前后的完整状态
- 保存环境变量变更
- 灰度范围验证和自动拦截

### 2. 回滚记录管理
- 记录回滚原因和类型
- 支持人工处理回滚
- 保存处理备注和处理人信息

### 3. 发布日志追踪
- 记录每次发布操作
- 支持重试功能
- 显示错误详情

### 4. 租户配置管理
- 保存原始输入和处理结果
- 支持搜索功能
- 配置详情查看

### 5. 诊断功能
- 自动检测灰度范围问题
- 提供优化建议
- 显示配置变更对比

### 6. 导出功能
- 导出CSV格式报告
- 非研发人员友好的格式

## 项目结构

```
.
├── app.py              # Flask应用主文件
├── models.py           # 数据模型和数据库操作
├── requirements.txt    # Python依赖
├── config_console.db  # SQLite数据库文件(运行后自动创建)
├── templates/
│   └── index.html     # 前端页面
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行应用

```bash
python app.py
```

应用将在 `http://localhost:5001` 启动

### 3. 加载样例数据

点击页面上的「📦 加载样例数据」按钮，系统将自动插入包含以下内容的样例数据：

- **5个租户**的基础配置
- **3个配置快照**（其中2个被灰度拦截）
  - 灰度比例90%（超过80%被拦截）
  - 全量发布（成功）
  - 灰度租户数量60个（超过50个被拦截）
- **2条回滚记录**
  - 1条已处理（展示人工处理流程）
  - 1条待处理
- **5条发布日志**

## 灰度拦截规则

系统内置以下灰度拦截规则：

1. **比例限制**: 灰度比例超过80%时自动拦截
2. **租户数量限制**: 指定灰度租户超过50个时自动拦截

## API接口

### 配置相关
- `GET /api/configs` - 获取所有配置
- `GET /api/configs/<tenant_id>` - 获取指定租户配置
- `POST /api/configs` - 创建新配置

### 快照相关
- `GET /api/snapshots` - 获取所有快照
- `GET /api/snapshots/<snapshot_id>` - 获取快照详情

### 发布相关
- `POST /api/publish` - 发布配置
- `GET /api/diagnose/<snapshot_id>` - 诊断快照

### 回滚相关
- `POST /api/rollback` - 申请回滚
- `GET /api/rollbacks` - 获取回滚记录
- `POST /api/rollbacks/<rollback_id>/handle` - 处理回滚

### 日志相关
- `GET /api/logs` - 获取发布日志
- `POST /api/logs/<log_id>/retry` - 重试发布

### 其他
- `POST /api/sample-data` - 加载样例数据
- `GET /api/export` - 导出报告

## 数据库表结构

### tenant_config (租户配置表)
- id: 主键
- tenant_id: 租户ID
- tenant_name: 租户名称
- config_key: 配置键
- config_value: 配置值
- raw_input: 原始输入JSON
- processed_result: 处理结果JSON
- gray_scope: 灰度范围JSON
- status: 状态
- created_by: 创建人
- created_at/updated_at: 时间戳

### config_snapshot (配置快照表)
- snapshot_id: 快照ID
- tenant_id/tenant_name: 租户信息
- configs_before/configs_after: 配置变更前后
- env_vars_before/env_vars_after: 环境变量变更前后
- change_type: 变更类型
- gray_scope: 灰度范围
- gray_intercepted: 是否被灰度拦截
- intercept_reason: 拦截原因
- created_by: 创建人

### rollback_record (回滚记录表)
- rollback_id: 回滚ID
- snapshot_id: 关联快照ID
- tenant_id/tenant_name: 租户信息
- rollback_reason: 回滚原因
- rollback_type: 回滚类型
- handled_by: 处理人
- handled_at: 处理时间
- is_manual_handled: 是否人工处理
- handle_note: 处理备注
- status: 状态

### publish_log (发布日志表)
- log_id: 日志ID
- snapshot_id: 关联快照ID
- tenant_id: 租户ID
- action: 操作类型
- status: 状态
- error_detail: 错误详情
- retry_count: 重试次数
- created_by: 创建人

## 使用说明

1. **加载样例数据**: 首次使用建议点击"加载样例数据"查看演示
2. **查看拦截情况**: 在"配置快照"标签页查看被灰度拦截的记录
3. **诊断问题**: 点击"诊断"按钮查看详细分析和建议
4. **处理回滚**: 在"回滚记录"标签页处理待处理的回滚请求
5. **搜索功能**: 使用顶部搜索框快速定位记录
6. **导出报告**: 点击"导出报告"生成CSV格式报告

## 注意事项

- 数据库使用SQLite，数据存储在 `config_console.db` 文件中
- 样例数据包含故意设置的"脏数据"，用于演示灰度拦截功能
- 导出的CSV报告使用友好的列名，非研发人员也可轻松理解
