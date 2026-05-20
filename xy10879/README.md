# 优惠码滥用风控 API 服务

一个全栈 Web 应用，用于检测和防止优惠码滥用行为，为运营和研发团队提供风控决策支持。

## 项目结构

```
.
├── src/                     # 后端源码
│   ├── types/               # 类型定义
│   ├── database/            # 数据库初始化和访问
│   ├── services/            # 业务逻辑服务
│   ├── controllers/         # API 控制器
│   ├── routes/              # 路由定义
│   ├── scripts/             # 数据脚本
│   └── server.ts            # 服务入口
├── client/                  # 前端源码
│   ├── src/
│   │   ├── types/           # 类型定义
│   │   ├── services/        # API 服务
│   │   ├── pages/           # 页面组件
│   │   ├── App.tsx          # 应用主组件
│   │   ├── main.tsx         # 入口文件
│   │   └── App.css          # 样式文件
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── package.json             # 后端依赖
└── README.md
```

## 核心功能

### 后端 API
- **风险检查**: 对优惠码使用请求进行实时风控评估
- **拦截事件管理**: 查看、搜索、导出所有拦截记录
- **手动放行/补偿**: 对误拦截的请求进行人工干预
- **放行记录**: 查看所有通过检查的请求记录
- **优惠码管理**: 创建、编辑、管理优惠码
- **数据导出**: 支持 CSV 格式导出拦截事件

### 风控规则引擎
1. **频率限制规则**: 5分钟内尝试超过3次，加30分
2. **重复使用检测**: 同一设备多次使用同一优惠码，加40分
3. **设备指纹识别**: 可疑设备累计尝试超过10次，加50分
4. **风险评分阈值**: 累计评分 ≥ 60分，触发拦截

### 前端控制台
- **总览仪表盘**: 实时统计、趋势图表、最近事件
- **拦截事件**: 事件列表、详情查看、人工操作
- **放行记录**: 所有通过检查的请求记录
- **优惠码管理**: 优惠码的增删改查
- **风控测试**: 模拟测试风控规则效果

## 数据模型

- **优惠码 (PromoCode)**: 折扣信息、使用限制、有效期
- **用户设备 (UserDevice)**: 设备标识、IP、UA、风险评分、尝试次数
- **风险规则 (RiskRule)**: 规则配置、启用状态
- **拦截事件 (BlockEvent)**: 拦截详情、触发规则、处理状态
- **放行记录 (AllowRecord)**: 放行详情、是否人工放行

## 快速开始

### 安装后端依赖
```bash
npm install
```

### 安装前端依赖
```bash
cd client
npm install
cd ..
```

### 初始化数据（创建优惠码和风控规则）
```bash
npm run seed
```

### 启动后端服务（开发模式）
```bash
npm run dev
```
后端服务运行在 http://localhost:8080

### 启动前端服务（新终端窗口）
```bash
cd client
npm run dev
```
前端控制台运行在 http://localhost:3000

## API 接口

### 风控相关
- `POST /api/risk/check` - 执行风险检查
- `GET /api/risk/block-events` - 获取拦截事件列表
- `GET /api/risk/block-events/:id` - 获取拦截事件详情
- `POST /api/risk/block-events/:id/allow` - 人工放行
- `POST /api/risk/block-events/:id/compensate` - 标记补偿
- `GET /api/risk/block-events/export` - 导出拦截事件
- `GET /api/risk/allow-records` - 获取放行记录
- `GET /api/risk/dashboard` - 获取仪表盘统计

### 优惠码相关
- `POST /api/promo-codes` - 创建优惠码
- `GET /api/promo-codes` - 获取优惠码列表
- `GET /api/promo-codes/:id` - 获取优惠码详情
- `PUT /api/promo-codes/:id/status` - 更新优惠码状态

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (数据库)
- uuid (唯一标识)
- csv-writer (数据导出)

### 前端
- React 18
- TypeScript
- Vite
- Ant Design
- React Router
- Recharts (图表)
- Axios (HTTP客户端)

## 使用说明

1. **初始化数据**: 首次运行请执行 `npm run seed` 创建样例优惠码和风控规则
2. **测试风控**: 进入"风控测试"页面，输入优惠码快速连续测试，观察触发频率限制规则
3. **查看拦截**: 在"拦截事件"页面可以看到所有被拦截的请求
4. **人工处理**: 对误拦截的记录可以执行"放行"或"补偿"操作
5. **导出数据**: 支持将拦截事件导出为 CSV 格式文件

## 状态说明

### 拦截事件状态
- **已拦截**: 系统自动拦截，等待处理
- **人工放行**: 运营人员手动放行
- **已补偿**: 已进行补偿处理

### 风险等级
- **LOW (低)**: 0-29分，正常放行
- **MEDIUM (中)**: 30-59分，关注监控
- **HIGH (高)**: 60-79分，触发拦截
- **CRITICAL (极高)**: 80+分，触发拦截

## 默认样例优惠码

执行 `npm run seed` 后，系统会创建以下优惠码：
- SAVE20: 20% 折扣，限制100次
- FIXED50: 减免50元，限制50次
- NEWUSER10: 新用户10%折扣，限制500次
- SUMMER30: 夏季特惠30%折扣，限制200次
- VIP100: VIP专属减免100元，限制10次
