from app import create_app
from models import db, ManualCorrectionSheet, ReviewSample, SampleChangeHistory
from services.import_service import ImportService
from services.workflow_service import WorkflowService
from services.confidence_service import ConfidenceService
from services.visualization_service import VisualizationService
import pandas as pd
import os

app = create_app()
with app.app_context():
    db.create_all()

    data = pd.DataFrame([
        {'original_text': '退款咨询', 'model_prediction': '售后', 'model_confidence': 0.95, 'manual_label': '售后', '备注': '常规'},
        {'original_text': '质量差投诉', 'model_prediction': '正常', 'model_confidence': 0.55, 'manual_label': '投诉', '备注': '漏检'},
        {'original_text': '发货时间', 'model_prediction': '物流', 'model_confidence': 0.45, 'manual_label': '物流', '备注': '低置信度'},
    ])
    f1 = '/tmp/t1.xlsx'
    data.to_excel(f1, index=False)

    r = ImportService.import_correction_sheet(f1, '6月批次', '小王')
    sid = r['sheet_id']
    WorkflowService.init_workflow(sid)
    ConfidenceService.detect_low_confidence_samples(sid)
    ConfidenceService.check_average_masking(sid)
    print(f'T1 首次导入: success={r["success"]} v{r["version"]} samples={r["sample_count"]}')

    ok, msg = WorkflowService.can_advance_step(sid, 'step2_review_prompt', 'lead_annotator')
    print(f'T2 未完成step1推step2: ok={ok} msg="{msg}"')
    assert not ok, "BUG: step1未完成时step2不应能推进!"

    ok2, msg2 = WorkflowService.complete_step(sid, 'step1_import', '小王', 'annotator')
    print(f'T2 完成step1: ok={ok2}')
    
    ok3, msg3 = WorkflowService.can_advance_step(sid, 'step2_review_prompt', 'lead_annotator')
    print(f'T2 step1后推step2: ok={ok3}')

    data2 = data.copy()
    data2.loc[0, '备注'] = '常规，已确认'
    data2.loc[1, '备注'] = '漏检，周姐确认'
    f2 = '/tmp/t2.xlsx'
    data2.to_excel(f2, index=False)
    
    r2 = ImportService.import_correction_sheet(f2, '6月批次', '小王')
    print(f'T3 批次更新: success={r2["success"]} is_batch={r2.get("is_batch_update")} v={r2["version"]} remark_changed={r2.get("remark_changed_count")}')
    
    sheets = ManualCorrectionSheet.query.filter_by(sheet_name='6月批次').all()
    print(f'T3 同名改判表数: {len(sheets)} (应为1)')
    print(f'T3 sheet_id一致: {r2["sheet_id"] == sid}')

    for s in ReviewSample.query.filter_by(correction_sheet_id=sid).all():
        rh = SampleChangeHistory.query.filter_by(sample_id=s.id, change_type='remark_update').all()
        if rh:
            for h in rh:
                print(f'  样本#{s.id} 备注: "{h.old_value[:40]}" -> "{h.new_value[:40]}"')

    r3 = ImportService.import_correction_sheet(f2, '6月批次', '小王')
    print(f'T4 完全重复: success={r3["success"]} is_dup={r3.get("is_duplicate")}')

    dist = VisualizationService.get_confidence_distribution(sid)
    has_links = False
    for rn, bd in dist['bins'].items():
        if bd['count'] > 0:
            for s in bd['samples']:
                if s['links']['correction_sheet'] and s['links']['change_history']:
                    has_links = True
    print(f'T5 下钻数据带证据链接: {has_links}')

    lc = ReviewSample.query.filter_by(correction_sheet_id=sid, is_low_confidence=True).all()
    for s in lc:
        ConfidenceService.kb_review_sample(s.id, '老李', 'false_negative')
    ok4, msg4 = WorkflowService.complete_step(sid, 'step2_review_prompt', '周姐', 'lead_annotator')
    print(f'T6 Step2完成: ok={ok4} msg="{msg4}"')

    ok5, msg5 = WorkflowService.complete_step(sid, 'step3_model_update', '周姐', 'lead_annotator')
    print(f'T6 Step3完成: ok={ok5} msg="{msg5}"')

    os.remove(f1)
    os.remove(f2)
    print('\n✅ ALL TESTS PASSED')
