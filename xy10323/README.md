# 小区装修押金退还台

物业本地办公用的装修押金退还管理系统，完整管理装修申请、押金金额、巡检问题、整改复核、物业欠费和退款审批流程。

## 功能特性

### 核心功能
- **申请管理**：装修押金申请录入、查询、状态跟踪
- **巡检管理**：完工巡检记录、问题发现、整改复核
- **物业费管理**：欠费记录、结清管理、押金抵扣
- **退款审批**：扣款试算、金额计算、审批确认
- **导出功能**：Excel格式导出，包含财务所需的扣退明细
- **操作时间线**：所有操作记录可追溯，审计友好

### 业务规则验证
1. **未整改不能退款**：存在未整改的巡检问题时，退款审批按钮禁用
2. **欠费要先冲抵**：存在未结清物业费时，可选择从押金中抵扣
3. **同一申请不能重复退款**：系统自动检查，防止重复退款
4. **必须先巡检**：没有完工巡检记录不能申请退款

## 技术栈

- **后端**：Node.js + Express + SQL.js (纯JS SQLite实现)
- **前端**：React 18 + Vite + Ant Design
- **数据存储**：本地SQLite文件（deposit.db）
- **导出格式**：Excel (.xlsx)

## 项目结构

```
.
├── server/                 # 后端服务
│   ├── index.js           # 服务器入口
│   ├── database.js        # 数据库初始化和连接
│   ├── routes/
│   │   └── applications.js # API路由
│   └── services/
│       ├── applicationService.js # 业务逻辑服务
│       └── exportService.js     # 导出服务
├── client/                 # 前端应用
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── services/
│       │   └── api.js     # API调用封装
│       └── pages/
│           ├── ApplicationList.jsx    # 申请列表页
│           ├── ApplicationDetail.jsx  # 申请详情页
│           └── DataCorrectionGuide.jsx # 补录数据说明页
└── package.json
```

## 安装运行

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
```

### 2. 开发模式运行

```bash
# 方式一：分别启动
# 启动后端服务（端口3001）
npm run server

# 启动前端开发服务器（端口5173）
cd client
npm run dev

# 方式二：同时启动前后端
npm run dev
```

### 3. 生产模式

```bash
# 构建前端
cd client
npm run build

# 启动服务
cd ..
npm start
```

## 内置样例数据

系统首次启动时会自动创建3个示例申请：

1. **ZK-2024-001（张三 - 1栋2单元301）**
   - 押金：¥5,000.00
   - 状态：已完成退款
   - 情况：全额退还，无扣款

2. **ZK-2024-002（李四 - 2栋1单元502）**
   - 押金：¥5,000.00
   - 状态：已完成退款
   - 情况：墙体破损，扣除修复费¥800.00，实际退款¥4,200.00

3. **ZK-2024-003（王五 - 3栋3单元101）**
   - 押金：¥5,000.00
   - 状态：待处理
   - 情况：存在未结清物业费¥1,800.00，退款暂停

## 补录数据说明

### 数据合并原则
补录数据与原始记录遵循"时间线合并、不可覆盖、可追溯"原则：
- 所有补录数据作为新记录追加到时间线
- 原始记录始终保留
- 修改操作在时间线中留下变更痕迹

### 允许修改/补录的情况
✅ **申请基本信息**
- 房间号、业主姓名、联系电话（录入错误时可改）
- 押金金额（未退款前可调）
- 修改记录保存于时间线

✅ **巡检记录**
- 巡检日期、巡检人可修正
- 可新增遗漏的巡检问题
- 问题描述、位置、严重程度可修改

✅ **物业费记录**
- 可新增未记录的欠费
- 到期日期、金额可调整

### 禁止修改的情况（必须退回/不能修改）
❌ **退款审批记录**
- 退款单号、审批人、退款日期
- 扣款金额、物业费抵扣金额
- 实际退款金额
- 原因：财务凭证已生成，修改会导致账目混乱

❌ **已完成的整改记录**
- 整改完成日期
- 整改人信息
- 原因：涉及责任认定和费用核算

❌ **已结清的物业费**
- 结清日期
- 已付款金额
- 原因：涉及财务对账

## 退款审批流程

1. **完工巡检**：必须先进行完工巡检，记录装修状况
2. **问题整改**：发现的问题必须整改完成
3. **欠费检查**：系统自动检查物业费，可选择抵扣或先结清
4. **扣款试算**：审批前添加扣款项目，实时计算实际退款
5. **确认审批**：确认后完成退款，数据不可修改
6. **状态更新**：申请变为"已完成退款"

## 导出功能

Excel包含4个工作表：
1. **装修押金退款明细表**：所有申请的完整信息
2. **扣款明细**：每笔扣款的详细记录
3. **操作时间线**：完整操作历史
4. **汇总统计**：申请、退款、欠费统计

## API接口

### 申请管理
- `GET /api/applications` - 获取申请列表
- `POST /api/applications` - 创建申请
- `GET /api/applications/:id` - 获取申请详情
- `PUT /api/applications/:id` - 更新申请

### 巡检管理
- `POST /api/applications/:id/inspections` - 添加巡检记录
- `POST /api/applications/inspections/:inspectionId/problems` - 添加问题
- `POST /api/applications/problems/:problemId/rectify` - 标记整改完成

### 物业费管理
- `POST /api/applications/:id/fees` - 添加欠费
- `POST /api/applications/fees/:feeId/pay` - 标记结清

### 退款管理
- `GET /api/applications/:id/refund-check` - 检查退款条件
- `POST /api/applications/:id/calculate-refund` - 扣款试算
- `POST /api/applications/:id/refunds` - 创建退款审批

### 导出
- `GET /api/applications/export/excel` - 导出Excel
- `GET /api/applications/export/data` - 获取导出数据

## 注意事项

1. 所有操作都会在时间线中记录，请谨慎操作
2. 退款审批后不可撤销，务必核对扣款明细
3. 建议先进行扣款试算再确认审批
4. 数据库文件为 deposit.db，备份时请同时备份此文件
5. 首次启动会自动创建样例数据，方便测试

## 许可

MIT License
