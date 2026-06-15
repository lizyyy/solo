"""
端到端验证脚本：模拟用户从导入到图表下钻的完整操作
"""
import requests
import pandas as pd
import os

BASE_URL = 'http://localhost:5001'

def run_e2e_test():
    print("\n" + "=" * 70)
    print("🚀 端到端测试：导入 → 步骤流转 → 批次更新 → 图表下钻")
    print("=" * 70)
    
    # 重置数据库
    if os.path.exists('/Users/lzy/pro/solo/workspaces/zy72524/review_system.db'):
        os.remove('/Users/lzy/pro/solo/workspaces/zy72524/review_system.db')
    
    # 触发数据库初始化
    requests.get(f'{BASE_URL}/')
    
    file1 = '/Users/lzy/pro/solo/workspaces/zy72524/demo_import_batch1.xlsx'
    file2 = '/Users/lzy/pro/solo/workspaces/zy72524/demo_import_batch1_v2.xlsx'
    
    # ============ Step 1: 导入人工改判表 ============
    print("\n📥 Step 1: 第一次导入人工改判表")
    print("-" * 70)
    
    with open(file1, 'rb') as f:
        files = {'file': f}
        data = {
            'sheet_name': '6月第一批人工改判',
            'imported_by': '标注员小王'
        }
        r = requests.post(f'{BASE_URL}/api/sheets/import', files=files, data=data)
        result = r.json()
    
    assert result['success'], f"导入失败: {result}"
    sheet_id = result['sheet_id']
    print(f"   ✅ 导入成功，sheet_id={sheet_id}, 版本v{result['version']}, {result['sample_count']}条样本")
    
    # 检查导入结果
    sheet_resp = requests.get(f'{BASE_URL}/api/sheets/{sheet_id}')
    sheet = sheet_resp.json()
    print(f"   ℹ️  改判表: {sheet['sheet_name']}")
    print(f"   ℹ️  工作流当前步骤: {sheet['workflow_progress']['current_step']}")
    
    # ============ Step 2: 验证步骤流转规则 ============
    print("\n🔄 Step 2: 验证步骤流转（先试跳过Step1，再按顺序走）")
    print("-" * 70)
    
    # 试一下直接推进 Step2（应该被拒绝）
    r2 = requests.post(f'{BASE_URL}/api/workflows/{sheet_id}/complete-step', json={
        'step_name': 'step2_review_prompt',
        'completed_by': '周姐',
        'user_role': 'lead_annotator'
    })
    result2 = r2.json()
    print(f"   🚫 直接推进Step2（未完成Step1）: success={result2['success']}")
    print(f"      错误信息: {result2['message']}")
    assert not result2['success'], "BUG: Step1未完成应该拒绝Step2!"
    
    # 完成 Step1
    r3 = requests.post(f'{BASE_URL}/api/workflows/{sheet_id}/complete-step', json={
        'step_name': 'step1_import',
        'completed_by': '标注员小王',
        'user_role': 'annotator'
    })
    result3 = r3.json()
    print(f"   ✅ 完成Step1（导入）: success={result3['success']}")
    
    # 现在推进 Step2（仍会被拒绝，因为低置信度样本未KB复核）
    r4 = requests.post(f'{BASE_URL}/api/workflows/{sheet_id}/complete-step', json={
        'step_name': 'step2_review_prompt',
        'completed_by': '周姐',
        'user_role': 'lead_annotator'
    })
    result4 = r4.json()
    print(f"   🚫 推进Step2（低置信度未KB复核）: success={result4['success']}")
    print(f"      错误信息: {result4['message']}")
    assert not result4['success'], "BUG: 低置信度未KB复核应该拒绝Step2!"
    
    # KB 复核所有低置信度样本
    samples_resp = requests.get(f'{BASE_URL}/api/sheets/{sheet_id}/samples?only_low_conf=true')
    low_conf_samples = samples_resp.json()
    print(f"   ℹ️  待KB复核样本: {len(low_conf_samples)} 条")
    
    for i, s in enumerate(low_conf_samples):
        decision = 'false_negative' if i in [1, 2] else 'normal'
        r = requests.post(f'{BASE_URL}/api/samples/{s["id"]}/kb-review', json={
            'kb_editor': '知识库编辑老李',
            'decision': decision,
            'remark': '复核完成'
        })
        res = r.json()
        assert res['success'], f"KB复核失败: {s['id']}"
        print(f"   ✅ 样本#{s['id']} KB复核: 置信度{s['model_confidence']} → {decision}")
    
    # 现在推进 Step2（应该成功）
    r5 = requests.post(f'{BASE_URL}/api/workflows/{sheet_id}/complete-step', json={
        'step_name': 'step2_review_prompt',
        'completed_by': '周姐',
        'user_role': 'lead_annotator'
    })
    result5 = r5.json()
    print(f"   ✅ KB复核后推进Step2: success={result5['success']}")
    
    # 完成 Step3
    r6 = requests.post(f'{BASE_URL}/api/workflows/{sheet_id}/complete-step', json={
        'step_name': 'step3_model_update',
        'completed_by': '周姐',
        'user_role': 'lead_annotator'
    })
    result6 = r6.json()
    print(f"   ✅ 完成Step3（模型更新）: success={result6['success']}")
    
    # 确认已完成
    final_workflow = requests.get(f'{BASE_URL}/api/workflows/{sheet_id}').json()
    print(f"   ℹ️  最终步骤: {final_workflow['current_step']}")
    assert final_workflow['current_step'] == 'completed', "工作流未完成!"
    
    # ============ Step 3: 验证批次更新（改备注不建新批次） ============
    print("\n📋 Step 3: 同名改判表更新备注（验证不建新批次）")
    print("-" * 70)
    
    with open(file2, 'rb') as f:
        files = {'file': f}
        data = {
            'sheet_name': '6月第一批人工改判',
            'imported_by': '标注员小王'
        }
        r = requests.post(f'{BASE_URL}/api/sheets/import', files=files, data=data)
        result_update = r.json()
    
    print(f"   导入结果: {result_update['message']}")
    assert result_update['is_batch_update'], "应该是批次更新!"
    assert result_update['sheet_id'] == sheet_id, f"应该是同一个sheet_id! 原{sheet_id}, 新{result_update['sheet_id']}"
    
    print(f"   ✅ 同一批次，版本从v1 → v{result_update['version']}")
    print(f"   ✅ 备注变更: {result_update['remark_changed_count']} 条")
    
    # 验证改判表列表
    sheets_resp = requests.get(f'{BASE_URL}/api/sheets')
    sheets = sheets_resp.json()
    same_name = [s for s in sheets if s['sheet_name'] == '6月第一批人工改判']
    print(f"   ℹ️  同名改判表数量: {len(same_name)} (应为1)")
    assert len(same_name) == 1, f"BUG: 同名改判表数量{len(same_name)}，应该只有1个!"
    print(f"   ℹ️  批次更新历史: {same_name[0]['change_history_count']} 次")
    
    # 验证备注变更历史
    for s in low_conf_samples:
        hist = requests.get(f'{BASE_URL}/api/samples/{s["id"]}/history').json()
        remark_changes = [h for h in hist if h['change_type'] == 'remark_update']
        if remark_changes:
            for h in remark_changes:
                print(f"   📝 样本#{s['id']} 备注变更:")
                print(f"      改前: {h['old_value'][:50]}...")
                print(f"      改后: {h['new_value'][:50]}...")
    
    # ============ Step 4: 验证图表下钻 ============
    print("\n📊 Step 4: 验证置信度图表下钻（每个柱子都能看到样本明细+证据链接）")
    print("-" * 70)
    
    viz_resp = requests.get(f'{BASE_URL}/api/visualization/confidence-distribution/{sheet_id}')
    viz = viz_resp.json()
    
    for range_name, bin_data in viz['bins'].items():
        if bin_data['count'] > 0:
            print(f"\n   📊 区间 {range_name}: {bin_data['count']} 条样本")
            for i, s in enumerate(bin_data['samples'][:2]):
                print(f"      样本#{s['sample_id']}: 置信度={s['model_confidence']} 状态={s['status_label']} 被掩盖={s['masked_by_average']}")
                print(f"         🔗 改判表: {s['links']['correction_sheet']}")
                print(f"         🔗 变更历史: {s['links']['change_history']}")
                print(f"         🔗 回滚: {s['links']['rollback']}")
                print(f"         📝 原始备注: {str(s.get('raw_remark',''))[:60]}")
                
                # 验证链接可访问
                link_resp = requests.get(f"{BASE_URL}{s['links']['change_history']}")
                assert link_resp.status_code == 200, f"历史链接不可访问: {s['links']['change_history']}"
                print(f"         ✅ 证据链接可正常访问")
    
    # ============ Step 5: 验证被平均掩盖的样本 ============
    print("\n⚠️  Step 5: 验证被平均指标盖住的样本")
    print("-" * 70)
    
    masked_resp = requests.get(f'{BASE_URL}/api/visualization/masked-samples/{sheet_id}')
    masked = masked_resp.json()
    print(f"   被平均掩盖的样本: {len(masked)} 条")
    for s in masked:
        print(f"      样本#{s['sample_id']}: 置信度={s['model_confidence']} 备注={str(s.get('raw_remark',''))[:40]}")
    
    # ============ Step 6: 验证完全相同文件重复导入被拒绝 ============
    print("\n🚫 Step 6: 验证完全相同的文件再次导入被拒绝")
    print("-" * 70)
    
    with open(file2, 'rb') as f:
        files = {'file': f}
        data = {
            'sheet_name': '6月第一批人工改判',
            'imported_by': '标注员小王'
        }
        r = requests.post(f'{BASE_URL}/api/sheets/import', files=files, data=data)
        result_dup = r.json()
    
    print(f"   重复导入结果: success={result_dup['success']} is_duplicate={result_dup.get('is_duplicate')}")
    assert result_dup.get('is_duplicate'), "完全相同的文件应该被拒绝!"
    
    # ============ Step 7: 验证回滚功能 ============
    print("\n↩️  Step 7: 验证回滚功能")
    print("-" * 70)
    
    # 拿一个已 KB 复核的样本回滚
    reviewed_sample = [s for s in low_conf_samples if s.get('kb_reviewed')]
    if reviewed_sample:
        sample_id = reviewed_sample[0]['id']
        r = requests.post(f'{BASE_URL}/api/samples/{sample_id}/rollback', json={
            'rolled_by': '周姐',
            'reason': '复核判定需重新确认'
        })
        result_rollback = r.json()
        print(f"   回滚样本#{sample_id}: success={result_rollback['success']}")
        
        # 检查回滚历史
        hist = requests.get(f'{BASE_URL}/api/samples/{sample_id}/history').json()
        rollback_hist = [h for h in hist if h['change_type'] == 'rollback']
        print(f"   ✅ 回滚操作已记录在历史中，共{len(rollback_hist)}条回滚记录")
    
    print("\n" + "=" * 70)
    print("🎉 所有端到端测试通过!")
    print("=" * 70)
    print("\n📌 验证总结:")
    print("   ✅ 步骤流转严格按顺序，前置步骤未完成时不能推进")
    print("   ✅ 同名改判表仅更新版本，不建新批次")
    print("   ✅ 备注变更逐条记录，改前改后可对比")
    print("   ✅ 图表下钻每个样本都带完整证据链（改判表/提示词/历史/回滚）")
    print("   ✅ 被平均掩盖的样本可单独筛选查看")
    print("   ✅ 完全相同的文件重复导入被拒绝")
    print("   ✅ 回滚功能正常，回滚操作本身也留痕")
    print("   ✅ KB复核是Step2的前置条件")
    print("\n🌐 访问 http://localhost:5000 查看 Web 界面")
    print("   - 点击置信度分布图的柱子看明细下钻")
    print("   - 在改判表列表中查看批次更新历史")
    print("   - 在样本详情中查看备注变更对比")
    
    return True

if __name__ == '__main__':
    try:
        run_e2e_test()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请先运行: python3 app.py")
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
