import os
import sys
import json
import csv

import config
from models import (
    init_db, Pet, WeightSchedule, MedicalRecord, Reconciliation,
    ExportBatch, ManualNote, FilterState,
)
from reconcile_engine import (
    run_reconciliation, export_csv, save_manual_note,
    save_filter_state, load_filter_state, match_pet_name, parse_weight,
    generate_batch_no,
)


def assert_true(cond, msg):
    if not cond:
        print(f"  ❌ 失败: {msg}")
        return False
    print(f"  ✅ 通过: {msg}")
    return True


def reset_db():
    for path in [config.DB_PATH, config.SESSION_DB_PATH]:
        if os.path.exists(path):
            os.remove(path)
    import import_samples
    session = init_db()
    import_samples.import_pets(session, os.path.join(config.SAMPLE_DIR, "宠物基础信息.csv"))
    import_samples.import_schedules(session, os.path.join(config.SAMPLE_DIR, "减重排程表.csv"))
    import_samples.import_medical_records(session, os.path.join(config.SAMPLE_DIR, "病历手写单_20260608.csv"))
    session.close()


def test_name_matching(session):
    print("\n[测试1] 宠物名匹配（含别名、模糊、未匹配分支）")
    ok = True

    pet, status, _ = match_pet_name("橘胖", session)
    ok &= assert_true(pet is not None and pet.name == "大橘" and status == "别名匹配",
                      "别名匹配：橘胖 -> 大橘")

    pet, status, _ = match_pet_name("黑猫", session)
    ok &= assert_true(pet is not None and pet.name == "小黑" and status == "别名匹配",
                      "别名匹配：黑猫 -> 小黑")

    pet, status, _ = match_pet_name("阿旺", session)
    ok &= assert_true(pet is not None and pet.name == "旺财" and status == "别名匹配",
                      "别名匹配：阿旺 -> 旺财")

    pet, status, _ = match_pet_name("小布", session)
    ok &= assert_true(pet is not None and pet.name == "布丁" and status == "别名匹配",
                      "别名匹配：小布 -> 布丁")

    pet, status, _ = match_pet_name("肥波", session)
    ok &= assert_true(pet is None and status == "未匹配",
                      "叫法对不上：肥波 -> 未匹配（异常分支走通）")

    pet, status, _ = match_pet_name("大橘猫", session)
    ok &= assert_true(pet is not None and pet.name == "大橘" and status == "别名匹配",
                      "别名匹配：大橘猫 -> 大橘")

    return ok


def test_weight_parsing():
    print("\n[测试2] 体重单位混写识别")
    ok = True

    v, u, s, _ = parse_weight("8200g")
    ok &= assert_true(v == 8200 and u == "g" and s == "标准",
                      f"标准单位: 8200g -> v={v} u={u} s={s}")

    v, u, s, _ = parse_weight("5.8千克")
    ok &= assert_true(v == 5.8 and u == "千克" and s == "标准",
                      f"标准单位: 5.8千克 -> v={v} u={u} s={s}")

    v, u, s, _ = parse_weight("14.5kg/29斤")
    ok &= assert_true(v == 14.5 and u == "kg" and s == "混写(已转换)",
                      f"单位混写: 14.5kg/29斤 -> v={v} u={u} s={s}（异常分支走通）")

    v, u, s, _ = parse_weight("5300")
    ok &= assert_true(v == 5300 and u == "kg" and s == "无单位(默认kg)",
                      f"无单位: 5300 -> 默认kg")

    v, u, s, _ = parse_weight("27.2 千克")
    ok &= assert_true(v == 27.2 and u == "千克" and s == "标准",
                      f"带空格: 27.2 千克 -> v={v}")

    v, u, s, _ = parse_weight("9.5斤")
    ok &= assert_true(v == 9.5 and u == "斤" and s == "标准",
                      f"非标准单位但单一: 9.5斤")

    v, u, s, _ = parse_weight("16.5磅")
    ok &= assert_true(v == 16.5 and u == "磅" and s == "标准",
                      f"英制单位: 16.5磅")

    return ok


def test_reconciliation_main(session):
    print("\n[测试3] 主对账流程（首轮处理）")
    ok = True

    batch_no, results, _ = run_reconciliation(session, process_round=1)
    ok &= assert_true(batch_no.startswith("RCN"), f"批次号生成: {batch_no}")
    ok &= assert_true(len(results) == 8, f"生成8条对账记录: 实际{len(results)}")

    recs = session.query(Reconciliation).filter(Reconciliation.batch_no == batch_no).all()

    feibo = [r for r in recs if r.handwritten_name == "肥波"]
    ok &= assert_true(len(feibo) == 1, "找到旧记录'肥波'")
    if feibo:
        r = feibo[0]
        ok &= assert_true(r.name_match_status == "未匹配",
                          f"肥波名称状态=未匹配（异常分支）: 实际={r.name_match_status}")
        ok &= assert_true(r.review_status == "需复核",
                          f"肥波复核状态=需复核: 实际={r.review_status}")
        ok &= assert_true(r.review_reason and "叫法对不上" not in r.review_reason and "名称无法匹配" in r.review_reason,
                          f"肥波复核原因含名称无法匹配: {r.review_reason[:50]}")

    awang = [r for r in recs if r.handwritten_name == "阿旺"]
    ok &= assert_true(len(awang) == 1, "找到'阿旺'（旺财别名）")
    if awang:
        r = awang[0]
        ok &= assert_true(r.name_match_status == "别名匹配" and r.pet_name == "旺财",
                          f"阿旺别名匹配到旺财: 状态={r.name_match_status}, 名称={r.pet_name}")
        ok &= assert_true(r.weight_unit_status == "混写(已转换)",
                          f"阿旺体重单位混写识别: {r.weight_unit_status}")
        ok &= assert_true(r.review_status == "需复核",
                          f"阿旺因单位混写需复核: {r.review_status}")
        ok &= assert_true(r.review_reason and "体重单位混写" in r.review_reason,
                          f"阿旺复核原因含单位混写: {r.review_reason[:60]}")
        ok &= assert_true(abs(r.standard_weight_kg - 14.5) < 0.001,
                          f"阿旺标准体重14.5kg: 实际={r.standard_weight_kg}")

    daju = [r for r in recs if r.handwritten_name == "橘胖"]
    ok &= assert_true(len(daju) == 1, "找到'橘胖'（大橘别名）")
    if daju:
        r = daju[0]
        ok &= assert_true(r.name_match_status == "别名匹配" and r.pet_name == "大橘",
                          "橘胖别名匹配到大橘")
        ok &= assert_true(abs(r.standard_weight_kg - 8.2) < 0.001,
                          f"8200g换算为8.2kg: 实际={r.standard_weight_kg}")
        ok &= assert_true(r.review_status == "正常",
                          f"橘胖状态正常: 实际={r.review_status}")

    feibo_mr = session.query(MedicalRecord).filter(MedicalRecord.handwritten_name == "肥波").first()
    ok &= assert_true(feibo_mr is not None and feibo_mr.needs_review is True,
                      "病历单层肥波也被标记需复核")

    return batch_no, ok


def test_round_trip_and_notes(session, batch_no):
    print("\n[测试4] 重跑流程 - 区分旧处理、后补备注、最新导出")
    ok = True

    first_round = session.query(Reconciliation).filter(
        Reconciliation.batch_no == batch_no, Reconciliation.process_round == 1
    ).all()
    ok &= assert_true(len(first_round) == 8, "首轮8条记录存在")

    feibo = next(r for r in first_round if r.handwritten_name == "肥波")
    note = save_manual_note(session, feibo.id, "已确认为大橘（旧名肥波），体重9.5斤已换算4.75kg")
    ok &= assert_true(note is not None, f"添加人工备注成功: {note.id}")

    feibo_reload = session.get(Reconciliation, feibo.id)
    ok &= assert_true(feibo_reload.manual_note == "已确认为大橘（旧名肥波），体重9.5斤已换算4.75kg",
                      "对账记录备注字段同步更新")
    ok &= assert_true(feibo_reload.note_source == "人工",
                      f"备注来源=人工: 实际={feibo_reload.note_source}")

    batch_no_2, results_2, _ = run_reconciliation(session, batch_no=batch_no, process_round=2)
    ok &= assert_true(batch_no_2 == batch_no, f"重跑使用同一批次号: {batch_no_2}")

    second_round = session.query(Reconciliation).filter(
        Reconciliation.batch_no == batch_no, Reconciliation.process_round == 2
    ).all()
    ok &= assert_true(len(second_round) == 8, f"第2轮生成8条: 实际{len(second_round)}")

    feibo_r2 = next(r for r in second_round if r.handwritten_name == "肥波")
    ok &= assert_true(feibo_r2.process_status in ("重跑(后补)", "重跑"),
                      f"第2轮肥波状态=重跑(后补): 实际={feibo_r2.process_status}")
    ok &= assert_true(feibo_r2.manual_note == feibo_reload.manual_note,
                      "第2轮自动继承第1轮的人工备注（后补备注不丢失）")

    all_rounds = session.query(Reconciliation).filter(Reconciliation.batch_no == batch_no).all()
    rounds_map = {}
    for r in all_rounds:
        rounds_map.setdefault(r.process_round, 0)
        rounds_map[r.process_round] += 1
    ok &= assert_true(rounds_map.get(1) == 8 and rounds_map.get(2) == 8,
                      f"两轮记录分别保存: {rounds_map}（可区分旧处理和最新）")

    note_count = session.query(ManualNote).filter(
        ManualNote.reconciliation_id == feibo.id
    ).count()
    ok &= assert_true(note_count >= 1, "备注历史被持久化")

    return ok


def test_export_and_filter_persistence(session, batch_no):
    print("\n[测试5] CSV导出 - 筛选条件持久化 + 按筛选追回")
    ok = True

    filters_need = {"review_status": "需复核"}
    path_need, cnt_need = export_csv(session, batch_no, filters=filters_need)
    ok &= assert_true(os.path.exists(path_need), f"CSV文件存在: {path_need}")
    ok &= assert_true(cnt_need >= 3, f"需复核至少3条（肥波+阿旺+其他）: 实际{cnt_need}")

    with open(path_need, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    ok &= assert_true(len(rows) == cnt_need, f"CSV行数={len(rows)} == 导出计数={cnt_need}")

    headers = rows[0].keys() if rows else []
    for required in ["对账批次号", "复核原因", "人工备注", "备注来源", "处理状态", "导出时间戳"]:
        ok &= assert_true(required in headers, f"CSV列含'{required}'")

    feibo_csv = next((r for r in rows if r["手写单名称"] == "肥波"), None)
    ok &= assert_true(feibo_csv is not None, "CSV中可找到'肥波'")
    if feibo_csv:
        ok &= assert_true(feibo_csv["复核状态"] == "需复核",
                          f"肥波CSV复核状态=需复核: {feibo_csv['复核状态']}")
        ok &= assert_true("名称无法匹配" in feibo_csv["复核原因"],
                          f"肥波CSV复核原因可解释: {feibo_csv['复核原因'][:40]}")

    awang_csv = next((r for r in rows if r["手写单名称"] == "阿旺"), None)
    ok &= assert_true(awang_csv is not None and "体重单位混写" in awang_csv["复核原因"],
                      "阿旺CSV复核原因含单位混写，接手的人能看出为什么复核")

    batch_rec = session.query(ExportBatch).filter(ExportBatch.batch_no == batch_no).first()
    ok &= assert_true(batch_rec is not None, "导出批次记录存在")
    ok &= assert_true(batch_rec.filter_criteria is not None, "筛选条件已绑定到批次")
    saved_filters = json.loads(batch_rec.filter_criteria)
    ok &= assert_true(saved_filters.get("review_status") == "需复核",
                      f"绑定的筛选条件正确: {saved_filters}")

    state_key = f"filter_{batch_no}_default"
    save_filter_state(session, state_key, filters_need, page=1, per_page=20)
    loaded = load_filter_state(session, state_key)
    ok &= assert_true(loaded is not None and loaded["filters"].get("review_status") == "需复核",
                      "筛选状态持久化成功，刷新页面后可恢复")

    filters_name = {"pet_name": "旺财"}
    path_name, cnt_name = export_csv(session, batch_no, filters=filters_name)
    ok &= assert_true(cnt_name == 2, f"按宠物名筛选旺财（两轮）: 实际{cnt_name}")

    return ok


def main():
    print("=" * 65)
    print("  宠物减重排程对账 - 主流程与异常分支全链路测试")
    print("=" * 65)

    reset_db()
    session = init_db()

    all_ok = True
    all_ok &= test_name_matching(session)
    all_ok &= test_weight_parsing()

    batch_no, rc_ok = test_reconciliation_main(session)
    all_ok &= rc_ok

    all_ok &= test_round_trip_and_notes(session, batch_no)
    all_ok &= test_export_and_filter_persistence(session, batch_no)

    print("\n" + "=" * 65)
    if all_ok:
        print("  🎉 全部测试通过！异常分支（名称未匹配/单位混写）均已走通")
        print("     重跑区分、备注继承、筛选持久化、CSV筛选追回均验证成功。")
    else:
        print("  ⚠️  存在测试失败项，请检查上方日志。")
    print("=" * 65)

    session.close()
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
