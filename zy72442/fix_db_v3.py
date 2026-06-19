#!/usr/bin/env python3
import sqlite3

conn = sqlite3.connect('accompaniment_rework.db')
c = conn.cursor()

c.execute('SELECT authorization_number, valid_from, valid_to FROM authorization_pages WHERE audio_note_id=1 ORDER BY id DESC LIMIT 1')
auth = c.fetchone()
auth_num, vf, vt = auth[0], auth[1], auth[2]
c.execute('SELECT leave_hours_correction_note FROM audio_notes WHERE id=1')
cnote = c.fetchone()[0]

print("=== 版本#1 修复（补授权后版本）===")
rk1 = '授权期限页已补充（授权号：' + auth_num + '，有效期：' + vf + ' 至 ' + vt + '），请假课时原始2节，经人工修正后为1节，修正原因：' + cnote + '，需巡演统筹最终确认'
mm1 = '请假课时消耗原始明细报表、人工修正说明文件（考勤表原件、差异对比表）、巡演统筹复核确认单'
mms1 = '依据：授权文件编号' + auth_num + '已补，请假课时数据已人工修正：audio_notes表当前值1节，原始值2节（旧值2节），差异来自rework_records表id=4的人工修正记录，需复核材料支撑修正依据'
na1 = '最终复核：请假课时原始2节→旧值2节→修正后1节，核对修正原因和支撑材料，确认后标记完成'
c.execute('UPDATE track_checklists SET reason_kept=?, missing_materials=?, missing_materials_source=?, next_action=? WHERE id=1', (rk1, mm1, mms1, na1))
print("  reason_kept: " + rk1[:80] + "...")
print("  missing_materials: " + mm1[:80])
print("  missing_materials_source: " + mms1[:80] + "...")
print("  next_action: " + na1[:80])

print("\n=== 版本#3 修复（重跑后版本）===")
rk3 = '重跑后检测到 1 节请假课时（原始2节→旧值2节→修正后1节，修正原因：' + cnote + '），授权已补，最终待巡演统筹复核'
mms3 = '依据：重跑时读取audio_notes表当前值1节，原始值2节（重跑前曾显示2节），差异追溯路径：import(id=1导入2节)→add_auth(id=3补授权)→manual_correction(id=4修正2→1节)→rerun(id=5重跑用1节)，需复核支撑修正的原始材料'
c.execute('UPDATE track_checklists SET reason_kept=?, missing_materials_source=? WHERE id=3', (rk3, mms3))
print("  reason_kept: " + rk3[:80] + "...")
print("  missing_materials_source: " + mms3[:80] + "...")

print("\n=== 返工记录#3 修复（add_auth历史说明）===")
ar3 = '状态从「请假课时异常」更新为「待巡演统筹复核」，曲目核对表同步更新，当时使用请假课时数：2节（原始2节）。注意：此记录后经rework_records#4人工修正为1节，所有版本现统一使用1节'
c.execute('UPDATE rework_records SET affected_results=? WHERE id=3', (ar3,))
print("  affected_results: " + ar3[:80] + "...")

conn.commit()

print("\n=== 验证修复结果 ===")
c.execute('SELECT id, leave_hours_count_used, reason_kept, missing_materials_source FROM track_checklists WHERE audio_note_id=1 ORDER BY id')
all_ok = True
for r in c.fetchall():
    cid, used, rk, mms = r
    bad = False
    # 检查是否有误导性描述：使用1节但说"当前值2节"或"有2节待复核"
    bad_patterns = [
        '仍有 2 节请假课时待复核',
        'audio_notes表当前值2',
        '当前值2节',
    ]
    for bp in bad_patterns:
        if bp in str(rk) or bp in str(mms):
            print("  ❌ 版本#%d: 发现误导性描述 '%s'" % (cid, bp))
            bad = True
            all_ok = False
    # 检查是否有正确的对比说明
    has_good = '原始2节' in str(rk) or '原始值2节' in str(mms) or '旧值2节' in str(rk) or '修正后1节' in str(rk)
    if not bad:
        if has_good:
            print("  ✅ 版本#%d: 使用%d节，口径正确，含'原始2节→修正后1节'对比说明" % (cid, used))
        else:
            print("  ⚠️  版本#%d: 使用%d节，但缺少对比说明" % (cid, used))

c.execute('SELECT id, action_type, affected_results FROM rework_records WHERE audio_note_id=1 ORDER BY id')
print("\n返工记录affected_results验证:")
for r in c.fetchall():
    rid, atype, ar = r
    print("  [#%d] %s: %s" % (rid, atype, str(ar)[:70]))

if all_ok:
    print("\n🎉 全部验证通过！历史残留2节说明已清理完毕，所有版本口径一致为1节")
else:
    print("\n⚠️  仍有问题需要修复")

conn.close()
