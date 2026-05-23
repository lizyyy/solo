# 游学报名表清洗报告

**生成时间**: 2026-05-24 01:23:43

**源文件**: sample_registration.csv

## 一、处理摘要

- 总行数: 8
- 成功清洗: 4
- 异常行数: 4
- 重复报名: 1 组

## 二、字段映射情况

| 原始列名 | 标准字段 |
|----------|----------|
| 学生姓名 | student_name |
| 护照号 | passport |
| 监护人电话 | guardian_phone |
| 饮食禁忌 | dietary_restriction |
| 年级 | grade |
| 学校 | school |
| 负责老师 | teacher |
## 三、重复报名记录

- 护照号 `E12345678` 在第 2, 6 行重复出现 (2 次)
  - 学生姓名: 钱七、张三

## 四、异常行详情

- 第 4 行: 护照号: 格式可疑
- 第 5 行: 护照号: 空值; 监护人电话: 格式可疑; 护照号为空
- 第 7 行: 护照号: 格式可疑; 监护人电话: 格式可疑
- 第 8 行: 监护人电话: 格式异常
## 五、输出文件

- cleaned: `output/sample_registration_cleaned_20260524_012343.xlsx`
- errors: `output/sample_registration_errors_20260524_012343.xlsx`
