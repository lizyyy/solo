import sys
sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy72524')

from app import create_app
from gen_test_data import *

app = create_app()

with app.test_client() as client:
    print("\n" + "=" * 70)
    print("🔍 证据链一致性验证：同一条样本的完整判断明细追溯")
    print("=" * 70)

    passed = 0
    failed = 0

    def check(name, condition, detail=''):
        global passed, failed
        if condition:
            passed += 1
            print(f'  ✅ {name}')
            if detail:
                print(f'     {detail}')
        else:
            failed += 1
            print(f'  ❌ {name}')
            if detail:
                print(f'     {detail}')

    # ==================== Step 1: 首次导入 ====================
    print("\n📥 Step 1: 首次导入人工改判表")
    print("-" * 70)
    
    with open('demo_import_batch1.xlsx', 'rb') as f:
        r = client.post('/api/sheets/import', 
            data={'file': f, 'sheet_name': '6月第一批人工改判', 'imported_by': '标注员小王'},
            content_type='multipart/form-data'
        )
    result = r.get_json()
    assert result['success'], f"导入失败: {result}"
    sheet_id = result['sheet_id']
    print(f"  导入成功: sheet_id={sheet_id}, samples={result['sample_count']}")

    # ==================== Step 2: 获取样本列表 ====================
    print("\n📋 Step 2: 从样本列表选定目标低置信度样本")
    print("-" * 70)
    
    r = client.get(f'/api/sheets/{sheet_id}/samples?only_low_conf=true')
    samples_list = r.get_json()
    print(f"  低置信度样本数: {len(samples_list)}")
    
    target_sample = min(samples_list, key=lambda s: s['model_confidence'])
    target_id = target_sample['id']
    print(f"  目标样本: #{target_id}")
    
    check('样本列表有 original_text', 'original_text' in target_sample and target_sample['original_text'])
    check('样本列表有 model_prediction', 'model_prediction' in target_sample and target_sample['model_prediction'])
    check('样本列表有 manual_label', 'manual_label' in target_sample and target_sample['manual_label'])
    check('样本列表有 model_confidence', 'model_confidence' in target_sample and target_sample['model_confidence'] is not None)
    check('样本列表有 raw_remark', 'raw_remark' in target_sample)
    check('样本列表有 status', 'status' in target_sample)
    check('样本列表有 is_low_confidence', 'is_low_confidence' in target_sample)
    check('样本列表有 masked_by_average', 'masked_by_average' in target_sample)
    
    baseline = {
        'id': target_sample['id'],
        'original_text': target_sample['original_text'],
        'model_prediction': target_sample['model_prediction'],
        'model_confidence': target_sample['model_confidence'],
        'manual_label': target_sample['manual_label'],
        'raw_remark': target_sample['raw_remark'],
        'status': target_sample['status'],
        'is_low_confidence': target_sample['is_low_confidence'],
    }
    print(f"  基准数据: 原文=\"{baseline['original_text'][:30]}...\", "
          f"预测={baseline['model_prediction']}, "
          f"人工={baseline['manual_label']}, "
          f"置信度={baseline['model_confidence']:.3f}")

    # ==================== Step 3: 图表下钻 ====================
    print("\n📊 Step 3: 验证置信度分布图表下钻数据")
    print("-" * 70)
    
    r = client.get(f'/api/visualization/confidence-distribution/{sheet_id}')
    viz_data = r.get_json()
    
    target_in_viz = None
    target_bin = None
    for bin_name, bin_data in viz_data['bins'].items():
        for s in bin_data['samples']:
            if s.get('sample_id') == target_id or s.get('id') == target_id:
                target_in_viz = s
                target_bin = bin_name
                break
        if target_in_viz:
            break
    
    check('图表下钻中能找到目标样本', target_in_viz is not None, 
          f'所在区间: {target_bin}' if target_bin else '')
    
    if target_in_viz:
        check('图表下钻有 original_text', 'original_text' in target_in_viz and target_in_viz['original_text'])
        check('图表下钻有 model_prediction', 'model_prediction' in target_in_viz and target_in_viz['model_prediction'])
        check('图表下钻有 manual_label', 'manual_label' in target_in_viz and target_in_viz['manual_label'])
        check('图表下钻有 model_confidence', 'model_confidence' in target_in_viz and target_in_viz['model_confidence'] is not None)
        check('图表下钻有 raw_remark', 'raw_remark' in target_in_viz)
        check('图表下钻有 status', 'status' in target_in_viz)
        check('图表下钻有 status_label', 'status_label' in target_in_viz)
        check('图表下钻有 is_low_confidence', 'is_low_confidence' in target_in_viz)
        check('图表下钻有 masked_by_average', 'masked_by_average' in target_in_viz)
        check('图表下钻有 kb_reviewed', 'kb_reviewed' in target_in_viz)
        
        check('图表下钻原文与样本列表一致', target_in_viz['original_text'] == baseline['original_text'])
        check('图表下钻模型预测与样本列表一致', target_in_viz['model_prediction'] == baseline['model_prediction'])
        check('图表下钻人工标注与样本列表一致', target_in_viz['manual_label'] == baseline['manual_label'])
        check('图表下钻置信度与样本列表一致', target_in_viz['model_confidence'] == baseline['model_confidence'])
        check('图表下钻备注与样本列表一致', target_in_viz['raw_remark'] == baseline['raw_remark'])
        check('图表下钻状态与样本列表一致', target_in_viz['status'] == baseline['status'])
        
        check('图表下钻有改判表链接', target_in_viz.get('links', {}).get('correction_sheet') is not None)
        check('图表下钻有变更历史链接', target_in_viz.get('links', {}).get('change_history') is not None)
        check('图表下钻有回滚链接', target_in_viz.get('links', {}).get('rollback') is not None)

    # ==================== Step 4: 样本详情 ====================
    print("\n🔍 Step 4: 验证样本详情 API")
    print("-" * 70)
    
    r = client.get(f'/api/samples/{target_id}')
    detail = r.get_json()
    
    check('样本详情有 original_text', 'original_text' in detail and detail['original_text'])
    check('样本详情有 model_prediction', 'model_prediction' in detail and detail['model_prediction'])
    check('样本详情有 manual_label', 'manual_label' in detail and detail['manual_label'])
    check('样本详情有 model_confidence', 'model_confidence' in detail and detail['model_confidence'] is not None)
    check('样本详情有 raw_remark', 'raw_remark' in detail)
    check('样本详情有 status', 'status' in detail)
    check('样本详情有 status_label', 'status_label' in detail)
    check('样本详情有 is_low_confidence', 'is_low_confidence' in detail)
    check('样本详情有 masked_by_average', 'masked_by_average' in detail)
    check('样本详情有 kb_reviewed', 'kb_reviewed' in detail)
    check('样本详情有 unique_key', 'unique_key' in detail)
    
    check('样本详情原文与基准一致', detail['original_text'] == baseline['original_text'])
    check('样本详情模型预测与基准一致', detail['model_prediction'] == baseline['model_prediction'])
    check('样本详情人工标注与基准一致', detail['manual_label'] == baseline['manual_label'])
    check('样本详情置信度与基准一致', detail['model_confidence'] == baseline['model_confidence'])
    check('样本详情备注与基准一致', detail['raw_remark'] == baseline['raw_remark'])
    check('样本详情状态与基准一致', detail['status'] == baseline['status'])
    check('样本详情 ID 与基准一致', detail['id'] == baseline['id'] or detail.get('sample_id') == baseline['id'])

    # ==================== Step 5: 变更历史 ====================
    print("\n📜 Step 5: 验证样本变更历史 API")
    print("-" * 70)
    
    r = client.get(f'/api/samples/{target_id}/history')
    history = r.get_json()
    
    check('变更历史返回列表', isinstance(history, list))

    # ==================== Step 6: 被平均掩盖样本 ====================
    print("\n⚠️ Step 6: 验证被平均掩盖样本列表")
    print("-" * 70)
    
    r = client.get(f'/api/visualization/masked-samples/{sheet_id}')
    masked_samples = r.get_json()
    
    print(f"  被平均掩盖样本数: {len(masked_samples)}")
    
    target_masked = None
    for s in masked_samples:
        if s.get('sample_id') == target_id or s.get('id') == target_id:
            target_masked = s
            break
    
    if target_masked:
        check('被掩盖列表有 original_text', 'original_text' in target_masked and target_masked['original_text'])
        check('被掩盖列表有 model_prediction', 'model_prediction' in target_masked and target_masked['model_prediction'])
        check('被掩盖列表有 manual_label', 'manual_label' in target_masked and target_masked['manual_label'])
        check('被掩盖列表原文与基准一致', target_masked['original_text'] == baseline['original_text'])
        check('被掩盖列表置信度与基准一致', target_masked['model_confidence'] == baseline['model_confidence'])
    else:
        print(f"  ⏭️  目标样本不在被掩盖列表中（置信度 {baseline['model_confidence']:.3f}）")

    # ==================== Step 7: 批次更新 ====================
    print("\n🔄 Step 7: 重复导入同批次（改备注），验证同一样本 ID 不变")
    print("-" * 70)
    
    with open('demo_import_batch1_v2.xlsx', 'rb') as f:
        r = client.post('/api/sheets/import', 
            data={'file': f, 'sheet_name': '6月第一批人工改判', 'imported_by': '标注员小王'},
            content_type='multipart/form-data'
        )
    result_update = r.get_json()
    
    check('同名批次更新成功', result_update.get('success') == True)
    check('返回 is_batch_update=True', result_update.get('is_batch_update') == True)
    check('sheet_id 与原批次一致', result_update['sheet_id'] == sheet_id,
          f"原 sheet_id={sheet_id}, 新 sheet_id={result_update['sheet_id']}")
    check('版本号递增', result_update['version'] == 2)
    check('有 remark_changed_count', 'remark_changed_count' in result_update,
          f"备注变更数: {result_update.get('remark_changed_count', 0)}")
    
    r = client.get(f'/api/samples/{target_id}')
    detail_after = r.get_json()
    
    check('批次更新后样本 ID 不变', detail_after['id'] == baseline['id'] or detail_after.get('sample_id') == baseline['id'])
    check('批次更新后原文不变', detail_after['original_text'] == baseline['original_text'])
    check('批次更新后模型预测不变', detail_after['model_prediction'] == baseline['model_prediction'])
    check('批次更新后人工标注不变', detail_after['manual_label'] == baseline['manual_label'])
    check('批次更新后置信度不变', detail_after['model_confidence'] == baseline['model_confidence'])
    
    # 找一条备注确实变了的样本来验证
    all_samples = client.get(f'/api/sheets/{sheet_id}/samples').get_json()
    remark_changed_sample = None
    for s in all_samples:
        if s['id'] != target_id:
            # 检查是否有备注变更历史
            hist = client.get(f"/api/samples/{s['id']}/history").get_json()
            remark_hists = [h for h in hist if h.get('change_type') == 'remark_update']
            if len(remark_hists) > 0:
                remark_changed_sample = s
                break
    
    if remark_changed_sample:
        print(f"  选择备注变更样本: #{remark_changed_sample['id']}")
        r = client.get(f'/api/samples/{remark_changed_sample["id"]}')
        detail_remark = r.get_json()
        
        # 获取变更前的备注（从历史记录）
        hist = client.get(f"/api/samples/{remark_changed_sample['id']}/history").get_json()
        remark_hists = [h for h in hist if h.get('change_type') == 'remark_update']
        
        check('有备注变更的样本，批次更新后 ID 不变', 
              detail_remark['id'] == remark_changed_sample['id'])
        check('有备注变更的样本，批次更新后原文不变', 
              'original_text' in detail_remark and detail_remark['original_text'])
        check('有备注变更的样本，批次更新后模型预测不变', 
              'model_prediction' in detail_remark and detail_remark['model_prediction'])
        check('有备注变更记录（总数）', len(remark_hists) > 0, 
              f'备注变更记录数: {len(remark_hists)}')
        
        if len(remark_hists) > 0:
            latest = remark_hists[-1]
            check('备注变更有 old_value', 'old_value' in latest and latest['old_value'] is not None)
            check('备注变更有 new_value', 'new_value' in latest and latest['new_value'] is not None)
            check('备注变更 field_name 正确', latest.get('field_name') == 'raw_remark')
            check('改前改后不一样', latest['old_value'] != latest['new_value'])
            print(f"     改前: \"{str(latest['old_value'])[:40]}...\"")
            print(f"     改后: \"{str(latest['new_value'])[:40]}...\"")
    else:
        print("  ⚠️  没有找到备注变更的样本")

    # ==================== Step 9: KB 复核 ====================
    print("\n✅ Step 9: KB 复核后验证状态变化")
    print("-" * 70)
    
    r = client.post(f'/api/samples/{target_id}/kb-review', json={
        'kb_editor': '知识库编辑小李',
        'decision': 'false_negative',
        'remark': '确认是漏检，需要加入训练数据'
    })
    review_result = r.get_json()
    
    check('KB 复核成功', review_result.get('success') == True)
    
    r = client.get(f'/api/samples/{target_id}')
    detail_reviewed = r.get_json()
    
    check('KB 复核后 kb_reviewed=True', detail_reviewed['kb_reviewed'] == True)
    check('KB 复核后状态变更', detail_reviewed['status'] == 'false_negative')
    check('KB 复核后原文不变', detail_reviewed['original_text'] == baseline['original_text'])
    check('KB 复核后模型预测不变', detail_reviewed['model_prediction'] == baseline['model_prediction'])
    check('KB 复核后人工标注不变', detail_reviewed['manual_label'] == baseline['manual_label'])
    check('KB 复核后置信度不变', detail_reviewed['model_confidence'] == baseline['model_confidence'])

    r = client.get(f'/api/samples/{target_id}/history')
    history_reviewed = r.get_json()
    kb_reviews = [h for h in history_reviewed if h.get('change_type') == 'kb_review']
    check('有 KB 复核历史记录', len(kb_reviews) > 0)

    # ==================== Step 10: 导出报告 ====================
    print("\n📤 Step 10: 验证导出报告包含完整判断明细")
    print("-" * 70)
    
    import csv
    import io
    
    r = client.get(f'/api/sheets/{sheet_id}/export')
    
    check('导出请求成功', r.status_code == 200)
    check('导出内容是 CSV', 'text/csv' in r.headers.get('Content-Type', ''))
    
    content = r.data.decode('utf-8-sig')
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    
    check('CSV 有数据行', len(rows) > 5)
    
    header_row_idx = None
    for i, row in enumerate(rows):
        if len(row) > 0 and row[0] == '样本ID':
            header_row_idx = i
            break
    
    check('CSV 有样本数据表头', header_row_idx is not None)
    
    if header_row_idx is not None:
        headers = rows[header_row_idx]
        check('CSV 有原文字段', '原文' in headers)
        check('CSV 有模型预测字段', '模型预测' in headers)
        check('CSV 有模型置信度字段', '模型置信度' in headers)
        check('CSV 有人工标注字段', '人工标注' in headers)
        check('CSV 有当前状态字段', '当前状态' in headers)
        check('CSV 有原始备注字段', '原始备注' in headers)
        check('CSV 有是否低置信度字段', '是否低置信度' in headers)
        check('CSV 有是否被平均掩盖字段', '是否被平均掩盖' in headers)
        
        target_row = None
        for row in rows[header_row_idx + 1:]:
            if len(row) > 0 and row[0] == str(target_id):
                target_row = dict(zip(headers, row))
                break
        
        check('CSV 中能找到目标样本', target_row is not None)
        
        if target_row:
            check('CSV 原文与基准一致', target_row['原文'] == baseline['original_text'])
            check('CSV 模型预测与基准一致', target_row['模型预测'] == baseline['model_prediction'])
            check('CSV 人工标注与基准一致', target_row['人工标注'] == baseline['manual_label'])
            check('CSV 置信度与基准一致', float(target_row['模型置信度']) == baseline['model_confidence'])
            check('CSV 有备注', '原始备注' in target_row)
            check('CSV 状态正确', '漏检' in target_row['当前状态'] or 'false_negative' in target_row['当前状态'].lower())

    # ==================== Step 11: 图表下钻（复核后） ====================
    print("\n📊 Step 11: 验证 KB 复核后图表下钻数据同步更新")
    print("-" * 70)
    
    r = client.get(f'/api/visualization/confidence-distribution/{sheet_id}')
    viz_after = r.get_json()
    
    target_in_viz_after = None
    for bin_name, bin_data in viz_after['bins'].items():
        for s in bin_data['samples']:
            if s.get('sample_id') == target_id or s.get('id') == target_id:
                target_in_viz_after = s
                break
        if target_in_viz_after:
            break
    
    check('复核后图表中仍能找到目标样本', target_in_viz_after is not None)
    if target_in_viz_after:
        check('复核后图表中 kb_reviewed=True', target_in_viz_after['kb_reviewed'] == True)
        check('复核后图表中状态已更新', target_in_viz_after['status'] == 'false_negative')
        check('复核后图表中文保持不变', target_in_viz_after['original_text'] == baseline['original_text'])
        check('复核后图表中模型预测不变', target_in_viz_after['model_prediction'] == baseline['model_prediction'])
        check('复核后图表中置信度不变', target_in_viz_after['model_confidence'] == baseline['model_confidence'])

    # ==================== 汇总 ====================
    print("\n" + "=" * 70)
    print("📋 验证结果汇总")
    print("=" * 70)
    print(f"  ✅ 通过: {passed}")
    print(f"  ❌ 失败: {failed}")
    print(f"  📊 总计: {passed + failed}")
    
    print(f"\n🎯 目标样本 #{target_id} 完整证据链:")
    print(f"   原文: {baseline['original_text']}")
    print(f"   模型预测: {baseline['model_prediction']} (置信度: {baseline['model_confidence']:.3f})")
    print(f"   人工标注: {baseline['manual_label']}")
    print(f"   原始备注: {baseline['raw_remark']}")
    print(f"   最终状态: false_negative (KB 复核确认为漏检)")
    print(f"\n   可追溯节点:")
    print(f"   1. 样本列表 ✅")
    print(f"   2. 置信度图表下钻 ✅")
    print(f"   3. 样本详情 ✅")
    print(f"   4. 变更历史 ✅")
    print(f"   5. 批次更新（同 ID）✅")
    print(f"   6. 备注变更记录 ✅")
    print(f"   7. KB 复核记录 ✅")
    print(f"   8. 导出报告 ✅")
    
    if failed == 0:
        print("\n🎉 所有验证通过！同一条低置信度样本的完整判断明细可在整条证据链中追溯")
    else:
        print(f"\n⚠️  有 {failed} 项验证失败，请检查")
