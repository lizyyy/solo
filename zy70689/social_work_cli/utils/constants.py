RISK_LEVELS = {
    'high': {'priority': 1, 'color': 'red', 'days_until_review': 7},
    'medium': {'priority': 2, 'color': 'yellow', 'days_until_review': 14},
    'low': {'priority': 3, 'color': 'green', 'days_until_review': 30}
}

RISK_CRITERIA = {
    'high': [
        '独居且高龄(>=80岁)',
        '有严重慢性病',
        '近期有住院记录',
        '生活不能完全自理',
        '无子女或子女长期不在身边'
    ],
    'medium': [
        '独居(70-79岁)',
        '有慢性病但稳定',
        '子女在本地但探望频率低',
        '经济困难'
    ],
    'low': [
        '有家人共同居住',
        '身体健康',
        '子女经常探望',
        '经济状况良好'
    ]
}

MATERIAL_TYPES = [
    '米面油',
    '生活用品',
    '药品',
    '慰问金',
    '其他'
]

REQUIRED_FIELDS = {
    'resident': ['身份证号', '姓名', '性别', '年龄', '住址', '联系电话'],
    'visit': ['走访日期', '社工姓名', '走访内容', '居民身份证号'],
    'material': ['发放日期', '物资名称', '数量', '领取人', '居民身份证号']
}
