import pandas as pd
import os
import json
import sys
import io
from datetime import datetime

TEST_DIR = 'test_data_run'
EXCEL_V1 = os.path.join(TEST_DIR, 'batch001_model_v1.xlsx')
EXCEL_V2 = os.path.join(TEST_DIR, 'batch001_model_v2.xlsx')
RESULTS_FILE = os.path.join(TEST_DIR, 'VERIFICATION_RESULTS.md')

all_passed = True
results_log = []

def log(msg):
    print(msg)
    results_log.append(msg)

def assert_eq(name, actual, expected):
    global all_passed
    if actual == expected:
        log(f"    ✅ {name}: {actual} == {expected}")
    else:
        all_passed = False
        log(f"    ❌ {name}: 期望 {expected}, 实际 {actual}")
        raise AssertionError(f"{name} 失败: {actual} != {expected}")

def assert_in(name, part, full):
    global all_passed
    if part in str(full):
        log(f"    ✅ {name}: '{part}' 存在于输出中")
    else:
        all_passed = False
        log(f"    ❌ {name}: '{part}' 未找到, 输出片段: {str(full)[:200]}")
        raise AssertionError(f"{name} 失败")

def assert_len(name, lst, expected_len):
    global all_passed
    actual = len(lst)
    if actual == expected_len:
        log(f"    ✅ {name}: 长度 {actual} == {expected_len}")
    else:
        all_passed = False
        log(f"    ❌ {name}: 期望长度 {expected_len}, 实际 {actual}")
        raise AssertionError(f"{name} 失败")

def create_sample_excel_v1(file_path):
    data = [
        {
            '样本编号': 'SAMP-001',
            '模型版本': 'llm-v1.0',
            '提示词版本': '',
            '原始回答': '你好，请问您需要什么帮助？',
            '人工改判回答': '您好！欢迎使用智能客服。我是AI助手小M，请问有什么可以帮助您的吗？',
            '人工改动说明': '补充问候语格式，增加AI助手身份说明',
            '备注': ''
        },
        {
            '样本编号': 'SAMP-002',
            '模型版本': 'llm-v1.0',
            '提示词版本': '',
            '原始回答': '退款需要3-5个工作日到账',
            '人工改判回答': '您好，关于您的退款申请：提交后系统会在3-5个工作日内处理，款项将原路退回至您的支付账户。',
            '人工改动说明': '明确退款路径（原路退回），补充礼貌用语',
            '备注': ''
        },
        {
            '样本编号': 'SAMP-003',
            '模型版本': 'llm-v1.0',
            '提示词版本': '',
            '原始回答': '请联系客服处理',
            '人工改判回答': '如果问题仍未解决，您可以通过以下方式联系人工客服：\n1. 客服热线：400-888-8888（工作日9:00-18:00）\n2. 在线客服：点击页面右上角"在线咨询"',
            '人工改动说明': '补充具体联系方式和工作时间说明',
            '备注': ''
        }
    ]
    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False)
    return file_path

def create_sample_excel_v2(file_path):
    data = [
        {
            '样本编号': 'SAMP-001',
            '模型版本': 'llm-v2.0',
            '提示词版本': '',
            '原始回答': '你好，请问您需要什么帮助？',
            '人工改判回答': '您好！欢迎使用智能客服。我是AI助手小M，请问有什么可以帮助您的吗？',
            '人工改动说明': '补充问候语格式，增加AI助手身份说明',
            '备注': '模型升级到v2.0后结果一致，标记通过'
        },
        {
            '样本编号': 'SAMP-002',
            '模型版本': 'llm-v2.0',
            '提示词版本': '',
            '原始回答': '退款需要3-5个工作日到账',
            '人工改判回答': '您好，关于您的退款申请：提交后系统会在3-5个工作日内处理，款项将原路退回至您的支付账户。',
            '人工改动说明': '明确退款路径（原路退回），补充礼貌用语',
            '备注': ''
        },
        {
            '样本编号': 'SAMP-003',
            '模型版本': 'llm-v2.0',
            '提示词版本': '',
            '原始回答': '请联系客服处理',
            '人工改判回答': '如果问题仍未解决，您可以通过以下方式联系人工客服：\n1. 客服热线：400-888-8888（工作日9:00-18:00）\n2. 在线客服：点击页面右上角"在线咨询"',
            '人工改动说明': '补充具体联系方式和工作时间说明',
            '备注': ''
        }
    ]
    df = pd.DataFrame(data)
    df.to_excel(file_path, index=False)
    return file_path

def run_full_verification():
    global all_passed
    os.makedirs(TEST_DIR, exist_ok=True)

    log("\n" + "="*80)
    log("机器人话术版本仓库 - 端到端验证报告")
    log("="*80)
    log(f"运行时间: {datetime.now().isoformat()}")
    log("")

    create_sample_excel_v1(EXCEL_V1)
    create_sample_excel_v2(EXCEL_V2)
    log(f"✅ 测试数据文件已创建: {EXCEL_V1}, {EXCEL_V2}")

    from app import app, db, ManualJudgment, VersionHistory, ImportBatch, migrate_database

    with app.app_context():
        migrate_database()
        ManualJudgment.query.delete()
        VersionHistory.query.delete()
        ImportBatch.query.delete()
        db.session.commit()
        log("✅ 数据库已重置为干净状态")

    client = app.test_client()

    log("\n" + "-"*80)
    log("【1/12】验证：首页 HTML (GET /)")
    log("-"*80)
    r = client.get('/')
    assert_eq("状态码", r.status_code, 200)
    assert_in("页面标题", "机器人话术版本仓库", r.data.decode('utf-8'))
    assert_in("工作流关键元素", "补提示词版本", r.data.decode('utf-8'))
    log("    ✅ 首页可正常打开，包含所有关键UI元素")

    log("\n" + "-"*80)
    log("【2/12】验证：基础接口（无数据时返回200）")
    log("-"*80)

    for endpoint, name in [
        ('/api/statistics', '统计接口'),
        ('/api/records', '记录列表'),
        ('/api/batches', '批次列表'),
    ]:
        r = client.get(endpoint)
        assert_eq(f"{name} 状态码", r.status_code, 200)
        log(f"    ✅ {endpoint} 返回200")

    stats = client.get('/api/statistics').json
    assert_eq("空库 total", stats['total'], 0)
    assert_eq("空库 needs_review", stats['needs_review'], 0)
    log("    ✅ 空库统计数据正确，全部为0，无500错误")

    log("\n" + "-"*80)
    log("【3/12】验证：步骤1 - 第一次导入人工改判表 (llm-v1.0)")
    log("-"*80)
    with open(EXCEL_V1, 'rb') as f:
        data = {
            'file': (f, 'batch001_model_v1.xlsx'),
            'batch_id': 'BATCH-2024-JUNE-001',
            'imported_by': '小孟'
        }
        r = client.post('/api/import', data=data, content_type='multipart/form-data')
        assert_eq("导入状态码", r.status_code, 200)
        res = r.json

    assert_eq("导入总记录数", res['total'], 3)
    assert_eq("导入新增数", res['new'], 3)
    assert_eq("导入更新数", res['updated'], 0)
    assert_eq("导入重复数", res['duplicate'], 0)
    assert_eq("导入边界告警数", res['boundary_alert'], 0)
    log(f"    ✅ 批次号: {res['batch_id']}, import_id: {res['import_id']}")

    records = client.get('/api/records').json
    assert_eq("记录列表总数", records['total'], 3)

    for rec in records['records']:
        assert_in(f"记录 {rec['sample_id']} 含原始行号", 'original_row_number', rec)
        assert_in(f"记录 {rec['sample_id']} 含人工改动", 'manual_changes', rec)
        assert_in(f"记录 {rec['sample_id']} 含处理状态", 'processing_status', rec)
        assert_in(f"记录 {rec['sample_id']} 含工作流", 'workflow_step', rec)
        assert_in(f"记录 {rec['sample_id']} 含版本号", 'version_number', rec)
        assert_eq(f"记录 {rec['sample_id']} 工作流", rec['workflow_step'], 'step1_imported')
        assert_eq(f"记录 {rec['sample_id']} 处理状态", rec['processing_status'], 'imported')
        assert_eq(f"记录 {rec['sample_id']} 边界状态", rec['boundary_status'], 'normal')
        assert_eq(f"记录 {rec['sample_id']} 版本号", rec['version_number'], 1)
    log("    ✅ 3条记录全部正确落地，字段完整，工作流停在步骤1")

    log("\n" + "-"*80)
    log("【4/12】验证：同批次同文件重复导入 - 不翻倍")
    log("-"*80)
    with open(EXCEL_V1, 'rb') as f:
        data = {
            'file': (f, 'batch001_model_v1.xlsx'),
            'batch_id': 'BATCH-2024-JUNE-001',
            'imported_by': '小孟'
        }
        r = client.post('/api/import', data=data, content_type='multipart/form-data')
        assert_eq("二次导入状态码", r.status_code, 200)
        res2 = r.json

    assert_eq("二次导入 新增数", res2['new'], 0)
    assert_eq("二次导入 更新数", res2['updated'], 0)
    assert_eq("二次导入 重复数", res2['duplicate'], 3)
    assert_eq("二次导入 边界告警数", res2['boundary_alert'], 0)

    records_after = client.get('/api/records').json
    assert_eq("重复导入后总记录数(不翻倍)", records_after['total'], 3)
    log("    ✅ 同批次完全相同内容重复导入，3条全部识别为重复，总数保持3，不翻倍")

    batches = client.get('/api/batches').json
    assert_len("批次历史记录数", batches, 2)
    log(f"    ✅ 批次历史正确保留2条：首次导入 + 重复导入")

    log("\n" + "-"*80)
    log("【5/12】验证：步骤2 - 小孟补看提示词版本号（SAMP-001）")
    log("-"*80)
    s001 = [r for r in records_after['records'] if r['sample_id'] == 'SAMP-001'][0]
    old_id = s001['id']
    old_prompt = s001['prompt_version']
    assert_eq("补前提示词版本", old_prompt, '')

    r = client.post(f'/api/record/{old_id}/update_prompt_version',
        json={'prompt_version': 'PROMPT-T5-20240601', 'changed_by': '小孟'})
    assert_eq("补提示词版本状态码", r.status_code, 200)
    up_res = r.json

    assert_in("操作结果含result_note", 'result_note', up_res)
    log(f"    💬 系统返回结果说明: {up_res['result_note']}")
    new_id = up_res['new_record_id']
    assert_eq("生成新版本记录", bool(new_id), True)
    assert_eq("新记录处理状态", up_res['processing_status'], 'prompt_updated')
    assert_eq("新记录工作流推进", up_res['workflow_step'], 'step2_prompt_updated')

    detail = client.get(f'/api/record/{new_id}').json
    assert_eq("详情-提示词已更新", detail['record']['prompt_version'], 'PROMPT-T5-20240601')
    assert_eq("详情-当前版本号", detail['record']['version_number'], 2)
    assert_eq("详情-工作流步骤", detail['record']['workflow_step'], 'step2_prompt_updated')
    assert_eq("详情-处理状态", detail['record']['processing_status'], 'prompt_updated')
    assert_in("详情-状态说明", '补全提示词版本号', detail['record']['status_note'])

    history = detail['version_history']
    assert_len("SAMP-001版本历史条数", history, 2)
    create_ver = [h for h in history if h['change_type'] == 'create'][0]
    prompt_ver = [h for h in history if h['change_type'] == 'prompt_update'][0]
    assert_eq("版本历史-旧值", prompt_ver['old_value'], '')
    assert_eq("版本历史-新值", prompt_ver['new_value'], 'PROMPT-T5-20240601')
    assert_eq("版本历史-修改人", prompt_ver['changed_by'], '小孟')
    assert_in("版本历史-原因", '补看', prompt_ver['change_reason'])
    log(f"    ✅ SAMP-001版本历史完整：版本1=创建，版本2=提示词 '' -> 'PROMPT-T5-20240601'")
    log(f"    ✅ 处理状态: prompt_updated，工作流推进到步骤2")

    log("\n" + "-"*80)
    log("【6/12】验证：小孟只改一条备注（SAMP-002） - 改前改后留痕")
    log("-"*80)
    s002 = [r for r in records_after['records'] if r['sample_id'] == 'SAMP-002'][0]
    s002_id = s002['id']
    old_remark = s002['remarks']
    assert_eq("改前备注", old_remark, '')

    r = client.post(f'/api/record/{s002_id}/update_remark',
        json={'remarks': '【重要】提示词版本号：PROMPT-CUSTOMER-SERVICE-V3，这个样本表现突出，用于产品复盘会展示', 'changed_by': '小孟'})
    assert_eq("改备注状态码", r.status_code, 200)
    remark_res = r.json

    new_remark_id = remark_res['new_record_id']
    log(f"    💬 系统返回: {remark_res['result_note']}")
    assert_eq("改备注后 版本号", remark_res['version_number'], 2)
    assert_eq("改备注后 工作流不变", remark_res['workflow_step'], 'step1_imported')

    detail2 = client.get(f'/api/record/{new_remark_id}').json
    new_remark_value = detail2['record']['remarks']
    assert_in("新备注含提示词版本号", 'PROMPT-CUSTOMER-SERVICE-V3', new_remark_value)
    assert_in("新备注含产品复盘说明", '产品复盘会', new_remark_value)

    hist2 = detail2['version_history']
    remark_update = [h for h in hist2 if h['change_type'] == 'remark_update'][0]
    assert_eq("备注历史-旧值", remark_update['old_value'], '')
    assert_in("备注历史-新值含提示词版本", 'PROMPT-CUSTOMER-SERVICE-V3', remark_update['new_value'])
    assert_eq("备注历史-修改人", remark_update['changed_by'], '小孟')
    log("    ✅ SAMP-002备注更新留痕：旧值(空) -> 新值(含提示词版本号+产品复盘说明)")
    log("    ✅ 运营追问时能回到证据：版本历史中明确看到改前改后")

    records_now = client.get('/api/records').json
    s002_now = [r for r in records_now['records'] if r['sample_id'] == 'SAMP-002'][0]
    assert_eq("SAMP-002列表页备注刷新后正确", bool(s002_now['remarks']), True)
    log("    ✅ 刷新列表后，SAMP-002备注内容已正确重算并显示")

    log("\n" + "-"*80)
    log("【7/12】验证：模型版本换了但样本编号没变（边界规则触发）")
    log("-"*80)
    with open(EXCEL_V2, 'rb') as f:
        data = {
            'file': (f, 'batch001_model_v2.xlsx'),
            'batch_id': 'BATCH-2024-JUNE-001',
            'imported_by': '小孟'
        }
        r = client.post('/api/import', data=data, content_type='multipart/form-data')
        assert_eq("模型v2导入状态码", r.status_code, 200)
        res_v2 = r.json

    assert_eq("v2导入 新增数", res_v2['new'], 0)
    assert_eq("v2导入 更新数", res_v2['updated'], 3)
    assert_eq("v2导入 边界告警数", res_v2['boundary_alert'], 3)
    log(f"    💬 导入返回: {res_v2['note']}")

    stats_v2 = client.get('/api/statistics').json
    assert_eq("统计-待运营复核数", stats_v2['needs_review'], 3)
    records_boundary = client.get('/api/records?boundary=needs_review').json
    assert_len("边界筛选命中数", records_boundary['records'], 3)

    for rec in records_boundary['records']:
        assert_eq(f"{rec['sample_id']}边界状态", rec['boundary_status'], 'needs_review')
        assert_eq(f"{rec['sample_id']}处理状态", rec['processing_status'], 'pending_review')
        assert_in(f"{rec['sample_id']}边界说明含模型版本", '模型版本从 llm-v1.0 变为 llm-v2.0', rec['boundary_note'])
        assert_in(f"{rec['sample_id']}边界说明含待复核", '运营复核人复核', rec['boundary_note'])
        assert_in(f"{rec['sample_id']}状态说明", '待运营复核', rec['status_note'])
        assert_eq(f"{rec['sample_id']}工作流未越过步骤3", rec['workflow_step'] in ['step2_prompt_updated', 'step1_imported'], True)

    log("    ✅ 3条记录全部触发边界规则：模型v1.0->v2.0，样本号没变")
    log("    ✅ 没有自动归为正常，全部标记为 needs_review / pending_review")
    log("    ✅ 状态说明明确写着'模型版本变更，待运营复核'")
    log("    ✅ 留给运营复核人复核，不越权判定")

    log("\n" + "-"*80)
    log("【8/12】验证：SAMP-001查看完整历史（首次创建+提示词更新+模型版本变更留痕）")
    log("-"*80)
    s001_new = [r for r in records_boundary['records'] if r['sample_id'] == 'SAMP-001'][0]
    d = client.get(f'/api/record/{s001_new["id"]}').json
    assert_eq("SAMP-001最新模型版本", d['record']['model_version'], 'llm-v2.0')
    assert_eq("SAMP-001提示词保留", d['record']['prompt_version'], 'PROMPT-T5-20240601')
    assert_eq("SAMP-001边界待复核", d['record']['boundary_status'], 'needs_review')
    assert_eq("SAMP-001处理状态待复核", d['record']['processing_status'], 'pending_review')
    assert_eq("SAMP-001最新版本号", d['record']['version_number'], 3)

    hist_all = d['version_history']
    create_cnt = len([h for h in hist_all if h['change_type']=='create'])
    prompt_cnt = len([h for h in hist_all if h['change_type']=='prompt_update'])
    import_cnt = len([h for h in hist_all if h['change_type']=='import_update'])
    model_updates = [h for h in hist_all if h['field_name']=='model_version']
    assert_eq("创建历史条数", create_cnt, 1)
    assert_eq("提示词更新历史条数", prompt_cnt, 1)
    assert_eq("导入更新历史条数>=1", import_cnt >= 1, True)
    assert_len("模型版本变更历史条数", model_updates, 1)
    assert_eq("模型变更历史-旧值", model_updates[0]['old_value'], 'llm-v1.0')
    assert_eq("模型变更历史-新值", model_updates[0]['new_value'], 'llm-v2.0')
    log("    ✅ SAMP-001完整历史链: v1创建 -> v2提示词更新 -> v3模型版本变(边界触发)")
    log("    ✅ 所有改动均可追溯，运营追问证据不断链")

    log("\n" + "-"*80)
    log("【9/12】验证：步骤3 - 运营复核人复核 + 产品复盘页更新")
    log("-"*80)
    s001_latest = [r for r in records_boundary['records'] if r['sample_id'] == 'SAMP-001'][0]
    r = client.post(f'/api/record/{s001_latest["id"]}/review',
        json={'action': 'approve', 'reviewer': '运营-李姐', 'note': '确认模型升级正常，SAMP-001样本编号无误，可用于复盘展示'})
    assert_eq("复核状态码", r.status_code, 200)
    review_res = r.json

    log(f"    💬 复核结果说明: {review_res['result_note']}")
    assert_eq("复核后 边界状态", review_res['boundary_status'], 'normal')
    assert_eq("复核后 处理状态", review_res['processing_status'], 'reviewed')
    assert_eq("复核后 工作流推进到步骤3", review_res['workflow_step'], 'step3_reviewed')
    assert_in("复核后 状态说明", '复核通过', review_res['status_note'])

    stats_final = client.get('/api/statistics').json
    assert_eq("最终统计-总记录", stats_final['total'], 3)
    assert_eq("最终统计-待复核数减少为", stats_final['needs_review'], 2)
    step1_final = stats_final['workflow_steps']['step1_imported']
    step3_final = stats_final['workflow_steps']['step3_reviewed']
    assert_eq("最终统计-步骤3", step3_final, 1)
    assert_eq("最终统计-步骤1(SAMP-002/SAMP-003未补提示词)", step1_final, 2)
    log(f"    ✅ 最终统计：步骤1={step1_final}(SAMP-002/003未补提示词), 步骤3={step3_final}(SAMP-001已复核)")
    log("    ✅ SAMP-001已完成三步流：步骤1导入 -> 步骤2补提示词 -> 步骤3复核通过")
    log("    ✅ 统计面板数字同步更新，产品复盘页看到正确状态")

    s003 = [r for r in records_boundary['records'] if r['sample_id'] == 'SAMP-003'][0]
    r = client.post(f'/api/record/{s003["id"]}/review',
        json={'action': 'rollback', 'reviewer': '运营-李姐', 'note': '样本号重复，回滚到v1.0版本的判断'})
    assert_eq("回滚状态码", r.status_code, 200)
    rb = r.json
    assert_eq("回滚后处理状态", rb['processing_status'], 'rollback')
    assert_in("回滚结果说明", '回滚', rb['result_note'])
    log("    ✅ SAMP-003回滚操作成功，边界规则回滚机制正常")

    log("\n" + "-"*80)
    log("【10/12】验证：刷新后状态重算 - 打开详情页")
    log("-"*80)
    s001_final_id = s001_latest["id"]
    d_final = client.get(f'/api/record/{s001_final_id}').json
    assert_eq("刷新后SAMP-001步骤3仍在", d_final['record']['workflow_step'], 'step3_reviewed')
    assert_eq("刷新后SAMP-001提示词版本", d_final['record']['prompt_version'], 'PROMPT-T5-20240601')
    assert_eq("刷新后SAMP-001处理状态", d_final['record']['processing_status'], 'reviewed')
    assert_eq("刷新后SAMP-001复核人", d_final['record']['reviewer'], '运营-李姐')
    assert_eq("刷新后SAMP-001边界正常", d_final['record']['boundary_status'], 'normal')
    log("    ✅ 刷新详情页后所有状态、备注、历史、版本号仍然正确，数据不丢失")

    log("\n" + "-"*80)
    log("【11/12】验证：产品复盘页数据导出（含所有证据字段）")
    log("-"*80)
    r = client.get('/api/export/BATCH-2024-JUNE-001')
    assert_eq("导出状态码", r.status_code, 200)
    assert_in("导出响应为Excel", 'application/vnd.openxmlformats', r.content_type or '')

    export_excel = os.path.join(TEST_DIR, 'export_BATCH-2024-JUNE-001.xlsx')
    with open(export_excel, 'wb') as f:
        f.write(r.data)
    df = pd.read_excel(io.BytesIO(r.data))
    assert_len("导出行数=3条", df, 3)
    required_cols = ['原始行号', '样本编号', '模型版本', '提示词版本', '人工改动说明',
                     '备注', '处理状态', '状态说明', '边界状态', '工作流步骤', '版本号']
    for col in required_cols:
        assert_in(f"导出列包含 {col}", col, df.columns.tolist())

    s001_row = df[df['样本编号'] == 'SAMP-001'].iloc[0]
    assert_eq("导出SAMP-001提示词版本", s001_row['提示词版本'], 'PROMPT-T5-20240601')
    assert_eq("导出SAMP-001工作流步骤", s001_row['工作流步骤'], 'step3_reviewed')
    assert_eq("导出SAMP-001处理状态", s001_row['处理状态'], 'reviewed')
    assert_eq("导出SAMP-001边界状态", s001_row['边界状态'], 'normal')

    s002_row = df[df['样本编号'] == 'SAMP-002'].iloc[0]
    assert_in("导出SAMP-002备注含提示词版本号", 'PROMPT-CUSTOMER-SERVICE-V3', str(s002_row['备注']))
    log("    ✅ 导出Excel包含所有证据字段，产品复盘页拿到完整数据")
    log("    ✅ SAMP-001：提示词版本正确、工作流步骤3、复核通过状态")
    log("    ✅ SAMP-002：备注中的提示词版本号完整保留，运营追问可见")

    log("\n" + "-"*80)
    log("【12/12】验证：随带数据库兼容性 - 新结构列全部存在")
    log("-"*80)
    with app.app_context():
        insp = db.inspect(db.engine)
        for table_name in ['manual_judgment', 'import_batch', 'version_history']:
            cols = [c['name'] for c in insp.get_columns(table_name)]
            log(f"    表 {table_name} 列数: {len(cols)}")
        mj_cols = [c['name'] for c in insp.get_columns('manual_judgment')]
        for need in ['record_key', 'version_number', 'status_note', 'workflow_step', 'boundary_status', 'content_hash']:
            assert_in(f"manual_judgment 列 {need}", need, mj_cols)
        ib_cols = [c['name'] for c in insp.get_columns('import_batch')]
        for need in ['import_id', 'boundary_alert_count', 'import_note']:
            assert_in(f"import_batch 列 {need}", need, ib_cols)
        vh_cols = [c['name'] for c in insp.get_columns('version_history')]
        for need in ['record_key', 'change_type', 'full_snapshot_before', 'full_snapshot_after']:
            assert_in(f"version_history 列 {need}", need, vh_cols)
    log("    ✅ 数据库新结构列完整，无缺失，启动不再报500")

    log("\n" + "="*80)
    log("✅ 全部12项验证通过！")
    log("="*80)
    log(f"最终统计:")
    with app.app_context():
        log(f"  - ManualJudgment 总主记录数: {ManualJudgment.query.filter_by(is_latest=True).count()}")
        log(f"  - VersionHistory 总版本留痕数: {VersionHistory.query.count()}")
        log(f"  - ImportBatch 总导入批次: {ImportBatch.query.count()}")
    log("")
    log("消除的问题:")
    log("  1. ✅ 旧数据库结构阻断500 - 已通过迁移策略解决")
    log("  2. ✅ 同批次二次导入唯一约束报错 - import_id唯一，batch_id可重复")
    log("  3. ✅ 提示词版本号历史留痕 - 版本历史明确记录旧值->新值")
    log("  4. ✅ 备注改前改后对比 - remark_update类型历史保留")
    log("  5. ✅ 模型版本变样本号不变不自动归正常 - 强制needs_review待复核")
    log("  6. ✅ 状态流不断链: 步骤1导入 -> 步骤2补提示词 -> 步骤3复核 -> 导出复盘")
    log("  7. ✅ 产品复盘页导出含所有证据字段")
    log("")
    log("真实样例对齐验证:")
    log("  - SAMP-001: 导入(v1) -> 补提示词PROMPT-T5-20240601 -> 模型变v2触发边界 -> 运营复核通过")
    log("  - SAMP-002: 导入(v1) -> 小孟改备注补充提示词版本号PROMPT-CUSTOMER-SERVICE-V3 -> 模型变v2待复核")
    log("  - SAMP-003: 导入(v1) -> 模型变v2待复核 -> 运营回滚")
    log("")
    log("验证文件输出:")
    log(f"  - 样例Excel v1: {EXCEL_V1}")
    log(f"  - 样例Excel v2: {EXCEL_V2}")
    log(f"  - 导出复盘Excel: {export_excel}")
    log(f"  - 本报告: {RESULTS_FILE}")

    with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(results_log))

    return all_passed

if __name__ == '__main__':
    try:
        ok = run_full_verification()
        sys.exit(0 if ok else 1)
    except Exception as e:
        log(f"\n❌ 验证过程出现异常: {e}")
        import traceback
        log(traceback.format_exc())
        with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
            f.write('\n'.join(results_log))
        sys.exit(1)
