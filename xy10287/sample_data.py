import pandas as pd
from datetime import datetime, timedelta

sample_records = [
    {
        'pump_room': 'A区1号泵房',
        'pump_name': '消防主泵-01',
        'inspection_date': datetime.now() - timedelta(days=0),
        'inspector': '张工',
        'noise_description': '运行正常，无异响，声音平稳'
    },
    {
        'pump_room': 'A区1号泵房',
        'pump_name': '消防主泵-02',
        'inspection_date': datetime.now() - timedelta(days=0),
        'inspector': '张工',
        'noise_description': '检测到轴承处有轻微磨损声音，伴随周期性震动'
    },
    {
        'pump_room': 'B区2号泵房',
        'pump_name': '生活水泵-01',
        'inspection_date': datetime.now() - timedelta(days=1),
        'inspector': '李工',
        'noise_description': '叶轮处有明显失衡现象，运行时抖动较大'
    },
    {
        'pump_room': 'B区2号泵房',
        'pump_name': '生活水泵-02',
        'inspection_date': datetime.now() - timedelta(days=1),
        'inspector': '李工',
        'noise_description': '有气蚀现象，听见嘶嘶声，疑似气泡产生'
    },
    {
        'pump_room': 'C区3号泵房',
        'pump_name': '补水泵-01',
        'inspection_date': datetime.now() - timedelta(days=2),
        'inspector': '王工',
        'noise_description': '密封处有泄漏迹象，听见滴水声'
    },
    {
        'pump_room': 'C区3号泵房',
        'pump_name': '补水泵-02',
        'inspection_date': datetime.now() - timedelta(days=2),
        'inspector': '王工',
        'noise_description': '管道存在共振现象，有共鸣敲击声'
    },
    {
        'pump_room': 'D区4号泵房',
        'pump_name': '循环泵-01',
        'inspection_date': datetime.now() - timedelta(days=3),
        'inspector': '赵工',
        'noise_description': '轴承疲劳剥落严重，异响明显，需要立即处理'
    },
    {
        'pump_room': 'D区4号泵房',
        'pump_name': '循环泵-02',
        'inspection_date': datetime.now() - timedelta(days=3),
        'inspector': '赵工',
        'noise_description': '运行状态良好，无异响'
    }
]

df = pd.DataFrame(sample_records)
df.to_excel('sample_inspection.xlsx', index=False)
print('样例数据文件已生成: sample_inspection.xlsx')
print(f'共 {len(df)} 条巡检记录')
