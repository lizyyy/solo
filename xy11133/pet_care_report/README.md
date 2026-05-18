# 宠物寄养店寄养护理日报 CLI

模块化的数据处理工具，用于宠物寄养店的寄养护理日报数据清洗和校验。

## 项目结构

```
pet_care_report/
├── src/
│   ├── __init__.py       # 模块导出
│   ├── parser.py         # 解析模块 - 解析CSV/JSON数据
│   ├── validator.py      # 校验模块 - 校验数据合法性
│   └── report_generator.py # 报告生成模块
├── samples/
│   ├── normal/           # 正常数据样例
│   ├── dirty/            # 脏数据样例（含损坏文件）
│   └── rerun/            # 重跑对照样例
├── output/               # 输出目录
└── main.py               # CLI主程序
```

## 功能特性

### 1. 模块化设计
- **解析模块**：支持CSV/JSON格式，处理编码错误、格式错误
- **校验模块**：多宠同笼检测、照片时间戳校验、必填字段检查
- **报告生成**：正常/异常记录分离、汇总报告、错误详情

### 2. 业务校验规则
- **多宠同笼检测**：单笼超过2只宠物标记为异常
- **照片缺时间戳**：照片文件缺少时间标记
- **必填字段校验**：记录ID、日期、笼号不能为空
- **日期格式校验**：支持多种格式但推荐YYYY-MM-DD

### 3. 可复跑输出
- 通过 `--run-id` 参数指定运行标识
- 相同输入产生相同输出文件名，便于对比
- 支持重跑对比验证修复效果

### 4. 错误路径可见
- 文件损坏时记录未处理文件列表
- 解析错误详情记录在汇总报告中
- JSON格式的完整错误详情

## 使用方法

### 处理正常数据
```bash
cd pet_care_report
python main.py --input samples/normal --output output
```

### 处理脏数据（演示错误路径）
```bash
python main.py --input samples/dirty --output output
```

### 可复跑测试
```bash
# 第一次运行
python main.py --input samples/rerun --output output --run-id rerun_v1

# 第二次运行（相同输入，相同输出）
python main.py --input samples/rerun --output output --run-id rerun_v2
```

## 输出文件说明

| 文件名 | 说明 |
|--------|------|
| 正常记录_{run_id}.csv | 校验通过的记录 |
| 异常记录_{run_id}.csv | 存在问题的记录及异常描述 |
| 处理汇总_{run_id}.txt | 整体统计和文件处理情况 |
| 错误详情_{run_id}.json | 结构化错误数据 |

## 业务样例说明

### samples/normal/
- 正常寄养记录，数据格式规范
- 每笼1只宠物，照片都带时间戳

### samples/dirty/
- **多宠同笼**：B01笼3只狗、B02笼4只猫
- **照片缺时间**：部分照片只有文件名没有时间
- **字段缺失**：缺少日期、笼号等必填字段
- **日期格式错误**：使用非标准日期格式
- **损坏文件**：编码错误的CSV用于测试错误处理

### samples/rerun/
- 固定数据集用于验证可复跑特性
- 包含正常和异常混合数据
- 两次运行应产生相同的校验结果
