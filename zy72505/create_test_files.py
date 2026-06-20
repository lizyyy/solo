import pandas as pd
import numpy as np

data = {
    '问题ID': ['Q-TEST-001', 'Q-TEST-002', 'Q-TEST-003'],
    '问题': ['正常样本缺版本：喝水健康吗？', '404链接+通过：药品说明书', '结论冲突：运动有益？'],
    '原结论': ['通过', '通过', '通过'],
    '人工结论': ['通过', '通过', '不通过'],
    '人工备注': ['原结论没问题，但缺提示词版本', '虽然链接404，但内容已经审核过', '原结论太绝对，需修改'],
    '提示词版本': ['', np.nan, 'v2.0.0'],
    '链接状态': ['200', '404', '200'],
}

df = pd.DataFrame(data)
df.to_excel('test_manual_review.xlsx', index=False)
df.to_csv('test_manual_review.csv', index=False, encoding='utf-8-sig')
print('OK')
