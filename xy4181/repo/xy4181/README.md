# 离线地块包同步修补员

> 农机服务站运维工具 - 春耕前离线地块包同步问题检测与修复

## 项目概述

"离线地块包同步修补员"是一个给农机服务站运维用的本地端侧工具。春耕前需要把地块边界 GeoJSON、离线地图瓦片、作业任务清单和几台终端的同步日志对起来，最怕某台终端少了瓦片、地块版本旧、任务包被重复下发或回滚包缺失。

本工具提供完整的 CLI 命令集，支持：
- **scan** - 索引资料包并计算哈希
- **import-log** - 导入终端日志
- **check** - 校验瓦片覆盖、版本依赖、任务重复、终端状态和回滚可用性
- **plan** - 生成差异修补包
- **apply** - 只在临时目录演练并写 journal
- **report** - 导出 Markdown、CSV 和 JSON 审计包

## 目录结构

```
xy4181/
├── offline_sync_repair/          # 主包目录
│   ├── __init__.py               # 版本信息
│   ├── cli.py                    # CLI入口
│   ├── tile_index.py             # 瓦片索引/地理范围
│   ├── log_parser.py             # 日志解析器
│   ├── rules_engine.py           # 规则引擎
│   ├── patch_plan.py             # 修补计划
│   ├── executor.py               # 演练执行器
│   ├── reporter.py               # 报告生成器
│   └── utils.py                  # 工具函数
├── sample_data/                  # 示例数据
│   ├── parcels/                  # 地块GeoJSON
│   ├── tiles/                    # 瓦片目录
│   ├── tasks/                    # 任务清单
│   ├── logs/                     # 终端日志
│   └── rollback/                 # 回滚包
├── tests/                        # 单元测试
│   ├── __init__.py
│   └── test_core.py
├── setup.py                      # 安装配置
├── requirements.txt              # 依赖列表
└── README.md                     # 本文档
```

## 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -e .

# 或者直接安装依赖
pip install -r requirements.txt
```

### 2. 验证安装

```bash
# 查看版本和帮助
offline-sync-repair --version
offline-sync-repair --help
```

## 使用流程

### 第一步：扫描索引数据

```bash
# 使用示例数据进行扫描
cd sample_data

# 扫描所有数据目录
offline-sync-repair scan

# 或指定各目录路径
offline-sync-repair scan \
    --tiles-dir ./tiles \
    --parcels-dir ./parcels \
    --tasks-dir ./tasks \
    --rollback-dir ./rollback

# 指定缩放级别
offline-sync-repair scan --zoom-levels 14,15,16,17,18
```

**scan 命令会：**
- 扫描瓦片目录 (z/x/y.png 结构)
- 解析地块 GeoJSON 文件
- 读取任务清单 JSON
- 扫描回滚包
- 计算所有文件的 SHA256 哈希
- 保存索引到 `.sync_index/tile_index.json`

### 第二步：导入终端日志

```bash
# 导入单个日志文件
offline-sync-repair import-log ./logs/terminal_T001.log

# 导入整个日志目录
offline-sync-repair import-log ./logs/

# 强制指定终端ID（当日志中无标识时）
offline-sync-repair import-log ./logs/unknown.log --terminal-id T003
```

**import-log 命令会：**
- 解析日志时间戳、终端ID、事件类型
- 识别同步事件（瓦片下载、任务分配、地块同步等）
- 构建终端状态快照
- 保存解析数据到 `.sync_index/parsed_events.json` 和 `terminal_status.json`

### 第三步：执行校验检查

```bash
# 执行所有检查
offline-sync-repair check

# 不加载已有索引，重新执行
offline-sync-repair check --no-load-index --no-load-logs
```

**check 命令会执行以下检查：**

| 检查类别 | 检查内容 |
|---------|---------|
| **瓦片覆盖** | 检查地块所需瓦片是否完整，计算覆盖率 |
| **版本依赖** | 检查地块版本一致性，终端同步版本是否最新 |
| **任务重复** | 检查终端是否收到重复任务 |
| **任务一致性** | 检查任务引用的地块是否存在 |
| **终端状态** | 检查终端在线状态、错误、失败任务、缺失瓦片报告 |
| **回滚可用性** | 检查回滚包是否存在，终端回滚能力 |
| **哈希一致性** | 验证文件哈希索引 |

**严重程度级别：**
- 🔴 **CRITICAL** - 严重问题，必须立即处理
- 🟠 **ERROR** - 错误，需要处理
- 🟡 **WARNING** - 警告，建议处理
- 🟢 **INFO** - 通过项

### 第四步：生成修补计划

```bash
# 生成修补计划
offline-sync-repair plan

# 带描述
offline-sync-repair plan --description "2024春耕前同步修补计划"
```

**plan 命令会：**
- 基于检查结果生成修补操作
- 按终端分类
- 设置优先级 (Critical/High/Medium/Low)
- 预估修补包大小
- 建议执行顺序

**修补操作类型：**
- `add_tile` - 补充缺失瓦片
- `update_parcel` - 更新地块版本
- `remove_duplicate_task` - 移除重复任务
- `add_rollback_package` - 添加回滚包
- `sync_terminal` - 同步终端
- `resolve_error` - 解决错误

### 第五步：演练执行（仅模拟）

```bash
# 演练执行
offline-sync-repair apply

# 执行完成后清理临时目录
offline-sync-repair apply --cleanup

# 带描述
offline-sync-repair apply --description "2024春耕前演练执行"
```

**apply 命令特点：**
- ⚠️ **仅在临时目录演练执行**，**不会修改实际数据**
- 创建沙箱环境（复制源数据到临时目录）
- 按优先级顺序执行所有操作
- 记录完整的执行日志 (journal)
- 保存执行结果到 `.sync_index/dry_runs/`

**执行状态：**
- ✅ **success** - 执行成功
- ❌ **failed** - 执行失败
- ⏭️ **skipped** - 跳过

### 第六步：导出审计报告

```bash
# 导出检查报告
offline-sync-repair report check

# 导出修补计划报告
offline-sync-repair report plan

# 导出执行报告
offline-sync-repair report execution

# 指定输出文件名
offline-sync-repair report check --output-name "2024春耕前检查报告"
```

**report 命令会生成三种格式的报告：**

| 格式 | 文件名 | 用途 |
|------|--------|------|
| **JSON** | `{name}.json` | 完整数据，程序解析 |
| **CSV** | `{name}.csv` | 表格数据，Excel打开 |
| **Markdown** | `{name}.md` | 阅读友好，可转换为PDF/Word |
| **Summary** | `{name}_summary.json` | 报告摘要 |

**报告输出目录：** `{work_dir}/reports/{report_id}/`

### 查看当前状态

```bash
# 显示当前工作状态
offline-sync-repair status
```

**status 命令会显示：**
- 索引加载状态
- 瓦片/地块/任务/回滚包数量
- 日志数据加载状态
- 终端数量

## 完整工作流程示例

```bash
#!/bin/bash

# 1. 设置工作目录
WORK_DIR="./sample_data"
cd $WORK_DIR

# 2. 扫描所有数据
echo "=== 步骤1: 扫描数据 ==="
offline-sync-repair scan

# 3. 导入终端日志
echo "=== 步骤2: 导入日志 ==="
offline-sync-repair import-log ./logs/

# 4. 执行校验检查
echo "=== 步骤3: 执行检查 ==="
offline-sync-repair check

# 5. 生成修补计划
echo "=== 步骤4: 生成计划 ==="
offline-sync-repair plan --description "春耕前修补计划"

# 6. 演练执行
echo "=== 步骤5: 演练执行 ==="
offline-sync-repair apply --description "春耕前演练"

# 7. 导出所有报告
echo "=== 步骤6: 导出报告 ==="
offline-sync-repair report check --output-name "检查报告"
offline-sync-repair report plan --output-name "修补计划"
offline-sync-repair report execution --output-name "执行报告"

echo "=== 完成 ==="
echo "报告已保存到: $WORK_DIR/reports/"
```

## 数据格式规范

### 1. 地块 GeoJSON 格式

```json
{
  "type": "Feature",
  "properties": {
    "parcel_id": "PARCEL_001",
    "name": "东河村一号地块",
    "version": "1.0.0",
    "area_m2": 150000,
    "crop_type": "小麦",
    "required_zoom_levels": [14, 15, 16, 17]
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [116.397, 39.908],
        [116.407, 39.908],
        [116.407, 39.918],
        [116.397, 39.918],
        [116.397, 39.908]
      ]
    ]
  }
}
```

**必填字段：**
- `parcel_id` - 地块唯一标识
- `name` - 地块名称
- `version` - 版本号
- `geometry` - 几何形状

### 2. 任务清单格式

```json
[
  {
    "task_id": "TASK_2024_001",
    "name": "东河村春耕作业-小麦",
    "status": "in_progress",
    "assigned_terminal": "T001",
    "created_at": "2024-03-15T08:00:00",
    "updated_at": "2024-03-15T09:30:00",
    "parcel_ids": ["PARCEL_001"],
    "version": "1.0.0",
    "metadata": {
      "operator": "张三",
      "equipment": "拖拉机_01",
      "target_date": "2024-03-20"
    }
  }
]
```

### 3. 终端日志格式

日志解析器支持以下格式：

```
2024-03-15 08:00:00 [INFO] terminal T001: 终端启动
2024-03-15 08:00:05 [INFO] terminal T001: 同步会话开始
2024-03-15 08:00:10 [INFO] terminal T001: 任务分配: task_id=TASK_2024_001
2024-03-15 08:00:15 [INFO] terminal T001: 地块同步开始: parcel_id=PARCEL_001
2024-03-15 08:00:20 [INFO] terminal T001: 地块同步成功: parcel_id=PARCEL_001, version=1.0.0
2024-03-15 08:00:25 [INFO] terminal T001: 开始下载瓦片: tile=14/13713/6589
2024-03-15 08:00:30 [INFO] terminal T001: 瓦片下载成功: tile=14/13713/6589
2024-03-15 08:00:45 [WARN] terminal T001: 缺失瓦片: tile=15/27428/13179
2024-03-15 08:00:50 [WARN] terminal T001: 缺失瓦片: tile=16/54855/26358
2024-03-15 09:30:00 [INFO] terminal T001: 同步会话结束
```

**支持的时间戳格式：**
- `2024-03-15 08:00:00`
- `2024-03-15T08:00:00`
- `2024/03/15 08:00:00`
- `15/03/2024 08:00:00`

**支持的事件关键字（中英文）：**

| 事件类型 | 中文关键字 | 英文关键字 |
|---------|-----------|-----------|
| 终端启动 | 终端启动 | terminal startup |
| 终端关闭 | 终端关闭 | terminal shutdown |
| 同步开始 | 同步会话开始 | sync session start |
| 同步结束 | 同步会话结束 | sync session end |
| 任务分配 | 任务分配 | task assigned |
| 任务开始 | 任务开始 | task started |
| 任务完成 | 任务完成 | task completed |
| 任务失败 | 任务失败 | task failed |
| 重复任务 | 重复任务 | duplicate task |
| 地块同步 | 地块同步 | parcel sync |
| 版本不匹配 | 版本不匹配 | version mismatch |
| 瓦片下载 | 开始下载瓦片 | tile download start |
| 瓦片下载成功 | 瓦片下载成功 | tile download success |
| 瓦片下载失败 | 瓦片下载失败 | tile download failed |
| 缺失瓦片 | 缺失瓦片,缺少瓦片 | missing tile |
| 回滚开始 | 开始回滚 | rollback initiated |
| 回滚成功 | 回滚成功 | rollback success |
| 回滚失败 | 回滚失败 | rollback failed |
| 回滚包缺失 | 回滚包缺失 | rollback package missing |

### 4. 回滚包格式

回滚包目录结构：
```
rollback/
├── rollback_v1_0_0.zip          # 回滚包文件
└── rollback_v1_0_0.meta.json    # 元数据文件
```

元数据文件格式：
```json
{
  "package_id": "ROLLBACK_2024_001",
  "version": "1.0.0",
  "created_at": "2024-03-10T12:00:00",
  "affected_parcels": ["PARCEL_001", "PARCEL_002"],
  "description": "回滚到春耕前的稳定版本",
  "checksum": "sha256:abc123def456"
}
```

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_core.py::TestUtils -v

# 生成覆盖率报告
pytest tests/ -v --cov=offline_sync_repair
```

## 依赖库

| 库名 | 版本 | 用途 |
|------|------|------|
| click | >=8.0.0 | CLI框架 |
| geojson | >=3.0.0 | GeoJSON处理 |
| mercantile | >=1.2.0 | 瓦片坐标计算 |
| python-dateutil | >=2.8.0 | 日期解析 |
| rich | >=12.0.0 | 终端美化输出 |
| pytest | >=7.0.0 | 单元测试 |

## 注意事项

1. **演练模式安全**：`apply` 命令仅在临时目录执行，不会修改源数据
2. **索引缓存**：扫描和导入的数据会保存到 `.sync_index/` 目录，后续命令可直接加载
3. **日志格式**：确保终端日志包含时间戳和终端标识，以便正确解析
4. **瓦片结构**：瓦片目录需遵循 `z/x/y.png` 标准结构
5. **文件编码**：所有文本文件建议使用 UTF-8 编码

## 故障排查

### 问题1: 瓦片扫描数量为0

**可能原因：**
- 瓦片目录结构不正确
- 瓦片文件格式不支持

**解决方案：**
- 确认目录结构：`tiles/{z}/{x}/{y}.png`
- 支持的格式：.png, .jpg, .jpeg, .webp, .pbf, .mbtiles

### 问题2: 日志解析终端ID不正确

**可能原因：**
- 日志中没有明确的终端标识
- 终端ID模式不匹配

**解决方案：**
- 使用 `--terminal-id` 参数强制指定
- 检查日志格式是否包含 `terminal_XXX` 或 `TXXX` 模式

### 问题3: 检查报告为空

**可能原因：**
- 没有先执行 `scan` 或 `import-log`
- 索引文件损坏

**解决方案：**
- 先执行 `scan` 扫描数据
- 执行 `import-log` 导入日志
- 删除 `.sync_index/` 目录后重新扫描

## 许可证

本项目仅供内部使用。

## 版本历史

- **v1.0.0** - 初始版本
  - 实现所有核心功能模块
  - 提供完整的 CLI 命令
  - 支持三种报告格式导出
  - 包含示例数据和单元测试
