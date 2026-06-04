# 管道水锤压力试算系统

整合设备铭牌参数与维修群截图，支持参数溯源、人工改系数据标记与复核工作流。

## 快速开始

### 1. 安装依赖

```bash
pip install -e .
```

### 2. 三步工作流完整演示

#### 第一步：导入设备铭牌参数并计算

```bash
# 导入设备铭牌参数
whcalc import-nameplate --file samples/nameplate_001.json

# 执行水锤压力试算
whcalc calculate --file samples/calc_input_001.json --calc-id demo-step1

# 查看参数回放页（此时有未说明原因的人工改系数）
whcalc replay --calc-id demo-step1
```

注意：此时 friction_factor 被人工改过但未写原因，系统会标记为"需设备工程师复核"。

#### 第二步：训练教练老唐补看维修群截图

```bash
# 导入维修群截图
whcalc import-screenshot --file samples/screenshot_001.json

# 将截图证据链接到计算参数
whcalc link-screenshot --calc-id demo-step1 --screenshot-id SCREEN-2024-001

# 再次查看参数回放，参数溯源已更新
whcalc replay --calc-id demo-step1
```

#### 第三步：设备工程师复核并补充原因

```bash
# 为人工改系数补充原因
whcalc add-reason --calc-id demo-step1 --param friction_factor --reason "老唐提供的管道结垢照片显示实际粗糙度大于设计值"

# 最终结果，分类变为正常
whcalc replay --calc-id demo-step1
```

### 3. Web 看板（3D/图表展示 + 溯源跳转）

```bash
uvicorn water_hammer_calc.web.server:app --reload --host 0.0.0.0 --port 8000
```

打开 http://localhost:8000 访问小看板：
- 首页：数据概览
- /calculations/{id}：3D 或图表展示，发现未说明原因的改系数会显示警告横幅并可跳回证据源
- /calculations/{id}/replay：参数回放页，说明每条参数为何留下、缺什么材料、下一步找谁

### 4. API 接口

```bash
# 健康检查
curl http://localhost:8000/api/health

# 提交计算
curl -X POST http://localhost:8000/api/calculate \
  -H "Content-Type: application/json" \
  -d @samples/calc_input_001.json
```

## 核心概念

| 概念 | 说明 |
|------|------|
| 参数溯源 (Provenance) | 每条参数都记录来源：设备铭牌参数 / 维修群截图 / 人工改系数 |
| 改系数据标记 (OverrideFlag) | 人工修改过且未说明原因的参数，会被标记为需复核 |
| 参数回放页 (Replay) | 说明：这条为什么被留下、还缺什么材料、下一步该找设备工程师还是训练教练老唐 |

## 目录结构

```
water_hammer_calc/
├── models.py        # 数据模型
├── engine.py        # 水锤计算引擎
├── store.py         # 数据存储
├── cli.py           # 命令行入口
├── api/             # FastAPI 服务
└── web/             # Web 看板模板
```
