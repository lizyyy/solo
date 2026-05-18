import requests
import json
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:5001/api'


def test_single_create():
    print('=' * 60)
    print('测试1：单条人工录入')
    print('=' * 60)
    
    data = {
        'customer_name': '张三',
        'customer_phone': '13800138001',
        'customer_wechat': 'zhangsan_wx',
        'product_type': '牛皮公文包',
        'product_brand': '古驰',
        'product_color': '深棕色',
        'product_material': '头层牛皮',
        'original_order_no': 'HL20240510001',
        'receive_date': (datetime.now() - timedelta(days=3)).isoformat(),
        'receive_staff': '李店长',
        'store_name': '皮具护理旗舰店(王府井店)',
        'original_damage_description': '包角磨损，提手处有划痕，五金氧化',
        'original_damage_photos': ['/uploads/old_damage_001_1.jpg', '/uploads/old_damage_001_2.jpg'],
        'repair_content': '重新打磨上色包角，提手划痕修复，五金抛光',
        'repair_reason': '客户反馈包角上色不均匀，提手处仍有明显划痕',
        'created_by': '系统管理员'
    }
    
    response = requests.post(f'{BASE_URL}/repair', json=data)
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()
    
    if result.get('success'):
        return result.get('record_id')
    return None


def test_feedback_after_takeaway():
    print('=' * 60)
    print('测试2：客户取走后反馈旧划痕问题')
    print('=' * 60)
    
    data = {
        'customer_name': '李四',
        'customer_phone': '13900139002',
        'product_type': '羊皮女包',
        'product_brand': '香奈儿',
        'product_color': '黑色',
        'product_material': '小羊皮',
        'original_order_no': 'HL20240508003',
        'receive_date': (datetime.now() - timedelta(days=15)).isoformat(),
        'receive_staff': '王店员',
        'store_name': '皮具护理旗舰店(朝阳店)',
        'original_damage_description': '边角轻微磨损',
        'original_damage_photos': [],
        'repair_content': '边角磨损修复，整体护理',
        'repair_reason': '客户取走10天后反馈包包正面有大面积划痕，认为是护理时造成的',
        'repair_status': '已取走',
        'customer_takeaway_date': (datetime.now() - timedelta(days=10)).isoformat(),
        'customer_takeaway_staff': '王店员',
        'customer_signature': '李四',
        'feedback_after_takeaway': '客户取走回家后发现包包正面有3处长约5cm的划痕，之前送修时没有，要求赔偿',
        'feedback_date': (datetime.now() - timedelta(days=9)).isoformat(),
        'feedback_photos': ['/uploads/feedback_002_1.jpg'],
        'created_by': '客服小王'
    }
    
    response = requests.post(f'{BASE_URL}/repair', json=data)
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()
    
    if result.get('success'):
        return result.get('record_id')
    return None


def test_batch_import():
    print('=' * 60)
    print('测试3：批量补录')
    print('=' * 60)
    
    batch_data = {
        'records': [
            {
                'customer_name': '王五',
                'customer_phone': '13700137003',
                'product_type': '牛皮皮带',
                'product_brand': '爱马仕',
                'product_color': '黑色',
                'original_order_no': 'HL20240505007',
                'receive_date': (datetime.now() - timedelta(days=20)).isoformat(),
                'receive_staff': '赵店长',
                'store_name': '皮具护理旗舰店(海淀店)',
                'original_damage_description': '带身磨损，孔位开裂',
                'original_damage_photos': ['/uploads/old_003_1.jpg'],
                'repair_content': '带身补色，孔位加固',
                'repair_reason': '孔位加固不到位，使用后又开裂',
                'repair_decision': '同意返修',
                'repair_decision_date': (datetime.now() - timedelta(days=18)).isoformat(),
                'repair_decision_staff': '技术主管',
                'store_responsibility': '全责',
                'responsibility_note': '工艺问题，门店承担全部返修费用',
                'estimated_cost': 150,
                'actual_cost': 120,
                'cost_bearer': '门店',
                'repair_status': '已完成',
                'customer_takeaway_date': (datetime.now() - timedelta(days=5)).isoformat(),
                'handling_result': '重新加固孔位，客户满意取走',
                'completion_date': (datetime.now() - timedelta(days=5)).isoformat(),
                'created_by': '数据补录员'
            },
            {
                'customer_name': '赵六',
                'customer_phone': '13600136004',
                'product_type': '帆布配皮包',
                'product_brand': '路易威登',
                'product_color': '老花',
                'original_order_no': 'HL20240503012',
                'receive_date': (datetime.now() - timedelta(days=25)).isoformat(),
                'receive_staff': '孙店员',
                'store_name': '皮具护理旗舰店(西城店)',
                'original_damage_description': '配皮变色，边角磨损',
                'original_damage_photos': [],
                'repair_content': '配皮翻新，边角修复',
                'repair_reason': '配皮颜色不均匀，与原色有差异',
                'repair_decision': '协商处理',
                'repair_decision_date': (datetime.now() - timedelta(days=22)).isoformat(),
                'repair_decision_staff': '区域经理',
                'store_responsibility': '部分责任',
                'responsibility_note': '配色确实存在偏差，给予半价重做',
                'estimated_cost': 300,
                'actual_cost': 150,
                'cost_bearer': '共担',
                'repair_status': '处理中',
                'created_by': '数据补录员'
            }
        ]
    }
    
    response = requests.post(f'{BASE_URL}/repair/batch', json=batch_data)
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()


def test_validation(record_id):
    print('=' * 60)
    print(f'测试4：校验记录{record_id}，获取需补充材料')
    print('=' * 60)
    
    response = requests.post(f'{BASE_URL}/repair/validate/{record_id}')
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()


def test_list_and_stats():
    print('=' * 60)
    print('测试5：获取记录列表和统计')
    print('=' * 60)
    
    response = requests.get(f'{BASE_URL}/repair')
    result = response.json()
    print(f'总记录数: {result.get("total")}')
    print(f'当前页记录数: {len(result.get("data", []))}')
    print()
    
    response = requests.get(f'{BASE_URL}/repair/stats')
    result = response.json()
    print('统计数据:')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print()


def test_export():
    print('=' * 60)
    print('测试6：导出Excel文件')
    print('=' * 60)
    
    response = requests.get(f'{BASE_URL}/repair/export')
    if response.status_code == 200:
        filename = f'返修记录导出_{datetime.now().strftime("%Y%m%d%H%M%S")}.xlsx'
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f'导出成功: {filename}')
    else:
        print('导出失败')
    print()


def main():
    print('开始测试皮具护理返修API...')
    print()
    
    try:
        record_id1 = test_single_create()
        record_id2 = test_feedback_after_takeaway()
        test_batch_import()
        
        if record_id2:
            test_validation(record_id2)
        
        test_list_and_stats()
        test_export()
        
        print('=' * 60)
        print('所有测试完成！')
        print('=' * 60)
        print()
        print('项目目录结构：')
        print('- app.py          # 主程序入口')
        print('- models.py       # 数据模型')
        print('- services.py     # 业务逻辑层')
        print('- requirements.txt # 依赖配置')
        print()
        print('API接口列表：')
        print('POST   /api/repair           # 单条录入')
        print('POST   /api/repair/batch     # 批量补录')
        print('GET    /api/repair/<id>      # 获取单条记录')
        print('PUT    /api/repair/<id>      # 更新记录')
        print('GET    /api/repair           # 列表查询（分页）')
        print('POST   /api/repair/validate/<id> # 校验并获取需补充材料')
        print('GET    /api/repair/export    # 导出Excel')
        print('GET    /api/repair/stats     # 获取统计数据')
        
    except requests.exceptions.ConnectionError:
        print('错误：无法连接到服务器，请先运行 python app.py 启动服务')
    except Exception as e:
        print(f'测试过程出错: {e}')


if __name__ == '__main__':
    main()