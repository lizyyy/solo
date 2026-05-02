# 异常包裹证据包归档员 (xy4127)

给快递驿站站长用的本地自动化工具，用于扫描、校验、复核和导出异常包裹申诉材料。

## 功能特性

- **scan**: 扫描指定目录，自动按运单号归集照片、CSV备注和赔付申请表
- **check**: 校验规则：缺照片、备注冲突、重复运单、时间倒序、赔付金额异常
- **review**: 保存人工处理意见（状态：pending/approved/rejected/need_more_info/resolved）
- **export**: 导出 Markdown 申诉包、CSV 问题清单、JSON 审计记录

## 安装

```bash
cd xy4127
pip install -e .
```

## 快速开始

### 1. 创建临时测试目录

```bash
mkdir -p /tmp/parcel_test/photos
mkdir -p /tmp/parcel_test/csv
```

### 2. 准备示例数据

复制示例数据到测试目录：

```bash
# 复制示例CSV
cp examples/customer_remarks.csv /tmp/parcel_test/csv/
cp examples/claim_forms.csv /tmp/parcel_test/csv/

# 创建示例照片（如果没有真实照片，可以用文本文件模拟）
echo "photo1" > /tmp/parcel_test/photos/SF1234567890123_破损_20240115.jpg
echo "photo2" > /tmp/parcel_test/photos/SF1234567890123_面单_20240115.jpg
echo "photo3" > /tmp/parcel_test/photos/YT9876543210987_丢失.jpg
```

### 3. 运行示例流程

```bash
# 1. 扫描目录建立索引
parcel scan /tmp/parcel_test -o /tmp/parcel_test/index.json

# 2. 校验规则
parcel check /tmp/parcel_test/index.json

# 3. 添加复核意见
parcel review SF1234567890123 approved -c "材料齐全，同意赔付" -i /tmp/parcel_test/index.json
parcel review YT9876543210987 need_more_info -c "缺少面单照片，请补充" -i /tmp/parcel_test/index.json

# 4. 导出报告
parcel export /tmp/parcel_test/index.json -o /tmp/parcel_test/output/
```

## 命令详解

### scan 命令

扫描目录并按运单号归集文件：

```bash
parcel scan <目录路径> -o <输出索引文件>
```

- 自动识别照片（jpg/jpeg/png/gif/bmp/webp）
- 解析CSV中的客服备注和赔付申请表
- 从文件名提取运单号（支持 SF/YT/JD/ZT/EMS 等常见格式）

### check 命令

校验异常包裹规则：

```bash
parcel check <索引文件路径>
```

校验规则包括：

| 规则类型 | 严重程度 | 说明 |
|---------|---------|------|
| missing_photo | critical | 照片数量不足（默认需要至少2张） |
| missing_timestamp | high | 照片缺少时间戳 |
| duplicate_tracking | critical | 重复运单号 |
| conflict_remark | high/medium | 备注冲突（金额/问题类型不一致） |
| timestamp_out_of_order | medium | 时间戳倒序 |
| amount_mismatch | high | 备注与赔付表金额不一致 |
| amount_anomaly | critical/high | 金额异常（超过阈值/为0） |

### review 命令

保存人工处理意见：

```bash
parcel review <运单号> <状态> -c <备注> -i <索引文件>
```

可用状态：
- `pending` - 待处理
- `approved` - 已通过
- `rejected` - 已驳回
- `need_more_info` - 需补充材料
- `resolved` - 已解决

### export 命令

导出报告：

```bash
parcel export <索引文件> -f <格式> -o <输出目录>
```

格式选项：
- `md` - Markdown申诉包
- `csv` - CSV问题清单
- `json` - JSON审计记录
- `all` - 全部导出（默认）

## 项目结构

```
xy4127/
├── xy4127/
│   ├── __init__.py
│   ├── main.py              # CLI入口
│   ├── models.py            # 数据模型
│   ├── file_indexer.py      # 文件索引器
│   ├── metadata_parser.py   # 元数据解析器
│   ├── rule_engine.py       # 规则引擎
│   ├── review_store.py      # 复核状态存储
│   └── exporter.py          # 报告导出器
├── examples/
│   ├── customer_remarks.csv  # 客服备注示例
│   └── claim_forms.csv       # 赔付申请表示例
├── tests/
│   └── test_basic.py        # 测试文件
├── setup.py
└── README.md
```

## CSV文件格式

### 客服备注CSV (customer_remarks.csv)

| 列名 | 说明 |
|-----|------|
| 运单号 | 快递单号（支持SF/YT/JD等格式） |
| 客户姓名 | 收件人姓名 |
| 联系电话 | 联系电话 |
| 问题类型 | 破损/丢失/延误/错发等 |
| 问题描述 | 详细问题描述 |
| 赔付金额 | 申请赔付金额（元） |
| 日期 | 录入日期 |
| 操作员 | 录入人 |

### 赔付申请表CSV (claim_forms.csv)

| 列名 | 说明 |
|-----|------|
| 运单号 | 快递单号 |
| 申请金额 | 申请赔付金额 |
| 申请日期 | 申请日期 |
| 申请人 | 申请人姓名 |
| 状态 | 审核状态 |

## 依赖

- click >= 8.0 (CLI框架)
- python-dateutil >= 2.8 (日期解析)
- Pillow >= 9.0 (图片EXIF解析)
- rich >= 12.0 (终端美化输出)

## 运行测试

```bash
cd xy4127
python -m pytest tests/ -v
```

## 临时目录验证流程

```bash
# 1. 创建测试目录结构
mkdir -p /tmp/parcel_demo/{photos,csv,output}

# 2. 复制示例CSV
cp examples/*.csv /tmp/parcel_demo/csv/

# 3. 创建模拟照片文件
cd /tmp/parcel_demo/photos

# 包裹1: SF1234567890123 - 有2张照片（正常）
echo "破损照片1" > SF1234567890123_damage_20240115_143000.jpg
echo "面单照片1" > SF1234567890123_label_20240115_143005.jpg

# 包裹2: YT9876543210987 - 只有1张照片（会触发missing_photo警告）
echo "丢失照片" > YT9876543210987_missing.jpg

# 4. 返回项目目录执行命令
cd -

# 5. 安装并运行
pip install -e .
parcel scan /tmp/parcel_demo -o /tmp/parcel_demo/index.json
parcel check /tmp/parcel_demo/index.json
parcel review SF1234567890123 approved -c "材料完整，同意赔付" -i /tmp/parcel_demo/index.json
parcel review YT9876543210987 need_more_info -c "请补充面单照片" -i /tmp/parcel_demo/index.json
parcel export /tmp/parcel_demo/index.json -o /tmp/parcel_demo/output/

# 6. 查看导出结果
ls -la /tmp/parcel_demo/output/
```
