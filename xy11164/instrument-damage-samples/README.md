# 乐器培训班乐器损伤判定 CLI 样例目录

## 目录结构

```
instrument-damage-samples/
├── normal/          # 正常文件
│   ├── damage-assessment-2026-05-01.csv    # CSV格式正常数据
│   ├── damage-assessment-2026-05-02.json   # JSON格式正常数据
│   └── damage-assessment-2026-05-03.md     # Markdown格式正常数据
├── bad/             # 有问题的测试文件
│   ├── missing-columns.csv    # 缺少字段的文件
│   ├── duplicate-rows.csv     # 有重复行的文件
│   ├── invalid-format.json    # 格式错误的JSON文件
│   └── partial-failure.csv    # 部分行错误的文件（测试失败后继续处理）
├── empty/           # 空文件
│   ├── empty.csv
│   ├── empty.json
│   └── empty.md
└── README.md
```

## 字段说明

所有文件使用统一的字段结构：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| instrument_id | 乐器ID | INS-001 |
| instrument_type | 乐器类型 | 小提琴、钢琴、吉他 |
| check_date | 检查日期 | 2026-05-01 |
| damage_type | 损伤类型 | 自然磨损、人为磕碰、无损伤 |
| damage_location | 损伤位置 | 琴头、琴键、面板 |
| damage_level | 损伤程度 | 轻微、中等、严重、无 |
| checker | 检查人员 | 张老师、李老师 |
| photo_path | 证据照片路径 | /photos/INS-001-001.jpg |
| notes | 备注 | 正常使用痕迹、学生练习时不慎掉落 |

## 测试场景说明

### 正常文件 (normal/)
包含完整字段、格式正确的乐器损伤判定记录，用于验证正常处理流程。

### 缺列测试 (bad/missing-columns.csv)
缺少 photo_path 和 notes 字段，用于测试 CLI 对缺失字段的处理能力。

### 重复行测试 (bad/duplicate-rows.csv)
包含重复的乐器损伤记录，用于测试 CLI 的去重功能或重复数据处理逻辑。

### 格式错误测试 (bad/invalid-format.json)
JSON格式有语法错误，用于测试 CLI 对格式错误文件的错误处理。

### 部分失败测试 (bad/partial-failure.csv)
部分数据行格式错误，用于测试 CLI 在遇到部分错误时是否能继续处理有效数据。

### 空文件测试 (empty/)
完全空的文件，用于测试 CLI 对空输入的处理能力。

## 业务背景

本样例针对乐器培训班的乐器损伤判定场景，核心关注：
1. **状态留存**：记录每台乐器的损伤状态
2. **证据留存**：通过 photo_path 字段关联损伤照片证据
3. **损伤分类**：区分自然磨损、人为磕碰等不同损伤类型
4. **损伤程度**：量化损伤严重程度（轻微/中等/严重）
