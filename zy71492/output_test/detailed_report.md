# 黑胶清洗养护记录 - 详细报告
生成时间: 2026-05-30T14:16:41.948700

## 1. 导入汇总
- 来源文件: 6 个
- 顾客记录: 2 条
- 唱片记录: 4 条
- 清洗记录: 2 条
- 划痕记录: 3 条
- 试听记录: 2 条

## 2. 来源文件明细
| 来源ID | 文件名称 | 数据类型 | 导入时间 |
|--------|----------|----------|----------|
| src_df64f367 | vinyl_records_batch2.json | vinyl_record | 2026-05-30 14:16 |
| src_4d8295c1 | vinyl_records_batch1.json | vinyl_record | 2026-05-30 14:16 |
| src_886e4a0e | customers_202401.json | customer | 2026-05-30 14:16 |
| src_9d196098 | cleaning_records_01.json | cleaning_record | 2026-05-30 14:16 |
| src_df956527 | scratch_inspection_01.json | scratch | 2026-05-30 14:16 |
| src_a037087c | listening_tests_01.json | listening_test | 2026-05-30 14:16 |

## 3. 唱片清洗状态分布
- **pending**: 1 张
- **in_progress**: 1 张
- **cleaned**: 1 张
- **needs_reclean**: 0 张
- **completed**: 1 张
- **cancelled**: 0 张

## 4. 唱片清洗记录明细

### 唱片: DG-419-862-2 (`rec_001`)
- **艺术家**: Ludwig van Beethoven
- **专辑**: Symphony No.9 'Choral'
- **当前状态**: in_progress
- **清洗次数**: 1
- **数据来源**: src_df64f367 (vinyl_records_batch2.json)
- **顾客**: 张三 (`cust_001`)
- **清洗记录**:
  - 第1次清洗: completed (来源: src_9d196098)
    - 清洗机: Okki Nokki, 清洁剂: Tergikleen
    - 开始: 2024-01-15 10:00
    - 完成: 2024-01-15 10:20
- **划痕记录** (1条):
  - [light] 外环 1cm处 - 发丝状划痕，目测不影响播放
    来源: src_df956527, 记录时间: 2024-01-15
- **试听记录** (2条):
  - A面: good (评分: 1.5/10)
    爆裂声: 2, 底噪: 2, 爆音: 1, 失真: 1
    来源: src_a037087c, 试听时间: 2024-01-15
  - B面: excellent (评分: 0.5/10)
    爆裂声: 1, 底噪: 1, 爆音: 0, 失真: 0
    来源: src_a037087c, 试听时间: 2024-01-15

### 唱片: DECCA-SXL-6000 (`rec_004`)
- **艺术家**: Led Zeppelin
- **专辑**: Four Symbols
- **当前状态**: pending
- **清洗次数**: 0
- **数据来源**: src_df64f367 (vinyl_records_batch2.json)
- **顾客**: 张三 (`cust_001`)

### 唱片: DECCA-SXL-6000 (`rec_002`)
- **艺术家**: Led Zeppelin
- **专辑**: IV
- **当前状态**: completed
- **清洗次数**: 2
- **数据来源**: src_4d8295c1 (vinyl_records_batch1.json)
- **顾客**: 李四 (`cust_002`)
- **清洗记录**:
  - 第2次清洗: completed (来源: src_9d196098)
    - 清洗机: Okki Nokki, 清洁剂: Tergikleen
    - 开始: 2024-01-16 14:00
    - 完成: 2024-01-16 14:18
- **划痕记录** (2条):
  - [moderate] 中圈 - 约2cm长的横向划痕
    来源: src_df956527, 记录时间: 2024-01-15
  - [heavy] 中圈 - 明显划痕，约2cm长，可能有爆音
    来源: src_df956527, 记录时间: 2024-01-16

### 唱片: RCA-LSC-2526 (`rec_003`)
- **艺术家**: Pink Floyd
- **专辑**: Dark Side of the Moon
- **当前状态**: cleaned
- **清洗次数**: 1
- **数据来源**: src_4d8295c1 (vinyl_records_batch1.json)

## 5. 冲突检测报告
### 未解决冲突: 6 个

#### duplicate_record_id
- **消息**: 唱片编号 rec_001 出现重复，涉及 2 个来源文件
- **涉及来源**: src_df64f367, src_4d8295c1
- **下一步**: 请确认哪个是正确的原始记录，保留一个，其余标记为重复或合并数据
- **详细信息**:
  - duplicate_id: rec_001
  - source_files: ['vinyl_records_batch2.json', 'vinyl_records_batch1.json']
  - source_ids: ['src_df64f367', 'src_4d8295c1']
  - catalog_number: DG-419-862-2

#### duplicate_catalog_number
- **消息**: 目录号 DECCA-SXL-6000 对应 2 张不同唱片记录
- **涉及来源**: src_df64f367, src_4d8295c1
- **下一步**: 检查是否同一张唱片被多次录入，或确为不同版本需区分目录号
- **详细信息**:
  - catalog_number: DECCA-SXL-6000
  - record_ids: ['rec_004', 'rec_002']
  - source_files: ['vinyl_records_batch2.json', 'vinyl_records_batch1.json']
  - artists: ['Led Zeppelin', 'Led Zeppelin']
  - titles: ['Four Symbols', 'IV']

#### scratch_overlap
- **消息**: 唱片 rec_002 的 B 面 中圈 位置有 2 条重复划痕记录
- **涉及来源**: src_df956527
- **下一步**: 比对各来源的划痕照片和描述，确认是否同一划痕，严重程度以最新或最详细记录为准
- **详细信息**:
  - location_key: rec_002|B|中圈
  - scratch_ids: ['scr_002', 'scr_003']
  - scratch_details: [{'scratch_id': 'scr_002', 'severity': 'moderate', 'description': '约2cm长的横向划痕', 'source_file': 'scratch_inspection_01.json', 'recorded_at': '2024-01-15T09:30:00'}, {'scratch_id': 'scr_003', 'severity': 'heavy', 'description': '明显划痕，约2cm长，可能有爆音', 'source_file': 'scratch_inspection_01.json', 'recorded_at': '2024-01-16T16:00:00'}]
  - source_files: ['scratch_inspection_01.json']
  - severity_diff: True

#### missing_listening_test
- **消息**: 唱片 rec_002 (DECCA-SXL-6000) 状态为 completed，但缺少试听记录
- **涉及来源**: src_4d8295c1
- **下一步**: 补充清洗后试听记录，或确认唱片状态是否正确
- **详细信息**:
  - record_id: rec_002
  - catalog_number: DECCA-SXL-6000
  - artist: Led Zeppelin
  - album_title: IV
  - current_status: completed
  - cleaning_count: 2
  - source_file: vinyl_records_batch1.json
  - missing_data: listening_tests
  - required_for_status: ['cleaned', 'completed']

#### missing_listening_test
- **消息**: 唱片 rec_003 (RCA-LSC-2526) 状态为 cleaned，但缺少试听记录
- **涉及来源**: src_4d8295c1
- **下一步**: 补充清洗后试听记录，或确认唱片状态是否正确
- **详细信息**:
  - record_id: rec_003
  - catalog_number: RCA-LSC-2526
  - artist: Pink Floyd
  - album_title: Dark Side of the Moon
  - current_status: cleaned
  - cleaning_count: 1
  - source_file: vinyl_records_batch1.json
  - missing_data: listening_tests
  - required_for_status: ['cleaned', 'completed']

#### missing_customer
- **消息**: 唱片 rec_003 关联的顾客 cust_999 不存在
- **涉及来源**: src_4d8295c1
- **下一步**: 导入顾客信息文件，或修正customer_id
- **详细信息**:
  - record_id: rec_003
  - catalog_number: RCA-LSC-2526
  - missing_customer_id: cust_999
  - source_file: vinyl_records_batch1.json
