# 电商赠品拆单退款系统
## 功能概述
这是一个完整的电商赠品拆单退款系统，包含以下核心功能：
- **活动门槛管理**：配置满赠活动规则
- **赠品库存管理**：实时监控赠品库存，支持库存扣减和归还
- **订单拆单**：支持订单拆单操作，记录拆单历史
- **部分退款**：支持订单部分退款，自动检测是否影响赠品资格
- **人工补赠**：特殊情况下人工补发赠品，留痕可追溯
- **资格重算**：支持订单赠品资格重新计算，记录重算前后数据
- **报表导出**：支持按操作人、业务类型、时间范围筛选导出Excel报表
## 技术特点
### 后端（Node.js + Express + SQLite）
- **幂等机制**：通过请求ID防止重复提交
- **状态历史**：所有业务操作都记录变更前后状态和值
- **错误处理**：统一的错误返回格式
- **事务支持**：关键操作（如库存扣减）使用数据库事务
### 前端（React + Ant Design）
- **统计卡片**：首页展示订单总数、获赠订单数、未达标订单数、拆单数、退款数、人工补赠数
- **状态按钮**：各业务模块支持操作按钮和状态展示
- **历史追溯**：所有业务都支持查看变更历史记录
- **导出功能**：支持Excel报表导出
## 快速开始
### 1. 安装后端依赖
```bash
cd backend
npm install
```
### 2. 初始化样例数据
```bash
node sampleData.js
```
### 3. 启动后端服务
```bash
npm start
```
后端服务运行在 http://localhost:3001
### 4. 安装前端依赖
```bash
cd ../frontend
npm install
```
### 5. 启动前端服务
```bash
npm run dev
```
前端服务运行在 http://localhost:3000
## 核心功能验证
### 赠品库存校验
1. 进入「赠品库存」页面
2. 查看可用库存数量
3. 执行人工补赠操作（会扣减库存）
4. 查看库存变更历史记录
### 人工补赠留痕
1. 进入「人工补赠」页面
2. 点击「新增补赠」
3. 选择订单、赠品，填写数量和原因
4. 提交后在列表中查看记录
5. 操作记录会同步到状态历史表中
### 资格重算查询
#### 页面端：
1. 进入「资格重算」页面
2. 点击「手动重算」，选择订单
3. 提交后查看重算结果（达标/未达标）
4. 点击「详情」查看重算前后的数据对比
#### 接口端：
```bash
# 订单资格检查接口
POST /api/orders/{order_id}/check-qualification
Body: { "operator": "操作人" }
# 资格重算接口
POST /api/recalculations
Body: { "order_id": "订单ID", "recalculate_type": "manual", "operator": "操作人" }
```
## API接口列表
### 活动管理
- `GET /api/activities` - 获取活动列表
- `POST /api/activities` - 创建活动
- `PUT /api/activities/:id` - 更新活动
### 库存管理
- `GET /api/inventory` - 获取库存列表
- `POST /api/inventory` - 创建库存
- `POST /api/inventory/check-deduct` - 库存扣减（带检查）
- `POST /api/inventory/return` - 库存归还
### 订单管理
- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders` - 创建订单
- `POST /api/orders/:id/check-qualification` - 检查赠品资格
### 拆单记录
- `GET /api/split-orders` - 获取拆单列表
- `POST /api/split-orders` - 创建拆单
### 退款记录
- `GET /api/refunds` - 获取退款列表
- `POST /api/refunds` - 创建退款
### 人工补赠
- `GET /api/manual-gifts` - 获取人工补赠列表
- `POST /api/manual-gifts` - 创建人工补赠
### 资格重算
- `GET /api/recalculations` - 获取重算列表
- `POST /api/recalculations` - 创建资格重算
### 状态历史
- `GET /api/history` - 获取历史记录（支持business_type、business_id筛选）
### 统计和导出
- `GET /api/stats` - 获取统计数据
- `POST /api/export/report` - 导出报表（支持start_date、end_date、operator、business_type筛选）
- `GET /api/export/operators` - 获取操作人列表
## 数据库表结构
- `activities` - 活动表
- `gift_inventory` - 赠品库存表
- `orders` - 订单表
- `order_items` - 订单项表
- `split_orders` - 拆单记录表
- `refunds` - 退款记录表
- `manual_gifts` - 人工补赠记录表
- `qualification_recalculations` - 资格重算记录表
- `status_history` - 状态历史表（所有业务的变更记录）
- `idempotent_records` - 幂等记录表
## 样例数据
运行`node sampleData.js`会生成以下样例数据：
- 2个满赠活动
- 2个赠品库存（保温杯100件、耳机50件）
- 5个订单（包含各种状态）
- 拆单记录、退款记录、人工补赠记录
- 资格重算记录和各种状态历史
## 验收要点
1. ✅ 赠品库存正确校验，库存不足时无法扣减
2. ✅ 人工补赠有完整记录，包含操作人、原因、时间
3. ✅ 资格重算前后数据可在页面和接口查询
4. ✅ 活动门槛、赠品库存、订单拆单的修改前后值都有记录
5. ✅ 导出报表支持按责任人和处理时间筛选
6. ✅ 所有接口支持幂等请求
7. ✅ 前端有统计卡片和状态按钮
