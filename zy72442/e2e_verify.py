#!/usr/bin/env python3
"""
伴奏降噪返工记录 - 端到端验证脚本

覆盖流程：
1. 打开项目样例 → 2. 导入音频文件备注第一次导入 → 3. 补录授权 → 
4. 人工修正 → 5. 重跑 → 6. 导出报告

核对项：
- 请假课时数（当前值 vs 原始值 vs 各版本使用值）
- 待复核说明（reason_kept）
- 材料来源（missing_materials_source）
- 历史版本说明
- 报告/导出内容

验证目标：
  "为什么授权补录后是1节，而不是让2节只残留在旧说明里"
"""

import os
import sys
import sqlite3
from datetime import datetime

DB_PATH = 'accompaniment_rework_e2e_test.db'

def banner(msg):
    print()
    print("=" * 80)
    print("  " + msg)
    print("=" * 80)

def step_header(step, title):
    print()
    print("-" * 80)
    print(f"  步骤{step}: {title}")
    print("-" * 80)

def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    os.environ['TEST_DB'] = DB_PATH
    
    from app.database import init_db
    import app.services as services
    from config import ROLES
    
    init_db()
    
    banner("伴奏降噪返工记录 - 端到端一致性验证")
    print("目标：验证从导入→补授权→修正→重跑→导出全流程中")
    print("      '只有1节'、'重跑后曾检测到2节'、'请假课时被算进已消耗'")
    print("      与'还缺什么材料'完全对应，无残留误导性说明")
    
    all_pass = True
    test_results = []
    
    # ========== 步骤1：创建演示用户 ==========
    step_header("1", "创建演示用户")
    xu_id = services.create_user('xulaoshi_e2e', '许老师', ROLES['MUSIC_TEACHER'])
    tour_id = services.create_user('tour_e2e', '巡演统筹小王', ROLES['TOUR_COORDINATOR'])
    print(f"  ✅ 许老师 ID={xu_id}, 巡演统筹 ID={tour_id}")
    
    # ========== 步骤2：音频文件备注第一次导入（2节） ==========
    step_header("2", "音频文件备注第一次导入（请假2节）")
    note_id = services.import_audio_note(
        '夜曲_E2E验证版.wav',
        '/audio/test/夜曲_E2E.wav',
        4.5,
        True,
        2,
        '2024春季巡演伴奏，原始报表显示请假2节',
        xu_id,
        '原始材料：课时消耗报表#2024-E2E-001，显示请假2节'
    )
    note = services.get_audio_note(note_id)
    cl1 = services.get_checklist(note_id)
    
    print(f"  曲目ID: #{note_id}")
    print(f"  audio_notes.original_leave_hours_count: {note['original_leave_hours_count']}节")
    print(f"  audio_notes.leave_hours_count (初始): {note['leave_hours_count']}节")
    print(f"  track_checklists.v1.leave_hours_count_used: {cl1['leave_hours_count_used']}节")
    print(f"  reason_kept: {cl1['reason_kept'][:60]}...")
    
    # 验证步骤2
    t = "导入时：原始2节 = 当前2节 = v1使用2节"
    ok = (note['original_leave_hours_count'] == 2 and note['leave_hours_count'] == 2 
          and cl1['leave_hours_count_used'] == 2 and '2 节请假课时' in cl1['reason_kept'])
    print(f"  [{'✅' if ok else '❌'}] {t}")
    test_results.append((t, ok))
    all_pass &= ok
    
    # ========== 步骤3：补录授权（此时仍为2节） ==========
    step_header("3", "补录授权期限页（请假数据此时还未修正，为2节）")
    services.add_authorization_page(
        note_id,
        'AUTH-E2E-001',
        '2024-01-01',
        '2024-12-31',
        'E2E测试专项授权',
        xu_id,
        '原始材料：AUTH-E2E-001.pdf'
    )
    cl_after_auth = services.get_checklist(note_id)
    
    print(f"  补授权后 leave_hours_count_used: {cl_after_auth['leave_hours_count_used']}节")
    print(f"  reason_kept: {cl_after_auth['reason_kept'][:80]}...")
    print(f"  missing_materials_source: {cl_after_auth['missing_materials_source'][:60]}...")
    
    # 验证步骤3 - 此时还是2节
    t = "补授权后（未修正前）：v1使用2节，说明中含'2节'"
    ok = (cl_after_auth['leave_hours_count_used'] == 2 and 
          '2 节请假课时' in cl_after_auth['reason_kept'] and
          '当前值2' in cl_after_auth['missing_materials_source'])
    print(f"  [{'✅' if ok else '❌'}] {t}")
    test_results.append((t, ok))
    all_pass &= ok
    
    # ========== 步骤4：人工修正底层数据（2→1节） ==========
    step_header("4", "人工修正 - 修正底层请假课时数 2→1节")
    correction_reason = '核对考勤表发现2024年3月15日记录为系统重复统计，实际仅2024年4月2日1节有效'
    correction_material = '原始材料：考勤表#KQ-2024-0315、课时统计对比表#TJ-2024-SPRING'
    
    services.manual_correction(
        note_id,
        'leave_hours_count',
        '2',
        '1',
        correction_reason,
        xu_id,
        correction_material
    )
    note_after_corr = services.get_audio_note(note_id)
    cl_after_corr = services.get_checklist(note_id)
    hist = services.get_checklist_history(note_id)
    
    print(f"  audio_notes.original_leave_hours_count: {note_after_corr['original_leave_hours_count']}节")
    print(f"  audio_notes.leave_hours_count (修正后): {note_after_corr['leave_hours_count']}节")
    print(f"  audio_notes.leave_hours_correction_note: {note_after_corr['leave_hours_correction_note'][:60]}...")
    print()
    print(f"  修正后最新版本(版本#{hist[-1]['id']}):")
    print(f"    leave_hours_count_used: {hist[-1]['leave_hours_count_used']}节")
    print(f"    reason_kept: {hist[-1]['reason_kept'][:80]}...")
    print(f"    missing_materials_source: {hist[-1]['missing_materials_source'][:80]}...")
    if len(hist) > 1:
        print(f"  历史版本(版本#{hist[0]['id']}):")
        print(f"    leave_hours_count_used: {hist[0]['leave_hours_count_used']}节")
        print(f"    reason_kept: {hist[0]['reason_kept'][:80]}...")
    
    # 验证步骤4 - 关键！修正后所有版本的文字说明也要同步
    t = "修正后：原始2节永久保留，当前值=1节，最新版本使用=1节"
    ok = (note_after_corr['original_leave_hours_count'] == 2 and 
          note_after_corr['leave_hours_count'] == 1 and
          cl_after_corr['leave_hours_count_used'] == 1)
    print(f"\n  [{'✅' if ok else '❌'}] {t}")
    test_results.append((t, ok))
    all_pass &= ok
    
    t = "修正后：v1使用值也变为1节（历史版本文字同步更新）"
    ok = all(h['leave_hours_count_used'] == 1 for h in hist)
    print(f"  [{'✅' if ok else '❌'}] {t}")
    test_results.append((t, ok))
    all_pass &= ok
    
    # 关键检查：不能残留"仍有 2 节"、"当前值2节"等误导
    bad_patterns = ['仍有 2 节请假课时待复核', 'audio_notes表当前值2', '当前值2节', '使用请假课时数：2节（原始2节）。']
    found_bad = []
    for h in hist:
        for bp in bad_patterns:
            if bp in str(h['reason_kept']) or bp in str(h['missing_materials_source']):
                found_bad.append((h['id'], bp))
    t = "修正后：所有版本文字说明无'仍有2节/当前值2节'误导"
    ok = len(found_bad) == 0
    print(f"  [{'✅' if ok else '❌'}] {t}")
    if not ok:
        for vid, bp in found_bad:
            print(f"     ❌ 版本#{vid} 中发现: '{bp}'")
    test_results.append((t, ok))
    all_pass &= ok
    
    # 关键检查：必须包含"原始2节→修正后1节"对比说明
    t = "修正后：所有版本文字说明含'原始2节→修正后1节'对比"
    has_compare = all(('原始2节' in str(h['reason_kept']) or '原始值2节' in str(h['missing_materials_source']))
                      and ('1节' in str(h['reason_kept']) and h['leave_hours_count_used'] == 1)
                      for h in hist)
    ok = has_compare
    print(f"  [{'✅' if ok else '❌'}] {t}")
    test_results.append((t, ok))
    all_pass &= ok
    
    # ========== 步骤5：重跑流程 ==========
    step_header("5", "重跑流程 - 验证读取修正后1节，不再回退为2节")
    services.rerun_process(
        note_id,
        'E2E验证：修正后重跑，确认不回退为2节',
        xu_id,
        '依据：manual_correction已将leave_hours_count修正为1，原始2节保留'
    )
    note_final = services.get_audio_note(note_id)
    cl_final = services.get_checklist(note_id)
    hist_final = services.get_checklist_history(note_id)
    records = services.get_rework_records(note_id)
    
    print(f"  重跑后生成新版本#{hist_final[-1]['id']} (data_source={hist_final[-1]['data_source']})")
    print(f"  leave_hours_count_used: {hist_final[-1]['leave_hours_count_used']}节")
    print(f"  reason_kept: {hist_final[-1]['reason_kept'][:80]}...")
    print(f"  missing_materials_source: {hist_final[-1]['missing_materials_source'][:80]}...")
    print()
    print(f"  所有版本 leave_hours_count_used: " + 
          ", ".join(f"v{h['id']}={h['leave_hours_count_used']}节" for h in hist_final))
    
    # 验证步骤5
    t = "重跑后：新版本使用值=1节（不回退为2节）"
    ok = cl_final['leave_hours_count_used'] == 1
    print(f"\n  [{'✅' if ok else '❌'}] {t}")
    test_results.append((t, ok))
    all_pass &= ok
    
    t = "重跑后：所有版本使用值全为1节，口径一致"
    ok = all(h['leave_hours_count_used'] == 1 for h in hist_final)
    print(f"  [{'✅' if ok else '❌'}] {t}")
    test_results.append((t, ok))
    all_pass &= ok
    
    # ========== 步骤6：导出报告并验证 ==========
    step_header("6", "导出报告 - 验证报告中所有数据口径一致")
    report_txt = services.generate_report(note_id, fmt='text')
    report_json = services.generate_report(note_id, fmt='json')
    
    report_path = 'e2e_report_output.txt'
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report_txt)
    print(f"  文本报告已导出: {report_path}")
    
    # 验证报告关键内容
    checks_report = [
        ('报告含原始2节', '原始导入值: 2节' in report_txt),
        ('报告含当前1节', '当前使用值: 1节' in report_txt),
        ('报告标记已修正', '已人工修正: 2 → 1节' in report_txt),
        ('报告口径一致检查通过', '口径一致: 所有版本使用值 = 当前值 1节' in report_txt),
        ('报告含修正追溯路径', 'rework_records#' in report_txt and '2 → 1节' in report_txt),
        ('报告含还缺什么材料', '还缺什么材料:' in report_txt),
        ('报告含材料来源依据', '材料来源依据:' in report_txt),
    ]
    for t, ok in checks_report:
        print(f"  [{'✅' if ok else '❌'}] {t}")
        test_results.append((t, ok))
        all_pass &= ok
    
    # ========== 最终总结 ==========
    banner("端到端验证总结")
    print()
    print("核心问题验证：")
    print("  ❓ 为什么授权补录后是1节，而不是让2节残留在旧说明里？")
    print()
    print("  ✅ 步骤2导入：2节 → 步骤3补授权：2节 → 步骤4修正：2→1节同步更新所有版本文字 → 步骤5重跑：1节 → 步骤6导出：1节")
    print("  ✅ 关键：manual_correction不仅改数值，还同步更新reason_kept/missing_materials_source")
    print("  ✅ 所有版本 leave_hours_count_used = 1节，历史版本文字同步，无'2节待复核'残留")
    print("  ✅ '2节'仅作为'原始值/旧值'对比说明出现，不作为当前判断出现")
    print()
    print("  追溯链路（报告中可追回）:")
    for r in records:
        if r['field_changed']:
            print(f"    #{r['id']} {r['action_type']}: {r['field_changed']}={r['old_value']}→{r['new_value']} by {r['operator_name']}")
        else:
            print(f"    #{r['id']} {r['action_type']}: by {r['operator_name']}")
        print(f"      → {r['affected_results'][:60]}")
        print(f"      → 材料: {r['source_material'][:50]}")
    
    print()
    print("-" * 80)
    print("  详细测试结果:")
    print("-" * 80)
    for i, (t, ok) in enumerate(test_results, 1):
        print(f"  {i:2d}. [{'✅' if ok else '❌'}] {t}")
    
    print()
    if all_pass:
        print("🎉 全部 " + str(len(test_results)) + " 项测试通过！")
        print("   请假课时1节口径在导入、补授权、修正、重跑、导出全链路完全一致。")
        print("   可可靠用于给新人讲流程、给巡演统筹复核。")
    else:
        failed = [t for t, ok in test_results if not ok]
        print("⚠️  有 " + str(len(failed)) + " 项测试失败，请检查：")
        for f in failed:
            print("   - " + f)
    
    print()
    print("可继续体验:")
    print("  导出报告到文件: python3 cli.py export-report --audio-note-id " + str(note_id) + " -o demo_report.txt")
    print("  查看完整详情:   python3 cli.py show " + str(note_id))
    
    return 0 if all_pass else 1

if __name__ == '__main__':
    sys.exit(main())
