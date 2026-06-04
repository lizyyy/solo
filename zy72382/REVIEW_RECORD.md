# 小车碰撞动量回放 - 复盘记录

---

## 📋 场景背景

设备工程师晚上催结果时，维修师傅老岑只能翻传感器编号，但「SN-2024-002」那条人工改过系数但没写原因，让结论不敢直接发。

---

## 🔍 三步工作流程

### 第一步：传感器编号第一次导入

```bash
python -m collision_playback load-demo --clear-first
```

**导入的三条记录：**

| 传感器编号 | 类型 | 状态 |
|-----------|------|------|
| SN-2024-001 | 顺利记录 | ✓ 正常 |
| SN-2024-002 | 人工改过没写原因 | ⚠ 待复核 |
| SN-2024-003 | 照片补来旧口径 | ✓ 正常 |

查看列表：
```bash
python -m collision_playback list
```

---

### 第二步：维修师傅老岑补看工况照片

老岑翻出历史照片，发现 SN-2024-003 轨道当时有积水，照片上旧口径标记摩擦系数 0.08。

```bash
# 补录照片并提取旧口径（已在演示数据中模拟）
python -m collision_playback show 3
```

**照片信息：**
- 文件名：`SN-2024-003_scene.txt`
- 场景：3号试验轨道 - 小雨后
- 备注：轨道表面有积水，旧口径摩擦系数标记为 0.08
- 提取的摩擦系数：0.08

---

### 第三步：参数回放页更新

补录照片后，系统自动用旧口径 0.08 重新计算，参数回放页自动更新。

查看回放历史对比：
```bash
python -m collision_playback show 3
```

SN-2024-003 三次回放结果：
| 次数 | 数据来源 | 摩擦系数 | 动量结果 | 能量损失 |
|------|---------|---------|---------|---------|
| 第1次 | 原始数据 | 0.02 | 20.0724 | 1.4876 |
| 第2次 | 人工修正 | 0.06 | 19.2531 | 2.3069 |
| 第3次 | 照片补充 | 0.08 | 18.8434 | 2.7166 |

---

## ⚠ 关键细节：人工改了没写原因

**SN-2024-002 的问题：**
- 老岑改了摩擦系数：0.03 → 0.05
- 但当时急着去吃饭，没写原因
- 系统自动标记为「待复核」，不归为正常

查看待复核记录：
```bash
python -m collision_playback pending
```

输出：
```
⚠ 共有 1 条待复核记录:
  [2] SN-2024-002 - 2026-06-04 16:27
    ⚠ 老岑 修改 friction_coeff: 0.03 → 0.05 (未填原因)
```

**留给设备工程师复核：**
```bash
python -m collision_playback review 2
```

复核后状态变为「已复核」，才能发结论。

---

## 📊 三种处理结果对比

```bash
python -m collision_playback summary
```

| 记录 | 处理方式 | 动量结果 | 状态 |
|------|---------|---------|------|
| SN-2024-001 | 顺利记录（无修正） | 26.5070 kg·m/s | ✓ 正常 |
| SN-2024-002 | 人工改了没写原因 | 35.1120 kg·m/s | ⚠ 待复核 → ✓ 已复核 |
| SN-2024-003 | 照片补来旧口径 | 18.8434 kg·m/s | ✓ 正常 |

**数值不同 ✓**：26.5070 ≠ 35.1120 ≠ 18.8434

---

## 🔄 可重跑命令全集

### 基础查询
```bash
# 查看所有记录
python -m collision_playback list

# 查看单条记录详情（含回放历史）
python -m collision_playback show 1
python -m collision_playback show 2
python -m collision_playback show 3

# 通过传感器编号查询（老岑晚上催结果时翻编号用）
python -m collision_playback show-by-sensor SN-2024-001
python -m collision_playback show-by-sensor SN-2024-002
python -m collision_playback show-by-sensor SN-2024-003
```

### 工作流操作
```bash
# 导入一条新记录
python -m collision_playback import-record SN-TEST-001 now 10.0 3.0 0.02 0.90 --notes "测试记录"

# 人工修正（不填原因自动标记待复核）
python -m collision_playback correct 1 friction_coeff 0.03
python -m collision_playback correct 1 friction_coeff 0.03 --reason "轨道磨损"

# 上传工况照片（可提取旧口径）
python -m collision_playback upload-photo 1 ./photo.jpg --note "现场照片"
python -m collision_playback upload-photo 1 ./photo.jpg --extracted-friction 0.08

# 重新参数回放
python -m collision_playback playback 1

# 设备工程师复核
python -m collision_playback review 2
```

### 管理命令
```bash
# 初始化数据库
python -m collision_playback initdb

# 加载演示数据
python -m collision_playback load-demo --clear-first

# 列出待复核记录
python -m collision_playback pending

# 只看待复核记录
python -m collision_playback list --pending

# 复盘摘要
python -m collision_playback summary
```

---

## 🌐 小看板启动

```bash
# 启动 API 服务器（含 Web 界面）
uvicorn collision_playback.api:app --reload --host 0.0.0.0 --port 8000
```

访问：
- 小看板：http://localhost:8000
- API 文档：http://localhost:8000/docs
- 查看所有记录 API：http://localhost:8000/api/details

---

## 🧪 端到端验证

```bash
# 运行完整工作流验证脚本
python3 verify_workflow.py
```

验证内容：
1. ✓ 传感器导入 → 自动计算初始动量
2. ✓ 人工修正不填原因 → 标记 pending_review
3. ✓ 补录工况照片 → 参数回放页自动更新
4. ✓ 三次回放结果 → 数值不同
5. ✓ 待复核记录 → 留给设备工程师
6. ✓ 工程师复核 → 状态改为 reviewed

---

## 💡 老岑给新人讲流程

1. **先导入**：把传感器编号导进去，系统自动算一遍
2. **看照片**：工况照片里有旧口径就补上，系统自动重算
3. **别漏原因**：改系数一定要写原因，不然设备工程师晚上要催
4. **等复核**：没写原因的别急着发，等工程师看完再说

> 关键口诀：**导入 → 补照 → 回放 → 复核**
>
> 碰到人工改过系数但没写原因时，别急着归正常，留给设备工程师 ⚠

---

## 📁 项目结构

```
collision_playback/
├── __init__.py
├── __main__.py          # CLI 入口
├── config.py            # 配置
├── models.py            # 数据模型
├── database.py          # 数据存储
├── core.py              # 核心业务逻辑
├── cli.py               # 命令行接口
├── api.py               # REST API
├── demo_data.py         # 演示数据
└── web/static/
    ├── index.html       # 小看板
    ├── style.css
    └── app.js

data/
├── collision.db         # SQLite 数据库
└── photos/              # 工况照片目录

verify_workflow.py       # 端到端验证脚本
REVIEW_RECORD.md         # 本文档
```
