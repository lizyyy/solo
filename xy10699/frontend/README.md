# 前端 - 云资源发布审批系统

## 技术栈
- React 18 + TypeScript
- Ant Design 5.x
- Axios
- Recharts
- Day.js

## 启动命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 构建生产版本
npm run build
```

## 项目结构
```
src/
├── api/            # API请求封装
│   └── index.ts
├── components/     # 通用组件
│   ├── StatCards.tsx
│   ├── ExceptionBoard.tsx
│   └── TypeChart.tsx
├── pages/          # 页面组件
│   ├── Dashboard.tsx
│   ├── ReleaseRequests.tsx
│   └── ReleaseReports.tsx
├── types/          # TypeScript类型定义
│   └── index.ts
├── App.tsx         # 主应用组件
├── index.tsx       # 入口文件
└── index.css
```

## 功能模块

### 1. 控制台 (Dashboard)
- 统计卡片：展示总申请数、待审批、发布中、已完成、已回滚、发布异常
- 最近申请列表
- 异常看板：展示发布失败的服务详情
- 发布类型分布图

### 2. 发布申请管理
- 申请列表展示（支持分页）
- 搜索过滤：按标题、描述、状态、优先级、类型
- 新建、编辑、删除申请
- 查看详情：包含影响服务、审批意见、修改历史

### 3. 发布报告管理
- 报告列表展示
- 按状态、责任人筛选
- 查看报告详情
- 导出Excel报告
