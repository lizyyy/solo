# 纸箱厂品控数据分析工具

一个为小型纸箱厂品控员设计的本地数据分析工具，用于综合评估订单风险。

## 功能特点

- 📊 **风险评估**: 综合分析抗压不足、受潮超期、堆码层数安全风险
- 📥 **数据导入**: 支持 CSV 和 JSON 格式批量导入
- 💾 **数据持久化**: SQLite 本地数据库存储，支持人工复核备注
- 📈 **可视化**: 风险图表和订单明细展示
- ✏️ **人工改判**: 支持人工复核改判，刷新不丢失数据
- 📄 **导出功能**: 导出 Markdown 放行单和 JSON 审计明细

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js)
- **前端**: 原生 HTML/CSS/JavaScript + Chart.js
- **数据解析**: PapaParse (CSV)

## 项目结构

```
xy4496/
├── package.json           # 项目依赖配置
├── server.js              # Express 服务器主文件
├── database.js            # SQLite 数据库模块
├── riskAnalysis.js        # 风险分析算法
├── public/                # 前端静态文件
│   ├── index.html         # 主页面
│   ├── css/
│   │   └── style.css      # 样式文件
│   └── js/
│       └── app.js         # 前端逻辑
├── samples/               # 示例数据文件
│   ├── orders.csv
│   ├── batches.csv
│   ├── tests.csv
│   ├── environment.csv
│   ├── loading.csv
│   └── sample_data.json
├── data/                  # 数据库存储目录 (运行时生成)
└── uploads/               # 上传文件临时目录 (运行时生成)
```

## 安装与启动

### 前置要求

- Node.js 14.0+
- npm 或 yarn

### 安装步骤

1. **安装依赖**

```bash
cd /path/to/xy4496
npm install
```

2. **启动服务器**

```bash
npm start
```

或者使用开发模式（自动重启）：

```bash
npm run dev
```

3. **访问应用**

打开浏览器访问：http://localhost:3000

## 验证步骤

### 步骤 1: 导入示例数据

1. 启动服务器后，在浏览器打开 http://localhost:3000
2. 点击导航栏中的 **"数据导入"** 标签
3. 点击 **"🚀 一键导入示例数据"** 按钮
4. 等待提示 "示例数据导入完成！"

> 或者手动导入：
> - 选择数据类型，依次导入 `samples/` 目录下的 CSV 文件
> - 或者直接导入 `samples/sample_data.json`

### 步骤 2: 查看仪表盘

1. 切换到 **"仪表盘"** 标签
2. 验证以下数据：
   - **总订单数**: 应显示 5
   - **高风险**: 应显示 1-2 个（取决于测试数据）
   - **中风险**: 应显示 2-3 个
   - **低风险**: 应显示 1-2 个
   - **风险分布饼图**: 应显示各类风险的比例
   - **风险趋势图**: 应显示日期趋势

### 步骤 3: 查看订单列表

1. 切换到 **"订单列表"** 标签
2. 验证以下内容：
   - 表格应显示 5 个订单
   - 每个订单应有风险标签（高/中/低风险）
   - 每个订单应有抗压、受潮、堆码三个维度的风险评估
   - 操作列应有 "查看" 和 "改判" 按钮

3. **测试筛选功能**：
   - 在 "风险筛选" 下拉框选择 "高风险"
   - 表格应只显示高风险订单
   - 在搜索框输入订单号（如 "ORD-2026-001"）进行搜索

### 步骤 4: 查看订单详情

1. 在订单列表中，点击任意订单的 **"查看"** 按钮
2. 或者切换到 **"订单详情"** 标签，在下拉框选择订单
3. 验证详情页面包含：
   - **基本信息**: 订单号、箱型、尺寸、客户、数量等
   - **风险评估详情**: 抗压、受潮、堆码三个维度的详细说明
   - **测试数据**: 边压强度、耐破强度等测试结果
   - **装车信息**: 车牌号、堆码层数、总重量等
   - **复核备注**: 可添加新备注的表单

### 步骤 5: 测试人工改判

1. 在订单列表中，点击任意订单的 **"改判"** 按钮
2. 或者在订单详情页点击 **"✏️ 人工改判"** 按钮
3. 在弹出的改判模态框中：
   - 确认原评估结果
   - 选择新的风险等级（如将高风险改为中风险）
   - 填写改判理由（必填）
   - 填写复核人姓名
   - 点击 **"确认改判"**

4. 验证改判结果：
   - 订单列表中该订单的风险标签应已更新
   - 订单详情页应显示 "人工改判记录" 卡片
   - 仪表盘数据应同步更新

### 步骤 6: 测试导出功能

1. 在订单详情页，选择一个订单
2. 点击 **"📄 导出放行单 (Markdown)"** 按钮
3. 应下载一个 `.md` 文件，内容包含：
   - 订单基本信息
   - 风险评估结果
   - 测试数据
   - 装车信息
   - 复核备注（如有）

4. 点击 **"📋 导出审计明细 (JSON)"** 按钮
5. 应下载一个 `.json` 文件，包含完整的审计数据：
   - 订单信息
   - 评估记录
   - 测试结果
   - 装车信息
   - 复核备注
   - 风险阈值配置

### 步骤 7: 测试数据持久化

1. 完成以上操作后，**刷新浏览器页面**
2. 验证：
   - 仪表盘数据应保持不变
   - 人工改判记录应仍然存在
   - 所有数据未丢失

3. **重启服务器后验证**：
   - 停止服务器 (Ctrl+C)
   - 重新启动 `npm start`
   - 刷新浏览器
   - 验证所有数据仍然存在

## 风险分析逻辑

### 抗压风险评估

基于边压强度和耐破强度测试数据：

| 条件 | 风险等级 |
|------|----------|
| 边压/耐破 < 标准值的 70% | 高风险 |
| 70% ≤ 边压/耐破 < 85% | 中风险 |
| 边压/耐破 ≥ 85% | 低风险 |

### 受潮风险评估

基于仓库温湿度和库存时间：

| 条件 | 风险等级 |
|------|----------|
| 湿度 > 80% 或 库存 > 30天 | 高风险 |
| 湿度 > 70% 且 ≤ 5天 或 库存 > 15天 | 中风险 |
| 湿度正常且库存时间合理 | 低风险 |

### 堆码风险评估

基于装车堆码层数：

| 条件 | 风险等级 |
|------|----------|
| 堆码层数 > 7层 | 高风险 |
| 5层 < 堆码层数 ≤ 7层 | 中风险 |
| 堆码层数 ≤ 5层 | 低风险 |

### 综合风险判定

- 存在任意 **高风险** 维度 → 综合高风险
- 存在 **2个以上中风险** 维度 → 综合中风险
- 所有维度 **低风险** → 综合低风险

## API 接口

### 订单管理

- `GET /api/orders` - 获取所有订单
- `GET /api/orders/:orderNumber` - 获取订单详情
- `POST /api/orders` - 创建新订单
- `POST /api/orders/:orderNumber/override` - 人工改判
- `POST /api/orders/:orderNumber/notes` - 添加备注

### 数据分析

- `POST /api/analyze/:orderNumber` - 分析单个订单
- `POST /api/analyze-all` - 分析所有订单
- `GET /api/statistics` - 获取统计数据

### 数据导出

- `GET /api/export/markdown/:orderNumber` - 导出 Markdown 放行单
- `GET /api/export/json/:orderNumber` - 导出 JSON 审计明细

### 数据导入

- `POST /api/import/csv` - 导入 CSV 文件
- `POST /api/import/json` - 导入 JSON 文件

## 数据格式说明

### CSV 导入格式

**订单信息 (orders.csv):**
```csv
order_number,box_type,box_size,customer_name,quantity,production_date
ORD-001,A楞,50x30x40,阿里巴巴,500,2026-04-20
```

**纸板批次 (batches.csv):**
```csv
batch_number,corrugated_type,paper_grade,manufacturer,production_date,expiration_date
CB-001,A楞,K级,华润纸业,2026-04-01,2026-06-30
```

**测试结果 (tests.csv):**
```csv
order_number,batch_number,edge_crush,edge_crush_min,burst_strength,burst_strength_min,test_date,tester
ORD-001,CB-001,85,100,180,200,2026-04-21,张三
```

**温湿度记录 (environment.csv):**
```csv
record_date,temperature,humidity,location,recorded_by
2026-04-20,22,65,仓库A,管理员
```

**装车清单 (loading.csv):**
```csv
order_number,vehicle_number,loading_date,stack_layers,total_weight,destination
ORD-001,京A12345,2026-04-25,8,1500,杭州
```

### JSON 导入格式

```json
{
  "orders": [...],
  "batches": [...],
  "tests": [...],
  "environment": [...],
  "loading": [...]
}
```

## 故障排除

### 数据库问题

- 数据库文件位于 `data/qc.db`
- 如需重置数据，删除 `data/` 目录后重启服务器

### 依赖问题

```bash
# 清理 node_modules 重新安装
rm -rf node_modules
npm install
```

### 端口冲突

修改 `server.js` 中的端口：
```javascript
const PORT = process.env.PORT || 3000;
```

或者使用环境变量：
```bash
PORT=8080 npm start
```

## 许可证

MIT License
