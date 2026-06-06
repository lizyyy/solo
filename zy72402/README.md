# 录音棚工时尾差核对工具

> 轨道备注里有返工原因？以前总被当成小备注跳过？
> 现在不会了 —— 含返工原因的轨道会被自动标记，留给版权运营复核，不会自动归为正常。

## 功能特点

1. **返工原因自动识别**：导入票务导出表时自动扫描轨道备注中的返工关键词（重录、补录、返工、重拍等）
2. **三步工作流**：导入 → 阿梅补看音频备注 → 排练变更记录更新
3. **版权运营复核**：含返工原因的记录不会自动归为正常，需版权运营手动复核
4. **可读报告**：每条记录说明「为什么留下、还缺什么材料、下一步找谁」
5. **HTML看板**：可视化展示，点击备注可回溯原始票务/音频备注（不会只剩漂亮画面）
6. **新人友好**：从样例到报告一键跑完

## 快速开始（新人照着跑就行）

### 0. 环境

Python 3.7+，不需要额外依赖。

### 1. 一键跑演示

```bash
python cli.py demo
```

这会自动走完三步工作流，生成报告和看板。

### 2. 分步走（正式使用）

#### 第一步：导入票务导出表

```bash
python cli.py import --ticket-csv samples/ticket_export.csv
```

自动识别含返工原因的轨道并标记。

#### 第二步：巡演统筹阿梅补看音频文件备注

```bash
python cli.py amei --audio-csv samples/audio_files.csv
```

阿梅看完后，音频备注会关联到排练记录。

#### 第三步：更新排练变更记录

```bash
python cli.py update
```

生成完整的排练变更记录，含：
- 为什么留下这条记录
- 还缺什么材料
- 下一步找谁（版权运营 / 巡演统筹阿梅）

#### 第四步：版权运营复核

查看待复核列表：
```bash
python cli.py review
```

标记某条轨道通过：
```bash
python cli.py review --track-id TRK002 --approve --note "工时合理，同意通过"
```

标记需返工：
```bash
python cli.py review --track-id TRK004 --note "工时差异过大，需补充说明"
```

### 3. 查看结果

查看工作流状态：
```bash
python cli.py status
```

生成文本报告：
```bash
python cli.py report --format text
```

生成HTML看板（浏览器打开）：
```bash
python cli.py report --format html
```

看板里点击「票务备注」或「音频备注」可查看原始内容，不会只剩漂亮画面。

## 数据格式

### 票务导出表 CSV

| 字段 | 说明 |
|------|------|
| track_id | 轨道编号 |
| track_name | 曲目名称 |
| planned_hours | 计划工时 |
| actual_hours | 实际工时 |
| track_remark | 轨道备注（会扫描返工关键词） |

### 音频文件 CSV

| 字段 | 说明 |
|------|------|
| track_id | 轨道编号（与票务表对应） |
| file_name | 文件名 |
| audio_remark | 音频备注 |

## 返工关键词列表

以下关键词会被自动识别：
> 返工、重录、补录、重拍、重制、修改、重来、补拍、后期返工、重新录制、重新配音、修正、调整重录、瑕疵重录、噪音重录、走音重录

在 `core.py` 的 `REWORK_KEYWORDS` 中可扩展。

## 项目结构

```
.
├── models.py        # 数据模型定义
├── core.py          # 核心工作流引擎
├── report.py        # 报告和看板生成
├── cli.py           # 命令行入口
├── samples/         # 样例数据
│   ├── ticket_export.csv
│   └── audio_files.csv
├── data/            # 运行时数据（自动生成）
│   ├── workflow_state.json
│   └── reports/
└── README.md
```

## 核心设计原则

1. **返工原因不跳过**：轨道备注含返工原因的，不会被当成正常记录
2. **可回溯**：从看板的漂亮画面点回去能看到原始备注
3. **报告不说废话**：每条记录讲清楚「为什么留下、缺什么、找谁」
4. **分步可追溯**：每一步状态都持久化，可随时查看进度

---

**提示**：第一次使用建议先跑 `python cli.py demo` 熟悉流程。
