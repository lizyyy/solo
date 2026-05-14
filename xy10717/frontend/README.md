# 数据库迁移审批台 - 前端应用

## 技术栈
- Vue 3: 渐进式JavaScript框架
- Vue Router 4: 路由管理
- Pinia: 状态管理
- Element Plus: UI组件库
- Axios: HTTP客户端
- Vite: 构建工具

## 项目结构
```
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── api/
│   │   └── index.js              # API接口封装
│   ├── stores/
│   │   └── migration.js        # Pinia状态管理
│   ├── views/
│   │   ├── MigrationList.vue      # 迁移脚本列表页
│   │   ├── CreateMigration.vue    # 创建迁移脚本页
│   │   ├── MigrationDetail.vue    # 迁移脚本详情页
│   │   └── ExecutionLogs.vue      # 执行日志列表页
│   ├── router/
│   │   └── index.js             # 路由配置
│   ├── App.vue                 # 根组件
│   └── main.js                 # 应用入口
├── index.html
├── vite.config.js              # Vite配置
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖
```bash
cd frontend
npm install
```

### 2. 配置代理
`vite.config.js` 中已配置后端服务代理：
```javascript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true
    }
  }
}
```

### 3. 启动开发服务
```bash
npm run dev
```
访问 http://localhost:3000 查看应用。

### 4. 构建生产版本
```bash
npm run build
```

### 5. 预览生产版本
```bash
npm run preview
```

## 功能模块说明

### 1. 迁移脚本列表
- 查看所有迁移脚本的基本信息
- 按状态、创建时间排序
- 支持查看详情、导出Excel、删除操作
- 状态标签显示（草稿、待审批、已审批、执行中、成功、失败、已回滚）

### 2. 创建迁移脚本
- 填写脚本基本信息（名称、描述、数据库类型、创建人）
- 编辑SQL脚本内容
- 配置影响表（表名、操作类型、预估行数、是否备份、备注）
- 添加回滚脚本（版本、脚本内容、备注）

### 3. 迁移脚本详情
- 查看脚本完整信息
- 查看影响表和回滚脚本
- **审批链路管理**：
  - 创建审批链路（支持自定义审批步骤）
  - 启动审批流程
  - 审批通过/驳回
  - 审批规则校验（角色匹配）
- **执行操作**：
  - 启动迁移执行
  - 人工修正（输入修正脚本）
  - 完成执行（更新状态）
  - 回放执行
- 追溯链展示：以时间轴形式展示完整的执行历史
- 重新计算影响表：根据SQL内容自动更新影响表的操作类型

### 4. 执行日志列表
- 查看所有执行日志
- 按执行类型、状态筛选
- 查看日志详情
- 回放执行功能

## 核心功能实现

### 审批流程
1.  创建审批链路，配置审批步骤和角色
2.  启动审批流程
3.  当前步骤审批人进行审批（通过/驳回）
4.  规则校验：审批人角色必须与配置的required_role匹配
5.  逐级审批，直到所有步骤完成或被驳回
6.  审批通过后，迁移脚本状态更新为"已审批"

### 追溯链
- 以时间轴形式展示迁移脚本的完整执行历史
- 包含所有执行类型（迁移、回滚、回放、人工修正）
- 显示执行时间、执行人、状态、输出、错误信息
- 支持查看每个执行的详细日志

### 边界处理示例

#### 审批规则挡住的操作
场景：DBA审批步骤配置了 `{"required_role": "DBA"}` 规则

操作流程：
1.  运维负责人尝试审批DBA步骤
2.  系统校验审批人角色不匹配
3.  自动驳回审批并给出提示："规则校验失败: 需要 DBA 角色"
4.  审批链路状态变为"已驳回"
5.  迁移脚本状态变为"已驳回"

#### 回滚脚本验证
场景：回滚脚本标记为无效（is_valid = false）

操作流程：
1.  用户尝试执行回滚操作
2.  系统检查回滚脚本有效性
3.  发现无效，阻止执行
4.  提示："回滚脚本无效，请先验证回滚脚本"

#### 影响表重新计算
场景：迁移脚本SQL内容更新后

操作流程：
1.  点击"重新计算影响表"按钮
2.  系统分析SQL脚本内容
3.  自动更新影响表的操作类型（ALTER/CREATE/DROP等）
4.  提示："重新计算完成"

## 常用接口调用示例

### 获取迁移脚本列表
```javascript
import { migrationApi } from '@/api'
const migrations = await migrationApi.list()
```

### 创建迁移脚本
```javascript
const data = {
  name: '用户表优化',
  description: '添加索引和新字段',
  database_type: 'mysql',
  created_by: 'admin',
  script_content: 'ALTER TABLE users ADD INDEX idx_email (email);',
  affected_tables: [{
    table_name: 'users',
    operation_type: 'ALTER',
    estimated_rows: 10000,
    has_backup: true,
    remarks: '核心用户表'
  }],
  rollback_scripts: [{
    script_content: 'ALTER TABLE users DROP INDEX idx_email;',
    remarks: '回滚脚本'
  }]
}
await migrationApi.create(data)
```

### 审批通过
```javascript
await approvalApi.approveStep(stepId, 'DBA', '已审核通过，SQL语法正确')
```

### 启动执行
```javascript
await executionApi.start(migrationId, 'admin')
```

### 导出Excel
```javascript
exportApi.exportExcel(migrationId) // 直接打开下载链接
```

## 开发说明

### 添加新页面
1. 在 `src/views/` 中创建Vue组件
2. 在 `src/router/index.js` 中添加路由配置

### 添加新API
1. 在 `src/api/index.js` 中添加API函数
2. 在 `src/stores/migration.js` 中添加状态管理方法

### 自定义主题
在 `src/main.js` 中配置Element Plus主题：
```javascript
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

app.use(ElementPlus, {
  locale: zhCn,
})
```

## 环境变量配置
可在项目根目录创建 `.env` 文件配置环境变量：
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=数据库迁移审批台
```

## 部署说明

### Nginx配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker部署
可使用多阶段构建：
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```
