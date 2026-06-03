# 污水厂池体巡检路线

不一致检测 · 遮挡点管理 · 安全员复核

## 解决什么问题

培训教官做巡检路线时，最怕临时补材料：障碍物备注已经确认、楼层剖面草图又冒出"照片有点位但坐标表缺一行"。本工具能自动检测这类不一致，在遮挡点清单里说明**为什么被留下、还缺什么材料、下一步该找安全员还是找培训教官老梁**，而不是写成冷冰冰的系统日志。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 创建项目并导入障碍物备注（第一步）

```bash
python -m sewage_inspection.cli create --name "A2O池体巡检" --plant "城东污水处理厂" --by 老梁
```

记下输出的项目 ID，例如 `abc123def456`。

```bash
python -m sewage_inspection.cli import-obstacles --project <项目ID> --file sample_data/obstacles.json
```

此时系统会检测：照片有点位但坐标表缺行 → 生成遮挡点，**不急着归正常，留给安全员复核**。

### 3. 培训教官老梁补看楼层剖面草图（第二步）

```bash
python -m sewage_inspection.cli import-floor-profiles --project <项目ID> --file sample_data/floor_profiles.json
```

补录后，遮挡点清单自动更新。

### 4. 补录坐标表（解决遮挡点）

```bash
python -m sewage_inspection.cli import-coordinates --project <项目ID> --file sample_data/coordinates.json
```

坐标表补录后，匹配上的遮挡点自动标记为已解决；仍然缺行的留给安全员复核。

### 5. 推进工作流并生成报告

```bash
python -m sewage_inspection.cli step --project <项目ID>
python -m sewage_inspection.cli report --project <项目ID>
```

报告里每条遮挡点都写明了：为什么被留下、还缺什么材料、下一步找谁。

### 6. 查看项目详情

```bash
python -m sewage_inspection.cli show --project <项目ID>
python -m sewage_inspection.cli list
```

## 使用 API / Web 看板

启动服务：

```bash
python -m sewage_inspection.api
```

浏览器打开 `http://127.0.0.0:8000` 即可使用 Web 看板。

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 列出所有项目 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/{id}` | 查看项目详情 |
| POST | `/api/projects/{id}/obstacles` | 导入障碍物备注 |
| POST | `/api/projects/{id}/floor-profiles` | 补录楼层剖面草图 |
| POST | `/api/projects/{id}/coordinates` | 补录坐标表 |
| POST | `/api/projects/{id}/step` | 推进工作流 |
| GET | `/api/projects/{id}/report` | 生成遮挡点清单报告 |
| POST | `/api/projects/{id}/occlusion/{oid}/escalate` | 升级遮挡点到安全员 |
| GET | `/api/projects/{id}/chart-data` | 获取3D/图表数据 |

### Web 看板功能

- **图表展示**：2D 散点图，绿色=坐标表行，蓝色=照片点位（已匹配），红色=照片有点位但坐标表缺行
- **3D 展示**：等轴测视图，红色虚线圆圈标记不一致点位
- **遮挡点清单**：每条说明为什么被留下、缺什么材料、下一步找谁；点击可跳转到关联的障碍物备注或楼层剖面草图
- **三步工作流**：障碍物备注导入 → 老梁补看楼层剖面草图 → 遮挡点清单更新

## 样例数据说明

- `sample_data/obstacles.json`：3 条障碍物备注，含 5 张照片引用和点位坐标
- `sample_data/floor_profiles.json`：2 条楼层剖面草图，含照片点位（坐标表缺行）
- `sample_data/coordinates.json`：3 行坐标表（只补录了部分，故意留缺行以演示遮挡点检测）

## 关键设计

1. **不一致检测**：照片标注了点位但坐标表没有对应行（容差 ±0.5），自动生成遮挡点
2. **不急着归正常**：遮挡点状态为"待安全员复核"，不自动标记为正常
3. **遮挡点清单说明**：每条包含"为什么被留下"、"还缺什么材料"、"下一步找安全员还是找老梁"
4. **3D/图表展示可回溯**：点到遮挡点时可跳转回障碍物备注或楼层剖面草图
5. **补录后自动更新**：补录楼层剖面草图或坐标表后，遮挡点清单自动刷新
