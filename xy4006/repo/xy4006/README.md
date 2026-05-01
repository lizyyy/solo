# 📦 物资借还小台账

一个给社区活动用的物资借还管理系统，解决微信群记录容易忘还、库存对不上的问题。

## 功能特性

### 📋 物资管理
- **物资清单维护**：支持新增、编辑、删除物资
- **字段支持**：名称、分类、总数量、可借数量、备注
- **库存状态**：实时显示可借数量，库存不足时红色预警
- **删除保护**：有未归还借用记录的物资无法删除

### 🔄 借还登记
- **新建借用单**：
  - 选择物资（仅显示可借数量 > 0 的物资）
  - 填写借用数量（不能超过可借数量）
  - 填写借用人姓名、手机号
  - 选择预计归还日期
- **归还登记**：
  - 支持部分归还（分多次归还）
  - 记录归还历史时间线
  - 归还时自动恢复库存
- **状态管理**：
  - 借用中
  - 已归还
  - 已逾期（红色标识）
  - 今日应还（黄色标识）

### 👁️ 筛选视图
- **全部记录**：查看所有借用记录
- **进行中**：只看未归还的记录
- **逾期未还**：超过预计归还日期的记录
- **今日应还**：预计今天归还的记录

### 💾 数据持久化
- 数据存储在本地 JSON 文件中
- 刷新页面、重启服务后数据不丢失
- 数据文件位置：`backend/data/`

## 项目结构

```
xy4006/
├── backend/                    # 后端服务
│   ├── data/                   # 数据存储目录（自动创建）
│   │   ├── supplies.json       # 物资数据
│   │   └── borrowRecords.json  # 借用记录
│   ├── src/
│   │   ├── routes/
│   │   │   ├── supplies.js     # 物资 API 路由
│   │   │   ├── borrowRecords.js # 借用记录 API 路由
│   │   │   └── stats.js        # 统计 API 路由
│   │   ├── server.js           # 服务入口
│   │   └── store.js            # 数据存储层
│   └── package.json
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── SupplySidebar.jsx   # 左侧物资清单组件
│   │   │   └── MainContent.jsx     # 右侧主内容组件
│   │   ├── services/
│   │   │   └── api.js          # API 调用封装
│   │   ├── App.jsx             # 主应用组件
│   │   ├── App.css             # 应用样式
│   │   ├── main.jsx            # 入口文件
│   │   └── index.css           # 全局样式
│   ├── index.html
│   ├── vite.config.js          # Vite 配置
│   └── package.json
└── README.md
```

## 技术栈

- **后端**：Node.js + Express
- **前端**：React + Vite + Ant Design
- **数据存储**：本地 JSON 文件
- **其他**：dayjs（日期处理）、uuid（ID 生成）

## 安装与运行

### 环境要求
- Node.js >= 16.x
- npm 或 yarn

### 步骤 1：安装依赖

```bash
# 进入项目目录
cd xy4006

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 步骤 2：启动服务

需要同时启动后端和前端两个服务（建议使用两个终端窗口）：

**终端 1 - 启动后端：**
```bash
cd xy4006/backend
npm start
```
后端服务将在 http://localhost:3001 启动

**终端 2 - 启动前端：**
```bash
cd xy4006/frontend
npm run dev
```
前端应用将在 http://localhost:3000 启动

### 步骤 3：访问应用

打开浏览器访问：http://localhost:3000

## API 接口

### 物资管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/supplies | 获取所有物资列表 |
| GET | /api/supplies/:id | 获取单个物资详情 |
| POST | /api/supplies | 创建新物资 |
| PUT | /api/supplies/:id | 更新物资信息 |
| DELETE | /api/supplies/:id | 删除物资 |

### 借用记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/borrow-records | 获取借用记录列表 |
| GET | /api/borrow-records/:id | 获取单个记录详情 |
| POST | /api/borrow-records | 创建新借用单 |
| POST | /api/borrow-records/:id/return | 登记归还 |

**GET /api/borrow-records 支持的查询参数：**
- `view=overdue` - 逾期未还
- `view=today` - 今日应还
- `view=active` - 进行中
- `supplyId=xxx` - 按物资过滤

### 统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/stats | 获取统计数据（总数、逾期、库存预警等） |

## 核心流程测试

### 流程 1：新增物资并借用
1. 点击左侧「新增」按钮
2. 填写物资信息：
   - 名称：投影仪
   - 分类：电子设备
   - 总数量：3
   - 可借数量：3
3. 点击「创建」
4. 点击右侧「新建借用单」
5. 选择「投影仪」，数量填 1
6. 填写借用人：张三，手机号：13800138000
7. 选择预计归还日期（比如明天）
8. 点击「确认借用」
9. 观察左侧物资列表中投影仪的可借数量从 3 变为 2

### 流程 2：归还物资
1. 在借用记录列表中找到刚才的记录
2. 点击「归还」按钮
3. 填写归还数量：1
4. 点击「确认归还」
5. 观察状态变为「已归还」，可借数量恢复为 3

### 流程 3：部分归还
1. 借用投影仪 2 个
2. 点击归还，填写数量 1
3. 观察记录显示「共 2，已还 1，待还 1」
4. 再次归还剩余 1 个
5. 状态变为「已归还」

### 流程 4：筛选视图
1. 创建几个不同归还日期的借用单
2. 分别点击「进行中」、「逾期未还」、「今日应还」Tab
3. 观察筛选结果是否符合预期

## 关键实现点

### 后端
1. **数据持久化**：使用 `fs` 模块读写 JSON 文件，服务启动时自动创建数据目录和文件
2. **库存校验**：创建借用单时检查可借数量，归还时恢复库存
3. **部分归还**：每个借用记录维护 `returnedQuantity` 和 `returnHistory` 数组
4. **逾期计算**：通过比较 `expectedReturnDate` 与当前日期判断是否逾期

### 前端
1. **布局设计**：左侧固定宽度的物资清单 Sider，右侧自适应的主内容区
2. **状态管理**：使用 React useState + useEffect 管理数据状态，数据变更后自动刷新
3. **表单验证**：Ant Design Form 组件提供的表单规则验证
4. **错误处理**：API 调用失败时通过 message 组件提示用户
5. **加载状态**：初始加载时显示 Spin 组件

## 数据格式示例

**物资 (supplies.json):**
```json
[
  {
    "id": "uuid-xxx",
    "name": "投影仪",
    "category": "电子设备",
    "totalQuantity": 3,
    "availableQuantity": 1,
    "remark": "社区活动专用",
    "createdAt": "2026-05-01T00:00:00.000Z",
    "updatedAt": "2026-05-01T00:00:00.000Z"
  }
]
```

**借用记录 (borrowRecords.json):**
```json
[
  {
    "id": "uuid-yyy",
    "supplyId": "uuid-xxx",
    "quantity": 2,
    "borrower": "张三",
    "phone": "13800138000",
    "expectedReturnDate": "2026-05-03",
    "status": "borrowed",
    "returnedQuantity": 1,
    "returnHistory": [
      {
        "quantity": 1,
        "remark": "第一次归还",
        "returnedAt": "2026-05-02T10:00:00.000Z"
      }
    ],
    "createdAt": "2026-05-01T00:00:00.000Z",
    "updatedAt": "2026-05-02T10:00:00.000Z"
  }
]
```

## 未完成项 / 可扩展方向

1. **用户登录**：当前无用户认证，所有操作都是公开的
2. **数据导出**：支持导出 Excel/CSV 报表
3. **搜索功能**：物资名称、借用人姓名搜索
4. **分类管理**：分类的独立管理（当前分类是自由输入）
5. **通知提醒**：邮件/短信提醒逾期和今日应还
6. **操作日志**：记录所有操作的审计日志
7. **图片上传**：物资图片支持

## 常见问题

**Q: 数据存在哪里？**
A: 数据存储在 `backend/data/` 目录下的两个 JSON 文件中。如果目录不存在，服务启动时会自动创建。

**Q: 如何重置数据？**
A: 删除 `backend/data/` 目录下的两个 JSON 文件，或者清空其内容为 `[]`。

**Q: 端口被占用怎么办？**
A: 
- 后端：修改 `backend/src/server.js` 中的 `PORT` 变量
- 前端：修改 `frontend/vite.config.js` 中的 `server.port`，同时需要更新代理的目标端口

**Q: 为什么创建借用单时找不到某个物资？**
A: 新建借用单时只显示「可借数量 > 0」的物资。如果物资可借数量为 0，需要等有人归还后才能再次借用。
