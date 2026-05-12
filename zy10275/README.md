# 🏸 羽毛球馆约球拼场台

一个完整的羽毛球馆拼场管理系统，支持开拼场、加人、候补、退场、确认到场和费用分摊。

## 功能特性

### 后端功能
- ✅ 场次管理（创建、取消、完成）
- ✅ 球员管理（添加、取消、候补）
- ✅ **数据持久化** - 数据自动保存到 JSON 文件，重启不丢失
- ✅ 候补自动转正机制
- ✅ **人数不足自动取消** - 可配置开场前X分钟人数不足自动取消
- ✅ 会员折扣计算
- ✅ 费用分摊计算
- ✅ 退款管理
- ✅ 到场确认
- ✅ **定时自动检查** - 每分钟后台自动检查需要取消的场次

### 前端功能
- ✅ 场次列表展示（带进度条）
- ✅ 场次详情页
- ✅ 筛选功能（日期、场地、状态）
- ✅ 数据导出 CSV
- ✅ 球员卡片展示（已报名、候补、已取消）
- ✅ 快速添加球员（支持会员选择）
- ✅ 操作反馈 Toast
- ✅ 人数不足检查按钮
- ✅ 自动取消规则提示

## 核心业务逻辑

### 候补转正机制
- 当场次满员后，新加入的球员自动进入候补队列
- 当已确认球员取消报名时，候补队列第一名自动转正
- 候补队列按加入时间排序，先进先出

### 人数不足自动取消
- 创建场次时可配置 `autoCancelIfNotEnough` 和 `cancelThresholdMinutes`
- 后台每分钟自动检查所有开放场次
- 当距离开场不足 `cancelThresholdMinutes` 分钟，且确认人数 < `minPlayers` 时自动取消
- 前端也提供手动检查按钮

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
- **JSON 文件持久化**

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
│   │   ├── store.ts       # 数据存储和业务逻辑（含持久化和自动检查）
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
├── data/                   # 数据存储目录（自动创建）
│   ├── sessions.json      # 场次数据
│   └── members.json       # 会员数据
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
- `POST /api/sessions/:id/check-auto-cancel` - 检查是否需要自动取消

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

### 核心流程测试（满员→退场→补位）
1. 进入任一场次详情页
2. 连续添加球员直到达到 `maxPlayers`（如4人），此时状态变为"已满"
3. 再加第5人，自动进入候补队列
4. **关键测试**：取消一名已报名球员
5. ✅ 确认：候补第1人自动转正，场次回到"报名中"状态
6. ✅ 确认：再加新球员直接进入报名，不会错误地进入候补

### 其他功能测试
1. 确认到场/退款操作
2. 创建一个即将开始的场次，设置低的最低人数，测试自动取消
3. 重启服务器，验证数据持久化

## 数据持久化说明

- 数据保存在 `server/data/` 目录下的 JSON 文件中
- 每次数据变更都会自动保存
- 服务器重启时会自动从文件恢复数据
- 首次启动且无数据文件时会自动创建样例数据
