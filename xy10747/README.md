# 低代码组件注册中心

一个用于管理低代码组件从Schema定义到兼容报告全流程的处理链管理系统。

## 技术栈

- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端**: Vue 3 + Element Plus + Vue Router + Axios

## 功能特性

### 核心功能
1. **组件管理**: 新增、编辑、删除、查看组件
2. **处理链可视化**: 直观展示从Schema验证到兼容报告的完整处理流程
3. **属性面板管理**: 支持属性面板的创建和编辑，修改后自动触发重新计算
4. **版本发布**: 支持组件版本的发布和管理
5. **回放功能**: 支持重新执行完整处理链
6. **追溯详情**: 查看处理链每个步骤的详细信息
7. **人工修正**: 支持对兼容报告进行人工修正
8. **数据导出**: 支持导出组件完整数据

### 边界处理
- **依赖检查**: 防止重复执行，支持重试机制
- **示例预览**: 防止重复执行，支持重试机制
- **状态一致性**: 通过action hash防止重复点击导致的状态混乱

## 项目结构

```
├── backend/                 # 后端项目
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── core/           # 核心配置（数据库等）
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # 业务逻辑
│   ├── requirements.txt     # Python依赖
│   └── main.py             # FastAPI入口
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── router/         # 路由配置
│   │   ├── api/            # API封装
│   │   └── style.css       # 全局样式
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务 (默认端口 8000)
python main.py
# 或者
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档: http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器 (默认端口 3000)
npm run dev
```

前端访问: http://localhost:3000

## API接口说明

### 组件管理
- `GET /api/v1/components` - 获取组件列表
- `GET /api/v1/components/{id}` - 获取组件详情
- `POST /api/v1/components` - 创建组件
- `PUT /api/v1/components/{id}` - 更新组件
- `DELETE /api/v1/components/{id}` - 删除组件

### 处理链
- `POST /api/v1/components/{id}/processing-chains` - 创建处理链
- `POST /api/v1/processing-chains/{chain_id}/replay` - 回放处理链
- `GET /api/v1/processing-chains/{chain_id}/trace` - 获取追溯详情

### 属性面板
- `GET /api/v1/components/{id}/property-panels` - 获取属性面板列表
- `POST /api/v1/components/{id}/property-panels` - 创建属性面板
- `PUT /api/v1/property-panels/{id}` - 更新属性面板（触发重新计算）

### 兼容报告
- `PUT /api/v1/compatibility-reports/{id}/manual` - 人工修正报告

### 导出
- `POST /api/v1/export` - 导出组件数据

## 数据模型

### Component（组件）
- id, name, description, type, current_version, created_at, updated_at

### ComponentSchema（组件Schema）
- id, component_id, version, schema_content, created_by, is_active

### PropertyPanel（属性面板）
- id, component_id, schema_version, panel_config, version, updated_at

### ProcessingChain（处理链）
- id, component_id, chain_id, version, status, current_step, steps, last_action_hash

### DependencyCheck（依赖检查）
- id, component_id, version, status, dependencies, errors, warnings, check_id

### ExamplePreview（示例预览）
- id, component_id, version, status, preview_data, errors, preview_id

### CompatibilityReport（兼容报告）
- id, component_id, version, status, report_content, manual_override, override_by, override_notes

## 关键设计

### 幂等性保证
- 处理链回放时使用`last_action_hash`进行校验，防止重复请求
- 依赖检查和示例预览创建时先查询是否已存在相同版本的记录

### 重新计算触发
- 属性面板更新后，会自动触发处理链回放，重新计算相关记录

### 人工修正标记
- 兼容报告支持人工修正，会记录操作人和修正备注，并在界面显示"人工修正"标记
