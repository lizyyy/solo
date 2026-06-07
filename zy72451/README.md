# 公交夜班覆盖缺口 - 无障碍坡道复核系统

## 功能特性

- **保留原始备注**: 不把材料洗成一行干净数据，保留施工告示和坡道记录的原始备注
- **智能整改建议**: 说明为什么被留下、缺什么材料、下一步该找谁（交通协管/社区书记周姐）
- **评分变化检测**: 补录坡道后标出评分没变化的情况，留给交通协管复核
- **完整审计日志**: 谁改了什么、为什么改、改完影响哪些结果，都清楚记录
- **三种入口**: 命令行、API、小看板界面
- **演示数据**: 内置完整演示流程，方便新人培训

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行完整演示

```bash
python main.py demo --full
```

### 逐步演示

```bash
# 加载演示数据（步骤1：施工告示导入）
python main.py demo

# 步骤2：社区书记周姐补看无障碍坡道记录
python main.py demo-step2

# 步骤3：交通协管人工修正
python main.py demo-step3

# 步骤4：重跑生成最终报告
python main.py demo-step4
```

## 常用命令

### 查看状态
```bash
python main.py status
```

### 查看审计日志
```bash
python main.py audit
```

### 导入施工告示
```bash
python main.py import-notice --road "幸福路" --type "人行道改造" --start "2026-05-01" --end "2026-06-30" --raw-notes "周姐备注：夜班公交站要注意..."
```

### 补录坡道记录
```bash
python main.py supplement <notice_id> --location "公交站台东侧" --has-ramp --condition good --width 90 --raw-notes "现场备注：坡道有点陡..."
```

### 重跑评分和建议
```bash
python main.py rerun <notice_id>
```

### 生成完整报告
```bash
python main.py report -o report.json
```

### 启动小看板
```bash
python main.py dashboard
```

## 核心流程

1. **施工告示第一次导入**: 录入路段、工期、原始备注
2. **社区书记周姐补看**: 现场核查无障碍坡道，补录记录和备注
3. **评分变化检测**: 补录后如果评分没变化，自动标记为待交通协管复核
4. **交通协管复核**: 确认评分未变化的原因，补充完整信息
5. **整改建议更新**: 每一步都会生成新的整改建议版本
