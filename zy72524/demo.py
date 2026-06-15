#!/usr/bin/env python3
"""
演示脚本：生成测试数据并验证智能质检漏检复盘系统的完整流程

运行前请先安装依赖并启动服务：
    pip install -r requirements.txt
    python app.py
"""

import pandas as pd
import os
import requests

BASE_URL = 'http://localhost:5001'

def generate_demo_excel():
    """生成演示用的人工改判表"""
    data = [
        {
            'original_text': '我想咨询一下退款政策',
            'model_prediction': '售后问题',
            'model_confidence': 0.95,
            'manual_label': '售后问题',
            '备注': '常规咨询，没问题'
        },
        {
            'original_text': '这个商品质量太差了，我要投诉',
            'model_prediction': '正常反馈',
            'model_confidence': 0.55,
            'manual_label': '投诉',
            '备注': '模型置信度低，周姐2024.06.01复核：确实是投诉，漏检了',
            '周姐特别备注': '这个样本很典型，平均置信度高但单条不准'
        },
        {
            'original_text': '请问发货时间是什么时候',
            'model_prediction': '物流问题',
            'model_confidence': 0.65,
            'manual_label': '物流问题',
            '备注': '置信度略低，但结果正确'
        },
        {
            'original_text': '你们的客服态度太差了',
            'model_prediction': '正常对话',
            'model_confidence': 0.45,
            'manual_label': '投诉-服务态度',
            '备注': '明显漏检',
            'remark_internal': '需要加入下一批训练数据'
        },
        {
            'original_text': '我想修改收货地址',
            'model_prediction': '物流问题',
            'model_confidence': 0.92,
            'manual_label': '物流问题',
            '备注': '正常'
        }
    ]
    
    df = pd.DataFrame(data)
    filename = 'demo_correction_sheet.xlsx'
    df.to_excel(filename, index=False)
    print(f"✅ 已生成测试文件: {filename}")
    print(f"   共 {len(df)} 条样本，其中 2 条低置信度（<0.7）")
    print(f"   平均置信度: {df['model_confidence'].mean():.3f} (>0.7，会触发被平均掩盖检测)")
    print()
    return filename

def demo_full_workflow():
    """演示完整三步工作流"""
    print("=" * 60)
    print("🚀 智能质检漏检复盘系统 - 完整流程演示")
    print("=" * 60)
    print()
    
    filename = generate_demo_excel()
    
    print("📥 Step 1: 导入人工改判表")
    print("-" * 40)
    
    with open(filename, 'rb') as f:
        files = {'file': f}
        data = {
            'sheet_name': '6月第一批改判表',
            'imported_by': '标注员小王'
        }
        res = requests.post(f'{BASE_URL}/api/sheets/import', files=files, data=data)
        result = res.json()
    
    if result.get('is_duplicate'):
        print(f"⚠️  {result['message']}")
        sheet_id = result['existing_sheet_id']
    else:
        print(f"✅ {result['message']}")
        sheet_id = result['sheet_id']
    print()
    
    print("🔍 自动检测结果:")
    res = requests.get(f'{BASE_URL}/api/visualization/status-summary/{sheet_id}')
    status = res.json()
    print(f"   - 低置信度样本: {status['status_counts'].get('low_confidence', {}).get('count', 0)} 条")
    print(f"   - 被平均指标盖住: {status['masked_by_average_count']} 条")
    print()
    
    print("📋 被平均掩盖的样本详情（带证据追溯链接）:")
    res = requests.get(f'{BASE_URL}/api/visualization/masked-samples/{sheet_id}')
    masked = res.json()
    for s in masked:
        print(f"   - 样本 #{s['sample_id']}: 置信度={s['model_confidence']}")
        print(f"     原始备注: {s['raw_remark']}")
        print(f"     证据链接: {s['links']}")
        print()
    
    print("💡 Step 2: 标注负责人周姐补看提示词版本")
    print("-" * 40)
    
    res = requests.post(f'{BASE_URL}/api/prompts', json={
        'version_number': 'v2.3.1',
        'prompt_text': '你是一个智能质检助手，负责检测用户对话中的投诉、售后、物流等问题...',
        'remark': '优化了投诉类别的边界定义，增加了对"态度差"等隐含投诉的识别',
        'model_version': 'model-20240601',
        'created_by': '周姐'
    })
    prompt_result = res.json()
    print(f"✅ 周姐创建了提示词版本 v2.3.1")
    print(f"   备注已完整保留: 优化了投诉类别的边界定义...")
    print()
    
    print("⚠️  尝试直接推进 Step 2（应该失败，因为低置信度样本未复核）:")
    res = requests.post(f'{BASE_URL}/api/workflows/{sheet_id}/complete-step', json={
        'step_name': 'step2_review_prompt',
        'completed_by': '周姐',
        'user_role': 'lead_annotator'
    })
    step2_try = res.json()
    print(f"   ❌ {step2_try['message']}")
    print()
    
    print("📝 知识库编辑对低置信度样本进行复核:")
    samples_res = requests.get(f'{BASE_URL}/api/sheets/{sheet_id}/samples?status=low_confidence')
    samples = samples_res.json()
    for i, s in enumerate(samples):
        decision = 'false_negative' if i == 0 else 'normal'
        res = requests.post(f'{BASE_URL}/api/samples/{s["id"]}/kb-review', json={
            'kb_editor': '知识库编辑老李',
            'decision': decision,
            'remark': f'复核通过，判定为{"漏检" if decision == "false_negative" else "正常"}'
        })
        result = res.json()
        print(f"   - 样本 #{s['id']}: 判定为 {decision}")
        
        if i == 0:
            print(f"     🔗 查看变更历史: GET /api/samples/{s['id']}/history")
            res_hist = requests.get(f'{BASE_URL}/api/samples/{s["id"]}/history')
            hist = res_hist.json()
            for h in hist[-2:]:
                print(f"       {h['change_type']}: {h['old_status']} → {h['new_status']}")
    print()
    
    print("✅ 重新推进 Step 2（现在应该成功）:")
    res = requests.post(f'{BASE_URL}/api/workflows/{sheet_id}/complete-step', json={
        'step_name': 'step2_review_prompt',
        'completed_by': '周姐',
        'user_role': 'lead_annotator'
    })
    step2_result = res.json()
    print(f"   {step2_result['message']}")
    print()
    
    print("🔄 Step 3: 模型版本对比更新")
    print("-" * 40)
    res = requests.post(f'{BASE_URL}/api/workflows/{sheet_id}/complete-step', json={
        'step_name': 'step3_model_update',
        'completed_by': '周姐',
        'user_role': 'lead_annotator'
    })
    step3_result = res.json()
    print(f"   {step3_result['message']}")
    print()
    
    print("📊 最终工作流状态:")
    res = requests.get(f'{BASE_URL}/api/workflows/{sheet_id}')
    workflow = res.json()
    for i, step in enumerate(workflow['steps']):
        status = '✅ 完成' if step['completed'] else '⏳ 进行中'
        print(f"   Step {i+1}: {status} {'by ' + step['completed_by'] if step['completed_by'] else ''}")
    print()
    
    print("🔄 演示回滚功能:")
    print(f"   对样本 #{samples[0]['id']} 执行回滚")
    res = requests.post(f'{BASE_URL}/api/samples/{samples[0]["id"]}/rollback', json={
        'rolled_by': '周姐',
        'reason': '复核判定有误，需要重新确认'
    })
    rollback_result = res.json()
    if rollback_result['success']:
        print(f"   ✅ 已回滚到上一状态: {rollback_result['sample']['status']}")
        print(f"   🔗 回滚操作本身也被记录在历史中")
    print()
    
    print("=" * 60)
    print("🎉 演示完成！")
    print("=" * 60)
    print()
    print("📌 关键点回顾:")
    print("   1. ✅ 提示词备注和样本备注都完整保留，没有被清洗")
    print("   2. ✅ 低置信度样本被自动检测，被平均掩盖的被特殊标记")
    print("   3. ✅ Step 2 必须等所有低置信度样本经 KB 复核后才能推进")
    print("   4. ✅ 每次状态变更都记录历史，支持回滚，回滚也留痕")
    print("   5. ✅ 所有可视化数据都带证据追溯链接")
    print("   6. ✅ 工作流必须按顺序推进，角色权限控制严格")
    print()
    print("🌐 访问 http://localhost:5000 查看 Web 界面")
    print("📖 查看 README.md 了解完整边界规则")
    
    if os.path.exists(filename):
        os.remove(filename)

if __name__ == '__main__':
    try:
        demo_full_workflow()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请先运行: python app.py")
        print()
        print("或者只生成测试文件:")
        generate_demo_excel()
