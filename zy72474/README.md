# 停车错峰共享匹配系统

## 核心设计原则

> 不怕界面简单，就怕结论看着很满，追证据时断在半路。

本系统专为城更项目经理阿宁设计，核心原则：
1. **原始材料不清洗** - 公交刷卡时段的备注、路口照片的原始信息完整保留
2. **边界规则代码化** - 所有判定规则写在代码里，不只靠口头约定
3. **操作可追溯** - 每次修改都有版本历史，可对比、可回滚
4. **证据链不断** - 从图表/3D展示能一键回到原始材料

---

## 一、边界规则（写在代码里，不只靠口头约定）

所有规则定义在 [src/rules/boundaryRules.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/rules/boundaryRules.js)

| 规则ID | 规则名称 | 判定逻辑 | 处理方式 |
|--------|----------|----------|----------|
| RULE_001 | 多街道归属判定 | 点位关联2个或以上街道 | 自动标记为「边界待复核」 |
| RULE_002 | 经纬度边界距离判定 | 点位经纬度距离街道边界线小于阈值 | 自动标记为「边界待复核」 |
| RULE_003 | 单街道自动确认 | 点位仅关联1个街道 | 自动确认为「正常」 |
| RULE_004 | 项目经理复核确认 | 人工选择归属街道 | 标记为「边界已确认」，记录操作人 |
| RULE_005 | 边界点位回滚 | 人工执行回滚操作 | 回到「边界待复核」状态 |

### 边界状态流转

```
正常 (normal)
  ↑
  |  RULE_003 (单街道自动确认)
  |
边界已确认 (boundary_confirmed) ←─── RULE_004 (项目经理确认)
  ↑                                       ↑
  |                                       |
  | RULE_005 (回滚)                       |
  |                                       |
边界待复核 (boundary_pending) ────────────┘
  ↑
  | RULE_001 (多街道) / RULE_002 (距离边界近)
  |
新点位创建
```

### 点位在两个街道边界上怎么判？

1. **自动判定**：系统根据街道数量或经纬度距离自动标记为「边界待复核」
2. **别急着归正常**：保留在待复核列表，等待项目经理人工处理
3. **怎么改**：在「边界复核」页面选择归属街道，点击「确认归属」
4. **怎么回滚**：在点位详情或边界复核页面点击「回滚到待复核」
5. **谁改的**：所有操作记录操作人、时间、改前改后状态

---

## 二、原始材料保留策略

### 不被清洗的数据

| 数据类型 | 存储位置 | 说明 |
|----------|----------|------|
| 点位原始备注 | `point.notes` | 完整保留，不会被摘要或清洗 |
| 路口照片原始信息 | `point.rawMaterials.originalPhotos` | 保留文件名、导入时间、文件哈希 |
| 公交刷卡原始备注 | `point.rawMaterials.originalBusCardData` | 保留rawText字段，不会被清洗成一行 |
| 所有修改历史 | `point.versions` | 每次修改都记录改前改后状态 |

### 代码位置

- 数据模型定义：[src/data/models.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/data/models.js#L29-L33)
- 原始材料存储逻辑：[src/data/store.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/data/store.js#L114-L119)

---

## 三、重复导入不翻倍

### 幂等导入机制

1. **照片去重**：每张照片计算 SHA256 文件哈希，存储在 `data/photo_hash_index.json`
2. **重复检测**：导入时先检查哈希索引，已存在的照片不会重复添加
3. **不影响计数**：重复导入不会让 `matchCount` 增加

### 代码位置

- 哈希生成：[server.js](file:///Users/lzy/pro/solo/workspaces/zy72474/server.js#L34-L37)
- 重复检测逻辑：[src/data/store.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/data/store.js#L104-L112)

---

## 四、版本历史与回滚

### 版本记录内容

每个版本包含：
- `versionId` - 版本唯一标识
- `timestamp` - 修改时间
- `action` - 操作类型（create/update/add_photo/rollback等）
- `reason` - 修改原因
- `previous` - 修改前的完整状态
- `current` - 修改后的完整状态
- `modifiedBy` - 操作人

### 支持的操作

1. **查看版本历史**：点位详情 → 版本历史标签
2. **对比两个版本**：点击「与前一版本对比」，红色显示改前，绿色显示改后
3. **回滚到任意版本**：点击「回滚到此版本」，回滚操作本身也会记录为新版本

### 代码位置

- 版本对比逻辑：[src/data/store.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/data/store.js#L222-L252)
- 回滚逻辑：[src/data/store.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/data/store.js#L161-L199)

---

## 五、三步工作流

### 标准流程

```
步骤1：路口照片导入
    ↓
步骤2：补看公交刷卡时段
    ↓
步骤3：地图导出更新
```

### 各阶段说明

| 阶段 | 状态标识 | 说明 |
|------|----------|------|
| 照片已导入 | `photo_imported` | 点位创建完成，照片已上传 |
| 公交刷卡已补充 | `bus_card_supplemented` | 阿宁补充了公交刷卡时段和备注 |
| 地图已导出 | `map_exported` | 数据已导出到地图 |

### 边界点位的特殊处理

**边界待复核的点位不能直接导出地图！**

在步骤3导出时，系统会检查：
- 如果点位是 `boundary_pending` 状态，导出会被拦截
- 提示："点位处于边界待复核状态，需项目经理确认后再导出"
- 阿宁需要先到「边界复核」页面确认归属

### 代码位置

- 工作流服务：[src/services/workflowService.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/services/workflowService.js)
- 导出检查逻辑：[src/services/workflowService.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/services/workflowService.js#L59-L68)

---

## 六、3D/图表展示的证据追溯

### 设计原则

> 先服务复核，再追求好看。点到一条点位在两个街道边界上时，要能回到路口照片或公交刷卡时段。

### 图表页面的证据链接

在点位详情 → 「图表/3D展示」标签页：
1. 顶部有醒目的提示："图表展示仅用于辅助分析"
2. 底部有三个快速跳转按钮：
   - 📷 查看路口照片
   - 🚌 查看公交刷卡时段
   - 📜 查看版本历史

点击按钮直接切换到对应标签页，证据链不中断。

### 代码位置

- 图表视图渲染：[public/app.js](file:///Users/lzy/pro/solo/workspaces/zy72474/public/app.js#L412-L437)
- 证据链接切换逻辑：[public/app.js](file:///Users/lzy/pro/solo/workspaces/zy72474/public/app.js#L439-L444)

---

## 七、快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

访问 http://localhost:3000

### 数据存储位置

- 点位数据：`data/points.json`
- 照片哈希索引：`data/photo_hash_index.json`
- 上传的照片：`uploads/photos/`

---

## 八、API 接口

### 点位管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/points` | 获取点位列表，支持 boundaryStatus、workflowStage 筛选 |
| GET | `/api/points/:pointId` | 获取单个点位详情 |
| POST | `/api/points` | 创建点位 |
| PUT | `/api/points/:pointId` | 更新点位 |
| POST | `/api/points/:pointId/photos` | 上传照片（支持批量，自动去重） |
| POST | `/api/points/:pointId/bus-cards` | 补充公交刷卡时段 |

### 版本管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/points/:pointId/versions` | 获取版本历史 |
| GET | `/api/points/:pointId/versions/compare?v1=xxx&v2=xxx` | 对比两个版本 |
| POST | `/api/points/:pointId/rollback` | 回滚到指定版本 |

### 边界复核

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/points/:pointId/review-boundary` | 确认或回滚边界点位 |

### 工作流

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/map/export` | 导出地图数据（边界待复核点位会被拦截） |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rules/boundary` | 获取所有边界规则 |
| GET | `/api/stats` | 获取统计数据 |
| GET | `/api/enums` | 获取枚举值 |

---

## 九、目录结构

```
.
├── server.js                 # API 服务器入口
├── package.json
├── README.md                 # 本文档（边界规则在这里！）
├── public/                   # 前端静态文件
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   ├── data/
│   │   ├── models.js         # 数据模型定义
│   │   └── store.js          # 数据存储层
│   ├── rules/
│   │   └── boundaryRules.js  # 边界规则引擎（核心！）
│   └── services/
│       └── workflowService.js # 工作流服务
├── data/                     # 数据文件（自动创建）
│   ├── points.json
│   └── photo_hash_index.json
└── uploads/                  # 上传文件（自动创建）
    └── photos/
```

---

## 十、注意事项

1. **边界规则修改**：如果需要调整边界判定逻辑，修改 [src/rules/boundaryRules.js](file:///Users/lzy/pro/solo/workspaces/zy72474/src/rules/boundaryRules.js)，同时更新本文档的规则说明
2. **数据备份**：定期备份 `data/` 目录
3. **操作人记录**：所有修改接口都支持传 `modifiedBy` / `reviewedBy` 字段，建议填写真实姓名
4. **不要直接修改JSON文件**：通过API操作，否则版本历史会断裂

---

*最后更新：2026-06-07*
*城更项目经理：阿宁*
