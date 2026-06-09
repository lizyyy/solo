from elevator_attribution import (
    build_sample_dataset, AttributionAPI,
    FilterCriteria, FaultStatus, BlockReason,
)

def main():
    proc = build_sample_dataset()
    f2 = proc.get_record("FAULT_002")
    revoked = [s for s in f2.sensor_logs if s.is_revoked]
    assert len(revoked) == 1
    assert "老何" in revoked[0].revoke_note
    print("OK 1: FAULT_002 夹带撤回记录")

    f3 = proc.get_record("FAULT_003")
    assert f3.status == FaultStatus.BLOCKED
    assert f3.block_reason == BlockReason.SAMPLE_GAP
    assert "断档 303秒" in f3.block_detail
    assert "L00302 / L00303" in f3.block_detail
    print("OK 2: FAULT_003 采样断档被拦住，原因清晰")

    api = AttributionAPI(proc)
    detail = api.fault_detail("FAULT_001")
    t = detail["trace"]
    assert len(t["chains"]) >= 1
    ch = t["chains"][0]
    assert "summary" in ch and "detail" in ch and "raw_logs" in ch and "changes" in ch
    assert len(ch["raw_logs"]) == 4
    assert len(ch["changes"]) >= 1
    print("OK 3: 链路追踪 summary→detail→raw_logs→changes 不断层")

    exp = api.export(FilterCriteria(min_confidence=0.7))
    assert "filter_criteria" in exp
    assert exp["filter_criteria"]["min_confidence"] == 0.7
    assert exp["summary_stats"]["by_status"].get("已归因") == 2
    print("OK 4: 导出附带 filter_criteria，和屏幕不分家")

    report = api.handover_report(since_ts="2026-06-01 00:00:00")
    assert "handover_text" in report
    assert "交接变更清单" in report["handover_text"]
    assert report["change_count"] >= 4
    print("OK 5: 交接文字简短可读")

    tri = api.bad_material_triage()
    assert len(tri["blocked"]) == 2
    assert len(tri["with_revoked"]) == 2
    assert len(tri["steps"]) == 3
    print("OK 6: 坏材料三步排查路径完整")

    f4 = proc.get_record("FAULT_004")
    assert f4.status == FaultStatus.BLOCKED
    assert f4.block_reason == BlockReason.REVOKED_PENDING
    assert "L00402" in f4.block_detail
    print("OK 7: FAULT_004 撤回未填说明被拦住")

    print()
    print("===== 全部验证通过 =====")

if __name__ == "__main__":
    main()
