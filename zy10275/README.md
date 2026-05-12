# 🏸 羽毛球馆约球拼场台

一个完整的羽毛球馆拼场管理系统，支持开拼场、加人、候补、退场、确认到场和费用分摊。

## 功能特性

### 后端功能
- ✅ 场次管理（创建、取消、完成）
- ✅ 球员管理（添加、取消、候补）
- ✅ 候补自动转正机制
- ✅ 会员折扣计算
- ✅ 费用分摊计算
- ✅ 退款管理
- ✅ 到场确认

### 前端功能
- ✅ 场次列表展示（带进度条）
- ✅ 场次详情页
- ✅ 筛选功能（日期、场地、状态）
- ✅ 数据导出 CSV
- ✅ 球员卡片展示（已报名、候补、已取消）
- ✅ 快速添加球员（支持会员选择）
- ✅ 操作反馈 Toast

## 核心业务逻辑

### 候补转正机制
- 当场次满员后，新加入的球员自动进入候补队列
- 当已确认球员取消报名时，候补队列第一名自动转正
- 候补队列按加入时间排序，先进先出

### 费用计算
- 基础费用 = 总费用 / 最大人数
- 会员享受折扣（默认 9 折）
- 人均费用实时计算 = 总费用 / 已确认报名人数

### 状态流转
**场次状态：**
- 开放中 (OPEN) → 可报名
- 已满 (FULL) → 新加入进入候补
- 已取消 (CANCELLED) → 场次关闭
- 已完成 (COMPLETED) → 场次结束

**球员状态：**
- 已确认 (CONFIRMED) → 正常报名
- 候补 (WAITLIST) → 候补队列中
- 已取消 (CANCELLED) → 待退款
- 已退款 (REFUNDED) → 已完成退款

## 技术栈

### 后端
- Node.js
- Express
- TypeScript
- UUID

### 前端
- React 18
- TypeScript
- Vite
- React Router

## 快速开始

### 安装依赖

```bash
# 安装根目录依赖（用于并发启动）
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd client && npm install && cd ..
```

### 启动项目

#### 方式一：同时启动前后端（推荐）
```bash
npm run dev
```

#### 方式二：分别启动
```bash
# 启动后端 (端口 3001)
cd server && npm run dev

# 启动前端 (端口 3000)
cd client && npm run dev
```

### 访问应用
打开浏览器访问: http://localhost:3000

## 项目结构

```
.
├── server/                 # 后端代码
│   ├── src/
│   │   ├── index.ts       # 入口文件
│   │   ├── types.ts       # 类型定义
│   │   ├── store.ts       # 数据存储和业务逻辑
│   │   └── routes.ts      # API 路由
│   ├── package.json
│   └── tsconfig.json
├── client/                 # 前端代码
│   ├── src/
│   │   ├── main.tsx       # 入口文件
│   │   ├── App.tsx        # 主应用
│   │   ├── index.css      # 全局样式
│   │   ├── types.ts       # 类型定义
│   │   ├── api.ts         # API 封装
│   │   ├── pages/         # 页面组件
│   │   └── components/    # 公共组件
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── package.json
└── README.md
```

## API 接口

### 场次相关
- `GET /api/sessions` - 获取所有场次
- `GET /api/sessions/:id` - 获取场次详情
- `POST /api/sessions` - 创建新场次
- `POST /api/sessions/:id/cancel` - 取消场次
- `POST /api/sessions/:id/complete` - 完成场次

### 球员相关
- `POST /api/sessions/:id/players` - 添加球员
- `POST /api/sessions/:id/players/:playerId/confirm` - 确认到场
- `POST /api/sessions/:id/players/:playerId/cancel` - 取消报名
- `POST /api/sessions/:id/players/:playerId/refund` - 确认退款

### 会员相关
- `GET /api/members` - 获取所有会员

## 样例数据

系统启动时会自动创建样例数据：
- 8 个样例会员（含普通会员和 VIP 会员）
- 3 个场次（今天、明天不同场地）

你可以通过以下流程测试：
1. 添加多名球员直到满员
2. 后续球员自动进入候补
3. 取消一名已确认球员
4. 观察候补第一名自动转正
5. 确认到场/退款操作
