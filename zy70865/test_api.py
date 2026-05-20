#!/usr/bin/env python3
import requests
import os

BASE_URL = "http://localhost:8000"

def test_root():
    """测试根路径"""
    response = requests.get(f"{BASE_URL}/")
    print("测试根路径:", response.json())
    return response.status_code == 200

def test_reconcile():
    """测试对账接口"""
    files = {
        'wash_csv': open('sample_data/wash_sample.csv', 'rb'),
        'recycle_json': open('sample_data/recycle_sample.json', 'rb'),
        'room_config_json': open('sample_data/room_config_sample.json', 'rb')
    }
    
    response = requests.post(f"{BASE_URL}/api/reconcile", files=files)
    
    for f in files.values():
        f.close()
    
    result = response.json()
    print("\n=== 对账结果 ===")
    print(f"批次ID: {result['batch_id']}")
    print(f"成功: {result['success']}")
    print(f"消息: {result['message']}")
    
    if result['result']:
        r = result['result']
        print(f"\n总送洗: {r['total_wash']}")
        print(f"总回收: {r['total_recycle']}")
        print(f"正常项: {r['normal_count']}")
        print(f"待确认: {r['pending_count']}")
        print(f"失败项: {r['failed_count']}")
        print(f"赔付总额: {r['total_compensation']} 元")
        
        if r['failed_items']:
            print("\n=== 失败项（需赔付） ===")
            for item in r['failed_items']:
                print(f"  - {item['item_type']}: {item['suggestion']}")
                if item.get('compensation'):
                    comp = item['compensation']
                    print(f"    赔付ID: {comp['compensation_id']}")
                    print(f"    赔付金额: {comp['total_amount']} 元")
                    return comp['compensation_id']
    
    return None

def test_duplicate_submit():
    """测试重复提交"""
    files = {
        'wash_csv': open('sample_data/wash_sample.csv', 'rb'),
        'recycle_json': open('sample_data/recycle_sample.json', 'rb')
    }
    
    response = requests.post(f"{BASE_URL}/api/reconcile", files=files)
    
    for f in files.values():
        f.close()
    
    result = response.json()
    print("\n=== 重复提交测试 ===")
    print(f"是否重复: {result['is_duplicate']}")
    print(f"消息: {result['message']}")

def test_compensation_trace(compensation_id):
    """测试赔付溯源"""
    if not compensation_id:
        return
    
    response = requests.get(f"{BASE_URL}/api/compensation/{compensation_id}")
    trace = response.json()
    
    print("\n=== 赔付溯源信息 ===")
    print(f"赔付ID: {trace['compensation']['compensation_id']}")
    print(f"来源批次: {trace['compensation']['source_batch_id']}")
    print(f"物品类型: {trace['compensation']['source_item_type']}")
    print(f"赔付原因: {trace['compensation']['reason']}")
    print(f"赔付数量: {trace['compensation']['quantity']}")
    print(f"赔付金额: {trace['compensation']['total_amount']} 元")
    
    if trace['wash_items']:
        print(f"\n原始送洗记录数量: {len(trace['wash_items'])}")
    if trace['recycle_items']:
        print(f"原始回收记录数量: {len(trace['recycle_items'])}")

def test_check_batch():
    """测试检查批次"""
    response = requests.get(f"{BASE_URL}/api/batches/check/BATCH20240520001")
    print("\n=== 批次检查 ===")
    print(response.json())

if __name__ == "__main__":
    print("=" * 50)
    print("酒店布草对账系统 API 测试")
    print("=" * 50)
    
    try:
        if test_root():
            compensation_id = test_reconcile()
            test_duplicate_submit()
            test_compensation_trace(compensation_id)
            test_check_batch()
            
            print("\n" + "=" * 50)
            print("所有测试完成！")
            print("=" * 50)
        else:
            print("服务未启动，请先运行: uvicorn app.main:app --reload")
    
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器")
        print("请先启动服务: uvicorn app.main:app --reload")
    except Exception as e:
        print(f"测试出错: {e}")
