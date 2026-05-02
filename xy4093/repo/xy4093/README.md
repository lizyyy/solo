# 台风撤房物资联动表系统

一个为海岛民宿管家设计的台风预警期间全栈管理系统，实现住客撤离、物资管理、船班安排的一体化联动。

## 功能特性

### 核心功能
- **房态管理**：实时维护房间状态（有人/已清空/已封窗），支持批量导入
- **住客管理**：高优先级识别（老人、儿童、行动不便），支持分配批次和标记撤离
- **船班管理**：维护可用船班信息和容量
- **物资管理**：发电机燃油、饮水、食品、药品、沙袋部署状态，保底线预警
- **撤离排程**：一键生成撤离方案（老人儿童优先），支持人工调整
- **数据导出**：Markdown值班单、CSV船班名单、JSON审计包

### 规则引擎
- **优先级校验**：老人(100分) > 儿童(90分) > 行动不便(80分) > 普通(0分)
- **容量校验**：船班容量限制，超容量预警
- **物资底线**：低于保底线自动告警
- **封窗校验**：房间必须先清空才能标记封窗

### 数据持久化
- 使用 SQLite 本地数据库
- 刷新页面数据不丢失
- 事务保证数据一致性

## 技术栈

### 后端
- **框架**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **跨域**: CORS
- **其他**: uuid, better-sqlite3

### 前端
- **框架**: React 18
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **路由**: React Router
- **HTTP客户端**: Axios
- **图标**: Lucide React
- **通知**: React Hot Toast

## 项目结构

```
xy4093/
├── package.json              # 根目录配置
├── server/                   # 后端代码
│   ├── index.js             # Express服务器入口
│   ├── database/            # 数据库模块
│   │   ├── db.js           # 数据库连接和通用函数
│   │   └── schema.js       # 数据表结构定义
│   ├── routes/             # API路由
│   │   ├── rooms.js        # 房间管理API
│   │   ├── guests.js       # 住客管理API
│   │   ├── ships.js        # 船班管理API
│   │   ├── supplies.js     # 物资管理API
│   │   ├── batches.js      # 撤离批次API
│   │   └── export.js       # 导出API
│   ├── services/           # 业务逻辑
│   │   ├── rulesEngine.js  # 规则引擎
│   │   ├── scheduler.js    # 排程服务
│   │   └── exportService.js# 导出服务
│   ├── scripts/            # 工具脚本
│   │   └── seedData.js     # 示例数据脚本
│   └── test/               # 测试用例
│       └── rulesEngine.test.js
├── client/                  # 前端代码
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx        # 入口文件
│       ├── App.jsx         # 主应用
│       ├── index.css       # 全局样式
│       ├── components/
│       │   └── Layout.jsx  # 布局组件
│       ├── pages/
│       │   ├── Dashboard.jsx   # 仪表盘
│       │   ├── Rooms.jsx       # 房间管理
│       │   ├── Guests.jsx      # 住客管理
│       │   ├── Ships.jsx       # 船班管理
│       │   ├── Supplies.jsx    # 物资管理
│       │   ├── Batches.jsx     # 撤离批次
│       │   └── Export.jsx      # 数据导出
│       ├── services/
│       │   └── api.js          # API服务封装
│       └── store/
│           └── store.js        # Zustand状态管理
└── data/                    # SQLite数据库文件目录
    └── typhoon.db          # 数据库文件（运行后自动创建）
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装步骤

1. **安装后端依赖**
```bash
cd /path/to/xy4093
npm install
```

2. **安装前端依赖**
```bash
cd client
npm install
cd ..
```

3. **初始化示例数据（可选）**
```bash
node server/scripts/seedData.js
```

4. **启动开发服务器**
```bash
npm run dev
```

这将同时启动：
- 后端服务: http://localhost:3001
- 前端开发服务器: http://localhost:5173

### 生产环境部署

1. **构建前端**
```bash
cd client
npm run build
cd ..
```

2. **启动后端服务**
```bash
npm start
```

访问 http://localhost:3001 即可使用。

## 验证流程

### 1. 系统启动验证

启动后，检查以下端点是否正常：

**健康检查**
```bash
curl http://localhost:3001/api/health
```
预期返回：
```json
{
  "success": true,
  "message": "台风撤房物资联动表系统运行正常",
  "timestamp": "2025-07-XX..."
}
```

**状态检查**
```bash
curl http://localhost:3001/api/status
```
预期返回包含住客、房间、批次、物资状态的完整数据。

### 2. 功能验证流程

#### 步骤1：初始化示例数据
```bash
node server/scripts/seedData.js
```
验证输出：
```
=====================================
  示例数据插入完成！
=====================================
  房间: 10 间
  住客: 24 人
  船班: 3 艘
  物资: 10 项
  沙袋部署点: 5 个
=====================================
  高优先级住客: 7 人 (老人、儿童、行动不便)
=====================================
```

#### 步骤2：访问前端界面
打开浏览器访问 http://localhost:5173

#### 步骤3：验证仪表盘功能
- 检查是否显示住客统计、房间状态、船班、物资状态
- 检查高优先级住客告警是否正确显示
- 点击"刷新数据"按钮验证数据更新

#### 步骤4：验证规则引擎 - 优先级校验
1. 进入"住客管理"页面
2. 验证以下住客是否标有高优先级标签：
   - 王大明 (72岁，老人)
   - 李秀英 (68岁，老人)
   - 张小华 (8岁，儿童)
   - 陈晓晓 (5岁，儿童)
   - 刘建国 (75岁，老人+行动不便)
   - 孙小宝 (3岁，儿童)
   - 黄小雪 (10岁，儿童)

#### 步骤5：验证一键生成撤离方案
1. 进入"撤离批次"页面
2. 点击"一键生成方案"
3. 验证弹出的方案：
   - 第1批次应优先安排高优先级住客
   - 统计信息应显示正确的总人数和批次数量

#### 步骤6：验证物资底线校验
1. 进入"物资管理"页面
2. 验证以下物资显示告警（红色）：
   - 发电机柴油 (80升 < 100升底线)
   - 桶装饮用水 (15桶 < 20桶底线)
3. 验证沙袋部署点：
   - 正门入口、后门入口、地下车库入口 显示不足/空

#### 步骤7：验证封窗规则
1. 进入"房间管理"页面
2. 尝试点击任意房间的"封窗"按钮
3. 验证系统提示"房间内还有住客，不能封窗"
   - 规则：必须先清空房间才能封窗

#### 步骤8：验证手动分配批次
1. 在"住客管理"页面
2. 为待分配住客选择一个批次
3. 验证操作成功提示

#### 步骤9：验证导出功能
1. 进入"数据导出"页面
2. 测试三种导出：
   - **Markdown值班单**：点击预览，验证格式
   - **CSV船班名单**：选择批次后导出
   - **JSON审计包**：验证包含完整数据

#### 步骤10：验证数据持久化
1. 刷新浏览器页面
2. 验证所有数据仍然存在
3. 验证数据库文件 `data/typhoon.db` 已创建

### 3. API端点验证

#### 房间管理
```bash
# 获取所有房间
curl http://localhost:3001/api/rooms

# 创建房间
curl -X POST http://localhost:3001/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"room_number":"401","floor":4,"capacity":2}'

# 封窗（会触发规则校验）
curl -X POST http://localhost:3001/api/rooms/[ROOM_ID]/seal-window
```

#### 住客管理
```bash
# 获取所有住客
curl http://localhost:3001/api/guests

# 标记撤离
curl -X POST http://localhost:3001/api/guests/[GUEST_ID]/evacuate

# 分配批次
curl -X POST http://localhost:3001/api/guests/[GUEST_ID]/assign-batch \
  -H "Content-Type: application/json" \
  -d '{"batch_id":"[BATCH_ID]"}'
```

#### 撤离批次
```bash
# 生成撤离方案
curl -X POST http://localhost:3001/api/batches/generate-plan \
  -H "Content-Type: application/json" \
  -d '{"priorityFirst":true,"batchSize":20}'

# 开始批次
curl -X POST http://localhost:3001/api/batches/[BATCH_ID]/start

# 完成批次
curl -X POST http://localhost:3001/api/batches/[BATCH_ID]/complete
```

#### 导出
```bash
# 下载值班单
curl http://localhost:3001/api/export/duty-sheet

# 下载船班名单
curl http://localhost:3001/api/export/ship-list

# 下载审计包
curl http://localhost:3001/api/export/audit-package
```

## 数据模型

### 核心数据表

#### 1. rooms (房间表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| room_number | TEXT | 房间号 |
| floor | INTEGER | 楼层 |
| capacity | INTEGER | 容纳人数 |
| building | TEXT | 楼座 |
| is_occupied | INTEGER | 是否有人 |
| is_evacuated | INTEGER | 是否已撤离 |
| is_window_sealed | INTEGER | 是否已封窗 |
| notes | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### 2. guests (住客表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| room_id | TEXT | 关联房间ID |
| name | TEXT | 姓名 |
| age | INTEGER | 年龄 |
| gender | TEXT | 性别 |
| phone | TEXT | 手机号 |
| id_number | TEXT | 身份证号 |
| is_elderly | INTEGER | 是否老人(>=65) |
| is_child | INTEGER | 是否儿童(<18) |
| has_disability | INTEGER | 是否行动不便 |
| is_evacuated | INTEGER | 是否已撤离 |
| evacuation_batch_id | TEXT | 关联批次ID |
| checkin_date | DATE | 入住日期 |
| checkout_date | DATE | 退房日期 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### 3. ships (船班表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| name | TEXT | 船名 |
| capacity | INTEGER | 容量 |
| current_load | INTEGER | 当前载客 |
| status | TEXT | 状态(available/in_use/maintenance) |
| notes | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### 4. supplies (物资表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| type | TEXT | 类型(fuel/water/food/medicine) |
| name | TEXT | 名称 |
| quantity | INTEGER | 数量 |
| unit | TEXT | 单位(升/瓶/包/盒) |
| min_threshold | INTEGER | 最小保底线 |
| status | TEXT | 状态(sufficient/low/critical) |
| notes | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### 5. sandbags (沙袋表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| location | TEXT | 部署位置 |
| quantity | INTEGER | 当前数量 |
| needed | INTEGER | 需要数量 |
| status | TEXT | 状态(sufficient/insufficient/empty) |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### 6. evacuation_batches (撤离批次表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| batch_number | INTEGER | 批次号 |
| ship_id | TEXT | 关联船班ID |
| priority | TEXT | 优先级(high/normal) |
| status | TEXT | 状态(planned/in_progress/completed) |
| guest_count | INTEGER | 住客数量 |
| max_capacity | INTEGER | 最大容量 |
| scheduled_time | DATETIME | 计划时间 |
| actual_time | DATETIME | 实际时间 |
| departure_location | TEXT | 出发地点 |
| arrival_location | TEXT | 到达地点 |
| notes | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### 7. audit_logs (审计日志表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键UUID |
| action | TEXT | 操作类型 |
| entity_type | TEXT | 实体类型(room/guest/ship/supply/batch) |
| entity_id | TEXT | 实体ID |
| details | TEXT | 详细信息(JSON) |
| created_by | TEXT | 操作人 |
| created_at | DATETIME | 创建时间 |

## 规则引擎详解

### 优先级评分规则
```javascript
// 评分逻辑
if (is_elderly) score = 100;
else if (is_child) score = 90;
else if (has_disability) score = 80;
else score = 0;

// 可叠加标签
tags = [];
if (is_elderly) tags.push('老人');
if (is_child) tags.push('儿童');
if (has_disability) tags.push('行动不便');
```

### 排程算法
```
1. 对待撤离住客按优先级排序：
   - 高优先级组：老人、儿童、行动不便
   - 普通组：其他住客

2. 根据船班容量创建批次：
   - 优先将高优先级组分配到靠前批次
   - 每个批次不超过船班容量

3. 生成批次信息：
   - 批次号、船班关联、优先级标记
   - 住客列表按优先级排序显示
```

### 物资状态判定
```javascript
percentage = (quantity / min_threshold) * 100;

if (percentage >= 100) status = 'sufficient';   // 充足
else if (percentage >= 50) status = 'low';        // 偏低
else status = 'critical';                          // 严重不足
```

### 封窗规则
```javascript
function validateRoomClearForSeal(roomId) {
  // 查询房间内未撤离的住客
  const remainingGuests = count guests where 
    room_id = roomId and is_evacuated = 0;
  
  if (remainingGuests > 0) {
    return {
      valid: false,
      error: `房间内还有 ${remainingGuests} 名住客，请先清空`
    };
  }
  return { valid: true };
}
```

## 测试

### 运行测试
```bash
npm test
```

### 测试覆盖
- **规则引擎测试**：优先级计算、容量校验、物资底线
- **排程测试**：方案生成、住客标记、封窗校验
- **数据库测试**：基本查询、事务处理
- **API测试**：可通过Postman或curl验证

## 常见问题

### Q1: 数据库文件在哪里？
A: 系统运行后会在项目根目录创建 `data/typhoon.db` 文件。可以使用 SQLite 客户端工具查看。

### Q2: 如何重置数据？
A: 运行以下命令清空并重新生成示例数据：
```bash
node server/scripts/seedData.js --clear
node server/scripts/seedData.js
```

### Q3: 如何修改默认物资底线？
A: 有两种方式：
1. 在 `物资管理` 页面编辑单个物资的保底线
2. 修改 `server/database/db.js` 中的 `insertDefaultSupplies` 函数

### Q4: 如何添加自定义船班？
A: 进入 `船班管理` 页面，点击"添加船班"，填写船名和容量即可。

### Q5: 为什么封窗按钮是灰色的？
A: 房间必须先清空（所有住客已撤离）才能封窗。这是系统的安全规则。

## 开发说明

### 添加新API路由
1. 在 `server/routes/` 创建新的路由文件
2. 在 `server/index.js` 中引入并注册路由
3. 在 `client/src/services/api.js` 添加前端API封装
4. 在 `client/src/store/store.js` 添加状态管理

### 自定义主题颜色
修改 `client/tailwind.config.js` 中的 colors 配置。

### 数据库迁移
由于使用 SQLite，可直接操作 `.db` 文件。建议：
- 开发环境：删除 `data/typhoon.db` 重新初始化
- 生产环境：编写 ALTER TABLE 迁移脚本

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**版本**: 1.0.0  
**最后更新**: 2025年7月  
**维护者**: 项目团队
