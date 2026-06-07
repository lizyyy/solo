# 儿童友好街区评分系统

## 系统定位
项目经理开会前10分钟能用，交通协管老马不用翻照片就能看到点位是否在街道边界上。

## 三种入口

### 1. 命令行 (CLI)
```bash
# 初始化演示数据
python3 backend/cli.py init

# 查看点位列表
python3 backend/cli.py list

# 查看点位详情
python3 backend/cli.py show point_002

# 补录公交刷卡时段
python3 backend/cli.py add-bus point_003 --bus-id bus_001

# 人工修正评分
python3 backend/cli.py correct point_002 --traffic 72.0 --reason "项目经理复核"

# 重跑评分
python3 backend/cli.py rerun point_001

# 导出地图数据
python3 backend/cli.py export --output exports/map.geojson

# 完整流程演示（给新人讲流程用）
python3 backend/cli.py demo
```

### 2. API 接口
```
GET  /api/points                          # 点位列表
GET  /api/points/<id>                     # 点位详情
POST /api/points/import                   # 导入点位
POST /api/points/<id>/add-bus             # 补录公交时段
POST /api/points/<id>/manual-correct      # 人工修正
POST /api/points/<id>/rerun               # 重跑评分
GET  /api/streets                         # 街道列表
GET  /api/bus-data                        # 公交数据列表
POST /api/export-map                      # 导出地图
```

### 3. Web 小看板
启动服务:
```bash
python3 backend/app.py  # 默认端口5000，被占用则用5001
```
访问: `http://localhost:5001`

功能:
- 左侧点位列表：一眼看出哪些是边界（黄色标记）
- 中间地图：直观看到点位位置和街道边界
- 右侧详情面板：照片、评分明细、公交数据、历史记录
- 操作按钮：补录公交、人工修正、重跑评分、导出地图

## 演示数据说明

### 三条样例记录，三种处理结果

| 点位 | 类型 | 位置 | 评分 | 等级 | 计算方法 |
|------|------|------|------|------|----------|
| point_001 解放路小学路口 | 顺利记录 | 解放路街道内 | 82.7 | 优秀 | new_caliber |
| point_002 朝阳解放交界路口 | 边界点位 | 朝阳路/解放路边界 | 52.6 | 合格 | new_caliber |
| point_003 朝阳路三小路口 | 旧口径 | 朝阳路街道内 | 59.9 | 合格 | old_caliber |

### 包含的完整数据
- ✅ 路口照片 3 张
- ✅ 公交刷卡时段数据 3 条（含新旧口径）
- ✅ 评分历史（每条都有一次以上记录）
- ✅ 一次人工修正示例
- ✅ 一次重跑评分

## 完整工作流程

### 第一步：点位导入 + 自动边界检测
1. 导入路口照片和坐标
2. 系统自动检测：点位在街道内还是边界上
3. **关键点**：边界点位不急着归正常，标记为"待复核"留给项目经理

### 第二步：交通协管老马补看公交刷卡时段
1. 点位列表找出还没公交数据的
2. 补录对应公交线路的刷卡时段（上下学高峰）
3. 系统自动重跑评分，公交可达分更新
4. 旧口径数据会明确标注，不会混到新口径里

### 第三步：地图导出更新
1. 补录公交或人工修正后，点"导出地图"
2. 导出的 GeoJSON 包含最新的评分、边界状态
3. 可直接导入 GIS 系统或在线地图查看
4. **证据链不断**：每一步修改都留痕，评分历史可追溯

## 数据文件位置

| 内容 | 路径 |
|------|------|
| 街道边界数据 | `backend/data/streets.json` |
| 公交刷卡数据 | `backend/data/bus_data.json` |
| 点位评分数据 | `backend/data/points.json` |
| 路口照片 | `photos/` |
| 地图导出 | `exports/` |

## 给新人讲流程的步骤（用 demo 命令）
```
python3 backend/cli.py demo
```

会依次演示：
1. 初始化 3 条演示数据
2. 列表展示三种不同类型
3. 点开边界点位详情，看边界标记
4. 补录 point_003 的公交数据（旧口径），看评分变化
5. 人工修正 point_002（项目经理复核）
6. 重跑 point_001 评分
7. 导出最终地图
8. 最后对比三种处理结果的不同
