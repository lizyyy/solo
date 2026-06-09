import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import QualityWorkflow, RecordStatus


def print_divider(title=""):
    if title:
        line = "=" * 70
        print(f"\n{line}")
        pad = (70 - len(title)) // 2
        print(f"{' ' * pad}{title}")
        print(line)
    else:
        print("\n" + "-" * 70)


def print_result(title, data):
    print(f"\n【{title}】")
    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, (dict, list)):
                print(f"  {k}: {json.dumps(v, ensure_ascii=False, indent=6)[6:].rstrip('}').rstrip(']').strip()}")
            else:
                print(f"  {k}: {v}")
    else:
        print(f"  {data}")


def test_full_workflow():
    print_divider("无人船横摇周期估算 - 完整操作路径测试")
    
    wf = QualityWorkflow()
    
    # ===== 第一步：采样间隔说明第一次导入（正常材料）=====
    print_divider("场景1: 正常材料导入")
    print("操作: 导入采样间隔说明（SHIP-A，采样间隔0.05s）")
    
    r1 = wf.step1_import_sampling_record({
        "record_id": "SAMPLE-001",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-A01",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-08T20:00:00",
        "sampling_end_time": "2026-06-08T22:00:00",
        "roll_periods": [12.5, 12.3, 12.6, 12.4, 12.5],
        "import_user": "操作员张三"
    })
    
    print_result("导入结果", {
        "记录ID": r1["record_id"],
        "当前状态": r1["status"],
        "版本号": r1["version"],
        "发现冲突": r1["conflict_found"],
        "需人工关注": r1["needs_attention"],
        "关联链接": r1["links"]
    })
    
    # ===== 第二步：温度校准记录导入（触发冲突）=====
    print_divider("场景2: 错口径材料 - 校准间隔与采样说明矛盾")
    print("操作: 导入温度校准记录（SHIP-A，校准有效间隔0.04s，一夜后补送）")
    
    cal_result = wf.step2_import_calibration_and_check({
        "calibration_id": "CAL-A001",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-A01",
        "calibration_time": "2026-06-08T18:00:00",
        "effective_sampling_interval": 0.04,
        "calibration_temperature": 32.5,
        "operator": "校准员李四",
        "remarks": "夜航高温导致采样频率偏移"
    })
    
    print_result("校准导入结果", {
        "校准ID": cal_result["calibration_id"],
        "触发冲突数": cal_result["new_conflicts_found"],
        "受影响记录": cal_result["affected_record_ids"]
    })
    
    if cal_result["conflicts"]:
        c = cal_result["conflicts"][0]
        print_result("冲突证据清单", {
            "冲突ID": c["conflict_id"],
            "原始采样值": f"{c['sampling_value']}s",
            "校准有效值": f"{c['calibration_value']}s",
            "证据描述": c["description"]
        })
    
    # ===== 第三步：安全提醒更新 =====
    print_divider("场景2续: 更新安全提醒")
    print("操作: 质检员小白点击'同步安全提醒'")
    
    safety_result = wf.step3_update_safety_reminders("质检员小白")
    print_result("安全提醒更新结果", {
        "新增提醒数": safety_result["new_reminders_added"],
        "待处理总数": safety_result["total_pending_reminders"]
    })
    
    for rem in safety_result["reminders"]:
        if not rem["reviewed"]:
            print_result(f"提醒 [{rem['level']}] {rem['title']}", {
                "类型": rem["reminder_type"],
                "关联记录": rem["related_record"],
                "原始说法": f"{rem['original_value']}s（采样记录声明）",
                "改后说法": f"{rem['current_value']}s（温度校准给出）",
                "下一步找谁": rem["next_step"],
                "详细内容": rem["content"]
            })
    
    # ===== 冲突处理：质检员选择确认/驳回 =====
    print_divider("场景3: 质检员小白确认冲突")
    print("操作: 列出冲突证据，让质检员小白选择（不自动拍板）")
    
    conflicts = wf.conflict_detector.get_conflict_summary()
    for c in conflicts:
        if c["status"] == "待处理":
            print_result(f"待确认冲突 {c['conflict_id']}", {
                "类型": c["type"],
                "证据": c["description"],
                "状态": c["status"]
            })
            
            print("\n>>> 质检员小白选择：【确认有效，以采样记录为准】指定值0.045s")
            resolve_result = wf.resolve_conflict(
                conflict_id=c["conflict_id"],
                resolution="确认冲突存在，采用折中0.045s",
                resolved_by="质检员小白",
                handler_after="安全员王五复核后归档",
                correct_value=0.045
            )
            
            print_result("冲突处理结果", {
                "处理前状态": resolve_result["original_status"],
                "处理后状态": resolve_result["record_new_status"],
                "结果摘要": resolve_result["result_summary"],
                "下一步找谁": resolve_result["next_handler"],
                "仍需人工复核": resolve_result["manual_review_needed"]
            })
    
    # ===== 第三步再执行：安全提醒更新（修正记录）=====
    print_divider("场景4: 已修正记录的安全提醒")
    print("操作: 再次更新安全提醒（为已修正记录生成跟进提醒）")
    
    safety_result2 = wf.step3_update_safety_reminders("质检员小白")
    print_result("安全提醒更新", {
        "总待处理数": safety_result2["total_pending_reminders"]
    })
    
    # ===== 暂停：保存会话 =====
    print_divider("暂停续局测试：保存会话")
    session_path = os.path.join(os.path.dirname(__file__), "data", "session_test.json")
    os.makedirs(os.path.dirname(session_path), exist_ok=True)
    
    save_result = wf.save_session(session_path, "无人船横摇周期-夜间批次")
    print_result("会话已保存", {
        "保存路径": save_result["filepath"],
        "会话名称": "无人船横摇周期-夜间批次",
        "保存时间": save_result["saved_time"]
    })
    
    # ===== 续局：加载会话 =====
    print_divider("暂停续局测试：恢复会话")
    wf2 = QualityWorkflow()
    load_result = wf2.load_session(session_path)
    
    print_result("会话已恢复", {
        "加载记录数": load_result["records_count"],
        "文件路径": load_result["filepath"]
    })
    
    # ===== 续局后验证：同一条记录最新状态 =====
    print_divider("重点核对：续局后SAMPLE-001是否为同一份最新结果")
    
    detail_before = wf.get_record_detail("SAMPLE-001")
    detail_after = wf2.get_record_detail("SAMPLE-001")
    
    match_result = (
        detail_before["summary"]["current_status"] == detail_after["summary"]["current_status"]
        and detail_before["sampling_values"]["declared_interval"] == detail_after["sampling_values"]["declared_interval"]
        and detail_before["summary"]["version"] == detail_after["summary"]["version"]
    )
    
    print_result("SAMPLE-001详情（保存前）", {
        "状态": detail_before["summary"]["current_status"],
        "采样间隔": detail_before["sampling_values"]["declared_interval"],
        "原始间隔": detail_before["sampling_values"]["original_declared_interval"],
        "版本号": detail_before["summary"]["version"],
        "关联冲突数": len(detail_before["related_conflicts"]),
        "关联提醒数": len(detail_before["related_reminders"])
    })
    
    print_result("SAMPLE-001详情（恢复后）", {
        "状态": detail_after["summary"]["current_status"],
        "采样间隔": detail_after["sampling_values"]["declared_interval"],
        "原始间隔": detail_after["sampling_values"]["original_declared_interval"],
        "版本号": detail_after["summary"]["version"],
        "关联冲突数": len(detail_after["related_conflicts"]),
        "关联提醒数": len(detail_after["related_reminders"]),
        "与保存前一致": "✓ 是" if match_result else "✗ 不一致"
    })
    
    print_result("人工复核信息完整度", {
        "原始说法": f"{detail_after['review_infos'][0]['original_value']}s" if detail_after["review_infos"] else "无",
        "改后的值": f"{detail_after['review_infos'][0]['corrected_value']}s" if detail_after["review_infos"] else "无",
        "处理原因": detail_after["review_infos"][0]["reason"] if detail_after["review_infos"] else "无",
        "下一步找谁": detail_after["review_infos"][0]["next_handler"] if detail_after["review_infos"] else "无",
        "处理人": detail_after["review_infos"][0]["handled_by"] if detail_after["review_infos"] else "无"
    })
    
    # ===== 重点：列表、详情、摘要、历史、导出 同步 =====
    print_divider("重点核对：列表/详情/摘要/历史/导出 同一条记录同步")
    
    dashboard = wf2.get_dashboard()
    list_item = next((r for r in dashboard["record_list_snippet"] if r["record_id"] == "SAMPLE-001"), None)
    
    print_result("仪表盘列表SAMPLE-001", {
        "列表状态": list_item["status"] if list_item else "未找到",
        "列表版本": list_item["version"] if list_item else "N/A",
        "列表待处理提醒": list_item["pending_reminders"] if list_item else "N/A"
    })
    
    print_result("详情页SAMPLE-001", {
        "详情状态": detail_after["summary"]["current_status"],
        "详情版本": detail_after["summary"]["version"],
        "详情待处理提醒": detail_after["summary"]["pending_reminders"]
    })
    
    print_result("数据一致性核对", {
        "状态一致": "✓" if list_item and list_item["status"] == detail_after["summary"]["current_status"] else "✗",
        "版本一致": "✓" if list_item and list_item["version"] == detail_after["summary"]["version"] else "✗",
        "待提醒数一致": "✓" if list_item and list_item["pending_reminders"] == detail_after["summary"]["pending_reminders"] else "✗"
    })
    
    # ===== 历史记录查询 =====
    print_divider("历史记录追踪：SAMPLE-001")
    
    history = wf2.get_history("SAMPLE-001")
    print(f"共 {len(history)} 条操作记录：")
    for i, h in enumerate(history):
        details_str = json.dumps(h["details"], ensure_ascii=False)
        if len(details_str) > 80:
            details_str = details_str[:80] + "..."
        print(f"  {i+1}. [{h['timestamp'][:19]}] {h['action']} -> {details_str}")
    
    # ===== 导出验证 =====
    print_divider("导出报告：SAMPLE-001（含历史+关联）")
    
    export_result = wf2.export_record("SAMPLE-001", include_history=True)
    pkg = export_result["data"]
    
    print_result("导出包内容", {
        "导出ID": pkg["export_id"],
        "一致性检查": pkg["consistency_check"],
        "数据一致": "✓" if pkg["consistent"] else "✗",
        "关联冲突数": len(pkg["related_conflicts"]),
        "关联校准数": len(pkg["related_calibrations"]),
        "关联提醒数": len(pkg["related_reminders"]),
        "补录记录数": len(pkg["supplementary_records"]),
        "历史条数": len(pkg["history_log"]),
        "记录内版本号": pkg["record_detail"]["version"]
    })
    
    # ===== 场景5: 传感器重启编号变更 =====
    print_divider("场景5: 传感器重启后编号变更（留待安全员复核，不归正常）")
    
    print("操作1: 导入SHIP-B上午采样（传感器SENSOR-B01）")
    wf2.step1_import_sampling_record({
        "record_id": "SAMPLE-002A",
        "ship_id": "SHIP-B",
        "sensor_id": "SENSOR-B01",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-09T08:00:00",
        "sampling_end_time": "2026-06-09T10:00:00",
        "roll_periods": [13.1, 13.0],
        "import_user": "操作员张三"
    })
    
    print("\n操作2: 导入SHIP-B下午采样（传感器重启变成SENSOR-B01-R）")
    r2b = wf2.step1_import_sampling_record({
        "record_id": "SAMPLE-002B",
        "ship_id": "SHIP-B",
        "sensor_id": "SENSOR-B01-R",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-09T14:00:00",
        "sampling_end_time": "2026-06-09T16:00:00",
        "roll_periods": [12.9, 13.1],
        "import_user": "操作员张三"
    })
    
    print_result("重启记录检测结果", {
        "记录状态": r2b["status"],
        "自检发现": r2b["check_issues"],
        "需人工关注": r2b["needs_attention"]
    })
    
    # 更新安全提醒
    safety3 = wf2.step3_update_safety_reminders("质检员小白")
    rem_review = next((r for r in safety3["reminders"] if r["related_record"] == "SAMPLE-002B" and not r["reviewed"]), None)
    
    print_result("传感器变更安全提醒", {
        "提醒级别": rem_review["level"] if rem_review else "N/A",
        "提醒标题": rem_review["title"] if rem_review else "N/A",
        "原始编号": rem_review["original_value"] if rem_review else "N/A",
        "当前编号": rem_review["current_value"] if rem_review else "N/A",
        "下一步": rem_review["next_step"] if rem_review else "N/A"
    })
    
    # ===== 安全员复核（别急着归正常，先走复核）=====
    print_divider("安全员复核流程（先留待复核，不提前归正常）")
    
    detail_review = wf2.get_record_detail("SAMPLE-002B")
    print_result("复核前状态", {
        "状态": detail_review["summary"]["current_status"],
        "需人工复核": detail_review["status_tracking"]["needs_manual_review"],
        "下一步处理": detail_review["status_tracking"]["next_handler"]
    })
    
    print("\n>>> 安全员王五现场复核，选择通过")
    if rem_review:
        review_result = wf2.review_safety_reminder(
            rem_review["id"],
            "安全员王五",
            True,
            "现场核查：重启后编号变更正常，已重新校准"
        )
        
        print_result("复核结果", {
            "是否通过": "✓ 通过" if review_result["is_approved"] else "✗ 不通过",
            "处理前状态": review_result["old_status"],
            "处理后状态": review_result["record_new_status"],
            "下一步动作": review_result["next_action"],
            "仍待处理": "是" if review_result["still_pending"] else "否（最终归档）"
        })
    
    # ===== 场景6: 补录材料 =====
    print_divider("场景6: 补录材料并重算")
    
    print("操作: 先计算SHIP-A横摇周期估算（仅SAMPLE-001）")
    est_before = wf2.calculate_roll_period_estimate("SHIP-A", "系统自动")
    print_result("补录前估算", {
        "使用记录数": est_before["records_used"],
        "平均横摇周期": f"{est_before['average_period']}s",
        "方差": est_before["period_variance"]
    })
    
    print("\n操作: 导入补录SAMPLE-001-SUPP（同一SHIP-A）")
    supp_result = wf2.step1_import_sampling_record({
        "record_id": "SAMPLE-001-SUPP",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-A01",
        "sampling_interval": 0.045,
        "sampling_start_time": "2026-06-09T08:00:00",
        "sampling_end_time": "2026-06-09T10:00:00",
        "roll_periods": [12.8, 12.7, 12.9],
        "import_user": "操作员张三",
        "is_supplementary": True,
        "original_record_id": "SAMPLE-001"
    })
    
    print_result("补录导入结果", {
        "记录ID": supp_result["record_id"],
        "原始记录ID": "SAMPLE-001",
        "状态": supp_result["status"],
        "是否补录标记": supp_result["check_issues"]
    })
    
    # 验证主记录关联了补录ID
    detail_orig = wf2.get_record_detail("SAMPLE-001")
    print_result("主记录SAMPLE-001补录关联", {
        "状态": detail_orig["summary"]["current_status"],
        "补录数": detail_orig["summary"]["supplementaries_count"],
        "关联补录ID": detail_orig["links"]["supplementary_ids"]
    })
    
    print("\n操作: 重算SHIP-A横摇周期估算（含补录）")
    est_after = wf2.calculate_roll_period_estimate("SHIP-A", "系统自动")
    print_result("补录后估算", {
        "使用记录数": est_after["records_used"],
        "使用记录": est_after["used_record_ids"],
        "平均横摇周期": f"{est_after['average_period']}s",
        "方差": est_after["period_variance"],
        "周期变化": f"{est_after['average_period'] - est_before['average_period']:+.4f}s"
    })
    
    # ===== 最终仪表盘汇总 =====
    print_divider("最终仪表盘汇总")
    
    final_dashboard = wf2.get_dashboard()
    print_result("总体概览", final_dashboard["overview"])
    print_result("状态分布", final_dashboard["status_breakdown"])
    print_result("安全提醒统计", final_dashboard["safety_reminders"])
    print_result("冲突统计", final_dashboard["conflicts"])
    print_result("自检报告", final_dashboard["self_check"])
    
    # ===== 最终再核对一次：同一条记录各处一致 =====
    print_divider("最终核对：采样间隔说明第一次导入 vs 最新结果（SAMPLE-001）")
    
    final_detail = wf2.get_record_detail("SAMPLE-001")
    final_export = wf2.export_record("SAMPLE-001")
    final_list = next(r for r in final_dashboard["record_list_snippet"] if r["record_id"] == "SAMPLE-001")
    
    checks = {
        "仪表盘列表状态 vs 详情页状态": final_list["status"] == final_detail["summary"]["current_status"],
        "详情页状态 vs 导出包状态": final_detail["summary"]["current_status"] == final_export["data"]["record_detail"]["status"],
        "详情页版本 vs 导出包版本": final_detail["summary"]["version"] == final_export["data"]["record_detail"]["version"],
        "详情页采样间隔 vs 导出包间隔": final_detail["sampling_values"]["declared_interval"] == final_export["data"]["record_detail"]["sampling_interval"],
        "原始说法保留": final_detail["sampling_values"]["original_declared_interval"] == 0.05,
        "改后说法保留": final_detail["sampling_values"]["declared_interval"] == 0.045,
        "处理原因保留": len(final_detail["review_infos"]) > 0,
        "下一步找谁保留": final_detail["status_tracking"]["next_handler"] != "",
        "未提前归正常": final_detail["summary"]["current_status"] != RecordStatus.NORMAL.value
    }
    
    all_pass = all(checks.values())
    for k, v in checks.items():
        print(f"  {'✓' if v else '✗'} {k}")
    
    print_divider()
    if all_pass:
        print("  ★ 所有核对项通过！操作路走通。")
    else:
        print(f"  ✗ 有 {sum(1 for v in checks.values() if not v)} 项核对未通过")
    
    print_divider("完整测试结束")
    return all_pass


if __name__ == "__main__":
    success = test_full_workflow()
    sys.exit(0 if success else 1)
