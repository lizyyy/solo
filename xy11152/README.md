# 便利店加盟督导巡店照片查重 CLI

一个专门用于便利店加盟督导巡店照片质量检查和查重的命令行工具。

## 功能特性

### 1. EXIF信息检查
- 检查照片是否缺少EXIF数据
- 检查必填EXIF字段（拍摄时间、GPS信息、设备型号等）
- 支持自定义配置需要检查的字段

### 2. 重复照片检测
- 基于图像感知哈希算法
- 检测完全重复的照片
- 检测高度相似的照片
- 可配置相似度阈值
- 时间窗口过滤（只检测相近时间的照片）

### 3. 门店迁址检测
- 通过GPS坐标验证照片拍摄位置
- 检测门店实际位置与预期位置的偏差
- 可配置GPS容差距离
- 支持从文件名自动识别门店ID

### 4. 稳定的结果输出
- 每次运行结果稳定可复现
- 完整记录处理失败的文件及原因
- JSON格式输出，便于后续处理
- 友好的控制台报告

## 项目结构

```
.
├── photo_check_cli.py      # 主程序入口
├── exif_checker.py         # EXIF检查模块
├── duplicate_detector.py   # 重复检测模块
├── store_validator.py      # 门店验证模块
├── config.yaml             # 配置文件
├── requirements.txt        # 依赖清单
├── generate_samples.py     # 测试样例生成脚本
└── README.md               # 说明文档
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 生成测试样例

```bash
python generate_samples.py
```

这会在 `test_photos` 目录下生成8个测试照片文件，包含各种业务场景：
- 正常照片（含完整EXIF和GPS）
- 重复照片
- 无EXIF数据的照片
- 有EXIF但无GPS的照片
- 位置异常的照片（门店迁址检测）
- 损坏的图片文件

### 2. 运行查重检查

```bash
python photo_check_cli.py test_photos
```

### 3. 指定输出文件

```bash
python photo_check_cli.py test_photos -o result.json
```

### 4. 只输出文件，不打印报告

```bash
python photo_check_cli.py test_photos --no-print -o result.json
```

### 5. 使用自定义配置

```bash
python photo_check_cli.py test_photos -c my_config.yaml
```

## 配置说明

编辑 `config.yaml` 可以自定义检查规则：

```yaml
photo_check:
  exif_check:
    enabled: true
    required_fields:
      - DateTimeOriginal
      - GPSInfo
      - Make
      - Model

  duplicate_detection:
    enabled: true
    hash_method: dhash        # dhash, phash, ahash, whash
    similarity_threshold: 5   # 哈希距离阈值
    time_window_hours: 24     # 只检查24小时内的照片
    same_store_check: true    # 只比对同一门店的照片

  store_relocation:
    enabled: true
    gps_tolerance_meters: 500  # GPS容差距离（米）

  stores:
    - store_id: BJ-001
      name: 便利店北京朝阳路店
      expected_gps:
        lat: 39.92
        lng: 116.46
```

## 门店ID识别规则

工具会自动从文件名中识别门店ID，支持以下格式：
- `BJ-001_xxx.jpg` → BJ-001
- `store-BJ001_xxx.jpg` → BJ001
- `门店-上海002_xxx.jpg` → 上海002

## 输出结果说明

运行后会生成JSON格式的结果文件，包含：

- `scan_time`: 扫描时间
- `total_files`: 总文件数
- `processed_files`: 成功处理文件数
- `failed_files`: 处理失败文件数
- `photo_records`: 单张照片的详细记录
- `exif_issues`: EXIF问题列表
- `duplicate_issues`: 完全重复照片列表
- `similar_photo_issues`: 高度相似照片列表
- `relocation_issues`: 门店迁址异常列表
- `summary`: 汇总统计

## 命令行参数

```
positional arguments:
  directory             包含巡店照片的目录路径

optional arguments:
  -h, --help            show this help message and exit
  -c CONFIG, --config CONFIG
                        配置文件路径 (默认: config.yaml)
  -o OUTPUT, --output OUTPUT
                        输出JSON结果文件路径
  --no-print            不打印报告到控制台
```

## 常见问题

### Q: 如何添加新的门店配置？
A: 在 `config.yaml` 的 `stores` 数组中添加新门店的 `store_id`、`name` 和 `expected_gps` 坐标。

### Q: 如何调整照片相似度的敏感度？
A: 修改 `similarity_threshold` 参数，数值越小越严格，数值越大越宽松。

### Q: 照片损坏会影响其他照片的处理吗？
A: 不会。工具会捕获每张照片的处理异常，损坏的文件会被记录在结果中，不会影响其他照片的处理。

### Q: 多次运行结果会一致吗？
A: 是的。工具对文件进行排序处理，确保相同输入产生相同输出，结果可稳定复现。
