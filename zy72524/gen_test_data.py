import pandas as pd

data = pd.DataFrame([
    {
        'original_text': '我想咨询一下退款政策和退货流程',
        'model_prediction': '售后问题',
        'model_confidence': 0.95,
        'manual_label': '售后问题',
        '备注': '常规咨询，已确认无异议',
        '周姐备注': ''
    },
    {
        'original_text': '这个商品质量太差了，刚拿到就坏了，我要投诉你们',
        'model_prediction': '正常反馈',
        'model_confidence': 0.55,
        'manual_label': '投诉',
        '备注': '模型预测错误，置信度低，漏检了',
        '周姐备注': '2024.06.07 周姐复核：确实是投诉，已标记为典型漏检案例'
    },
    {
        'original_text': '请问我的订单什么时候发货啊？等了三天了',
        'model_prediction': '物流问题',
        'model_confidence': 0.65,
        'manual_label': '物流问题',
        '备注': '预测正确，但置信度略低',
        '周姐备注': ''
    },
    {
        'original_text': '你们的客服态度太差了！问了半天没人理我，我要投诉！',
        'model_prediction': '正常对话',
        'model_confidence': 0.45,
        'manual_label': '投诉-服务态度',
        '备注': '明显漏检，置信度很低',
        '周姐备注': '2024.06.07 周姐：这个样本很重要，需要加入下一批训练数据'
    },
    {
        'original_text': '我想修改一下收货地址，可以吗？',
        'model_prediction': '物流问题',
        'model_confidence': 0.92,
        'manual_label': '物流问题',
        '备注': '正常',
        '周姐备注': ''
    },
    {
        'original_text': '这个价格不对吧，和商品详情页显示的不一样',
        'model_prediction': '价格问题',
        'model_confidence': 0.58,
        'manual_label': '价格问题',
        '备注': '预测正确，但置信度偏低，平均置信度高会被盖住',
        '周姐备注': ''
    }
])

filename = '/Users/lzy/pro/solo/workspaces/zy72524/demo_import_batch1.xlsx'
data.to_excel(filename, index=False)
print(f'✅ 已生成测试文件: {filename}')
print(f'   共 {len(data)} 条样本')
print(f'   低置信度（<0.7）: {len(data[data["model_confidence"] < 0.7])} 条')
print(f'   平均置信度: {data["model_confidence"].mean():.3f}')

data2 = data.copy()
data2.loc[0, '周姐备注'] = '2024.06.08 周姐确认：此条无问题'
data2.loc[2, '备注'] = '预测正确，但置信度略低，已记录优化方向'
data2.loc[4, '周姐备注'] = '2024.06.08 周姐：无需处理'

filename2 = '/Users/lzy/pro/solo/workspaces/zy72524/demo_import_batch1_v2.xlsx'
data2.to_excel(filename2, index=False)
print(f'✅ 已生成第二版测试文件（改备注）: {filename2}')
