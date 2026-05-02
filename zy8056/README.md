
# 菌落计数复核工具

为微生物实验室同事设计的本地桌面工具，用于批量确认 AI 初筛结果。

## 功能特点

- 按批次切换培养皿图片
- 可视化菌落检测框
- 标记菌落：接受/拒绝、污染、漏检、重叠
- 添加备注信息
- SQLite 数据库持久化复核状态
- 导出 Markdown 报告和 CSV 问题列表
- 处理图片缺失和 colony_id 重复问题

## 安装

```bash
pip install -r requirements.txt
```

## 运行

```bash
python main.py
```

## 快速开始（示例数据）

1. 生成示例图片：
```bash
python generate_sample_images.py
```

2. 运行程序：
```bash
python main.py
```

3. 使用工具：
   - 左侧选择批次
   - 点击图片列表中的图片
   - 点击菌落列表中的菌落
   - 在右侧详情面板设置标记和备注
   - 使用上一张/下一张按钮导航
   - 点击导出按钮生成报告

## 数据格式

### 检测结果 (detections.jsonl)
```json
{"image_id": "plate_001", "colony_id": "colony_001", "bbox": [100, 100, 50, 50], "confidence": 0.95}
```

### 批次信息 (batches.csv)
```csv
batch_id,image_id
batch_a,plate_001
batch_a,plate_002
```

### 判读规则 (rules.yaml)
```yaml
min_confidence: 0.7
min_size: 20
max_size: 200
max_overlap: 0.6
```

### 培养皿图片
放在 `sample_data/images/` 目录下，支持 JPG/PNG/JPEG/BMP 格式。

## 标记说明

- **绿色**：接受的菌落
- **红色**：拒绝的菌落
- **橙色**：标记为污染
- **黄色**：标记为漏检
- **紫色**：标记为重叠

## 项目结构

```
.
├── main.py              # GUI 主程序
├── data_loader.py       # 数据加载模块
├── rule_validator.py    # 规则校验模块
├── database.py          # 数据库模块
├── reporter.py          # 报告生成模块
├── requirements.txt     # 依赖包
├── README.md           # 说明文档
└── sample_data/        # 示例数据目录
    ├── detections.jsonl
    ├── batches.csv
    ├── rules.yaml
    └── images/
```
