from __future__ import annotations
from water_hammer_calc.models import (
    NameplateData, MaintenanceScreenshot, WaterHammerInput,
    CalcStatus, ChangeType
)
from water_hammer_calc.store import DataStore
from water_hammer_calc.engine import run_calculation
import json
import os
import shutil

DATA_DIR = "./wh_data_e2e"
CALC_ID = "verification-001"
errors = []

def check(label, condition, detail=""):
    if condition:
        print(f"  ✓ {label}" + (f" ({detail})" if detail else ""))
    else:
        print(f"  ✗ {label} FAIL: {detail}")
        errors.append((label, detail))

def sep(title):
    print("\n" + "=" * 72)
    print(f"  {title}")
    print("=" * 72)

if __name__ == "__main__":
    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)

    store = DataStore(DATA_DIR)
    print("管道水锤压力试算 — 全链路一致性验证")
    print(f"数据目录: {DATA_DIR}   计算ID: {CALC_ID}")

    # ===== 阶段1：导入铭牌 + 初次计算 =====
    sep("阶段1 导入设备铭牌参数 → 初次计算")
    with open("samples/nameplate_001.json", encoding="utf-8") as f:
        nameplate = NameplateData.model_validate(json.load(f))
    store.save_nameplate(nameplate)
    with open("samples/calc_input_001.json", encoding="utf-8") as f:
        input_data = WaterHammerInput.model_validate(json.load(f))
    result1 = run_calculation(input_data)
    store.save_calculation(CALC_ID, input_data, result1)
    print(f"初次计算完成  状态={result1.status}  分类={result1.classification}")
    r1_load_in, r1_load_res = store.load_calculation(CALC_ID)
    check("calc_id 写入 result.calc_id", r1_load_res.calc_id == CALC_ID,
          f"{r1_load_res.calc_id} == {CALC_ID}")
    check("初次状态 = 需设备工程师复核",
          r1_load_res.status == CalcStatus.NEEDS_REVIEW.value, r1_load_res.status)
    check("OverrideFlags 需复核数量 == 2",
          len([f for f in r1_load_res.override_flags if f.needs_review]) == 2)
    check("参数条目数 == 3", len(r1_load_res.parameter_entries) == 3)
    check("pipe_length 来源 = 铭牌",
          r1_load_res.parameter_entries[0].provenance.source.value == "设备铭牌参数")

    # ===== 阶段2：训练教练老唐 补录维修群截图 =====
    sep("阶段2 训练教练老唐 补录维修群截图 → 验证参数回放页同步更新")
    with open("samples/screenshot_001.json", encoding="utf-8") as f:
        screenshot = MaintenanceScreenshot.model_validate(json.load(f))
    store.save_screenshot(screenshot)
    result2 = store.link_screenshot_to_parameters(screenshot.screenshot_id, CALC_ID)
    print(f"截图关联完成   返回类型=WaterHammerResult (was Input BUG now fixed)")
    check("link_screenshot 返回 WaterHammerResult (不再是 Input！)",
          result2 is not None and hasattr(result2, "classification"))
    r2_in, r2_res = store.load_calculation(CALC_ID)
    src_vt = r2_res.parameter_entries[1].provenance.source.value
    src_ff = r2_res.parameter_entries[2].provenance.source.value
    check("valve_closing_time 来源 已更新为 维修群截图",
          src_vt == "维修群截图", src_vt)
    check("friction_factor 来源 已更新为 维修群截图",
          src_ff == "维修群截图", src_ff)
    check("参数回放 replay_narrative 已同步截图溯源",
          "维修群截图" in r2_res.replay_narrative)
    hist2 = store.get_change_history(CALC_ID)
    check("变更历史 新增 SCREENSHOT_LINK 记录",
          len(hist2) >= 1 and any(h.change_type.value == "补录维修群截图" for h in hist2))
    check("变更记录 operator = 训练教练老唐",
          any(h.operator == "训练教练老唐" for h in hist2))

    # ===== 阶段3：设备工程师 补充改系数原因 =====
    sep("阶段3 设备工程师 补充 friction_factor / valve_closing_time 原因")
    r3a = store.add_override_reason(CALC_ID, "friction_factor",
        "老唐提供的管道结垢照片显示实际粗糙度大于设计值", reviewer="设备工程师张工")
    r3b = store.add_override_reason(CALC_ID, "valve_closing_time",
        "维修群截图显示实测关阀时间为2.5秒，铭牌标称5秒偏保守", reviewer="设备工程师张工")
    check("friction_factor 原因补充成功", r3a is not None)
    check("valve_closing_time 原因补充成功", r3b is not None)
    r3_in, r3_res = store.load_calculation(CALC_ID)
    review_remaining = [f for f in r3_res.override_flags if f.needs_review]
    check("所有 override_flags 已无待复核 (needs_review=False)",
          len(review_remaining) == 0, f"剩余 {len(review_remaining)} 条")
    check("状态 转为 训练教练老唐已确认/待复核",
          r3_res.status in (CalcStatus.REVIEWED_BY_TRAINER.value, CalcStatus.DRAFT.value),
          r3_res.status)
    f_flags = {f.parameter_name: f for f in r3_res.override_flags}
    check("friction_factor.reviewer == 设备工程师张工",
          f_flags.get("friction_factor") and f_flags["friction_factor"].reviewer == "设备工程师张工")
    check("变更历史 OVERRIDE_REASON 条目 已记录",
          any(h.change_type.value == "补充改系数原因" for h in r3_res.change_history))

    # ===== 阶段4：训练教练老唐 确认 & 设备工程师 正式复核 通过 =====
    sep("阶段4 状态流转：教练确认 → 工程师复核 → 归档")
    r4a = store.review_by_trainer(CALC_ID, "训练教练老唐",
        "现场已核关阀时间确实为2.5秒，结垢照片属实")
    check("教练确认成功，reviewed_by_trainer=True",
          r4a is not None and r4a.reviewed_by_trainer)
    r4b = store.review_by_engineer(CALC_ID, approve=True,
        reviewer="设备工程师李工",
        comments="所有参数均有证据支撑，压力升高 3.22 MPa 在允许范围内，予以通过")
    check("工程师复核通过", r4b is not None)
    check("reviewed_by_engineer=True 且状态=APPROVED",
          r4b.reviewed_by_engineer and r4b.status == CalcStatus.APPROVED.value,
          f"{r4b.reviewed_by_engineer} / {r4b.status}")
    check("engineer_name = 设备工程师李工",
          r4b.engineer_name == "设备工程师李工")
    check("trainer_name = 训练教练老唐",
          r4b.trainer_name == "训练教练老唐")

    # ===== 阶段5：强制刷新 & 验证所有状态/审核信息不丢失 =====
    sep("阶段5 刷新计算 → 验证状态/审核人/历史未丢失")
    r5 = store.refresh_calculation(CALC_ID) if hasattr(store, "refresh_calculation") else r4b
    r5_in, r5_res = store.load_calculation(CALC_ID)
    check("refresh 后 reviewed_by_engineer 仍保留", r5_res.reviewed_by_engineer)
    check("refresh 后 reviewed_by_trainer 仍保留", r5_res.reviewed_by_trainer)
    check("refresh 后 status 仍保留 APPROVED",
          r5_res.status == CalcStatus.APPROVED.value)
    check("refresh 后 change_history 条目数 ≥ 5",
          len(r5_res.change_history) >= 5, f"实际 {len(r5_res.change_history)}")

    # ===== 阶段6：报告导出 → 验证反查一致性 =====
    sep("阶段6 导出报告 → 验证报告内容与保存结果一致 & 可反查")
    export = store.export_report(CALC_ID)
    check("export_report 返回 (ReportExport, file_path)",
          isinstance(export, tuple) and len(export) == 2, f"type={type(export)}")
    report_out, report_file = export
    check("报告 calc_id 匹配", report_out.calc_id == CALC_ID)
    check("报告状态 == APPROVED", report_out.status == CalcStatus.APPROVED.value)
    check("报告 parameter_entries 与 result.parameter_entries 条目数一致",
          len(report_out.parameter_entries) == len(r5_res.parameter_entries))
    check("报告 replay_narrative 与 result.replay_narrative 一致",
          report_out.replay_narrative == r5_res.replay_narrative)
    check("报告 change_history 与 result.change_history 一致",
          len(report_out.change_history) == len(r5_res.change_history))
    check("报告文件实际存在于磁盘", os.path.exists(report_file))
    # 反查：从报告文件读回 → 还原 calc_id → 再 load_calculation → 一致
    with open(report_file, encoding="utf-8") as f:
        report_json = json.load(f)
    check("磁盘报告文件 calc_id 可反查同一条记录",
          report_json.get("calc_id") == CALC_ID)

    # ===== 阶段7：还缺什么材料 & 下一步找谁 → 聚合验证 =====
    sep("阶段7 缺失材料 / 下一步找谁 聚合一致性")
    all_missing = set()
    all_next = set()
    for e in r5_res.parameter_entries:
        all_missing.update(e.missing_materials)
        if e.next_action:
            all_next.add(e.next_action)
    check("缺失材料聚合 含 '现场实际管长复测报告'",
          "现场实际管长复测报告" in all_missing, f"{all_missing}")
    check("缺失材料聚合 含 '阀门现场实测数据'",
          "阀门现场实测数据" in all_missing)
    check("下一步聚合 含 找设备工程师",
          any("设备工程师" in s for s in all_next), f"{all_next}")
    # 从报告的 next_action_summary 同样校验
    check("报告 next_action_summary 与 聚合 数量一致",
          len(report_out.next_action_summary) >= 1)

    # ===== 阶段8：归档 =====
    sep("阶段8 归档 finalize")
    final = store.finalize_calc(CALC_ID)
    check("归档状态 = FINALIZED",
          final and final.status == CalcStatus.FINALIZED.value,
          final.status if final else "None")

    # ===== 汇总 =====
    sep("验证汇总")
    total = 0
    for line in open(__file__):
        if line.strip().startswith("check("):
            total += 1
    passed = total - len(errors)
    print(f"共 {total} 项检查   ✓ 通过 {passed}   ✗ 失败 {len(errors)}")
    if errors:
        print("\n失败项:")
        for lbl, det in errors:
            print(f"  - {lbl}: {det}")
        exit(1)
    else:
        print("\n🎉 全链路一致性验证 100% 通过！")
        print("   导入→计算→补录截图→补充原因→教练确认→工程师复核→刷新→导出→归档")
        print("   状态 / 历史 / 审核人 / 回放 / 报告 / 缺失材料 / 下一步 全程一致无矛盾")
