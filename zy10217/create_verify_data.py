import pandas as pd
from datetime import date

print('创建用于验证Bug修复的测试数据...')

farmers_data = {
    '姓名': ['测试农户A'],
    '电话': ['13800000001'],
    '村': ['测试村'],
    '身份证号': ['110101199001019999']
}
pd.DataFrame(farmers_data).to_excel('verify_farmers.xlsx', index=False)

plots_data = {
    '农户姓名': ['测试农户A'],
    '地块名称': ['测试地块'],
    '地块编号': ['TEST001'],
    '面积': [1.0],
    '面积单位': ['亩'],
    '位置': ['测试位置']
}
pd.DataFrame(plots_data).to_excel('verify_plots.xlsx', index=False)

work_types_data = {
    '作业类型': ['收割'],
    '单价': [100.0],
    '单位': ['亩'],
    '说明': ['用于测试的收割作业']
}
pd.DataFrame(work_types_data).to_excel('verify_work_types.xlsx', index=False)

records_data = {
    '农户姓名': ['测试农户A'],
    '地块名称': ['测试地块'],
    '作业类型': ['收割'],
    '作业日期': ['2024-10-01'],
    '面积': [1.0],
    '面积单位': ['亩'],
    '机手': ['测试机手'],
    '机械': ['测试机械'],
    '已确认': [True]
}
pd.DataFrame(records_data).to_excel('verify_records.xlsx', index=False)

oil_subsidy_data = {
    '规则名称': ['油补超额测试'],
    '作业类型': ['收割'],
    '补贴类型': ['固定'],
    '补贴值': [150.0],
    '最高补贴': [None],
    '生效日期': ['2024-01-01'],
    '截止日期': ['2024-12-31'],
    '是否启用': [True]
}
pd.DataFrame(oil_subsidy_data).to_excel('verify_oil_subsidy.xlsx', index=False)

print('测试数据已创建:')
print('  - verify_farmers.xlsx (1个农户)')
print('  - verify_plots.xlsx (1个地块)')
print('  - verify_work_types.xlsx (收割，单价100元/亩)')
print('  - verify_records.xlsx (1亩收割作业)')
print('  - verify_oil_subsidy.xlsx (固定油补150元)')
print()
print('测试场景：作业费100元，油补150元（超额50元）')
print('预期：check subsidy 能检测到该异常')
