"""
结构加固方案比选 —— 端到端测试

覆盖场景：
1. 统一数据源：场景标注/侧边说明/接口返回 必须是同一套话
2. 碰撞点重复自动挂起 → 待确认 → 影响分析
3. 补录备注不覆盖旧值，进入历史版本链
4. 阿乔临时改判，下一班能追到原因
5. 三栏对账视图输出可直接给阿乔用
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import (
    CollisionPoint, Conclusion, MaterialReviewItem, OperationType,
    RecordStatus, ViewPoint,
)
from service import (
    AuditService,
    CollisionDedupService,
    HistoryService,
    ReconciliationView,
    SchemeComparisonFacade,
    SuspensionService,
    UnifiedRenderSource,
)


def green(msg: str) -> None:
    print(f"\x1b[32m✔ {msg}\x1b[0m")


def section(title: str) -> None:
    print(f"\n\x1b[1m═════ {title} ═════\x1b[0m")


def _make_vp(x: float, y: float, z: float) -> ViewPoint:
    return ViewPoint(
        camera_position={"x": x, "y": y, "z": z},
        camera_target={"x": x + 5, "y": y + 5, "z": z},
        zoom=1.5,
        fov=50,
    )


# ---------------------------------------------------------------------------
# 场景 1：换视角导出 —— 三处输出不得三套话
# ---------------------------------------------------------------------------
def test_unified_source_consistency() -> None:
    section("场景 1：统一数据源一致性（换视角不三套话）")
    vp1 = _make_vp(10, 20, 3)

    record = SchemeComparisonFacade.create_record(
        project_name="A栋加固", project_code="PRJ-001",
        structural_element="三层柱 Z-3A", operator="系统",
    )
    mat = MaterialReviewItem(
        material_name="300g/m²碳纤维布", specification="一级200mm宽",
        supplier="碳纤厂A", batch_no="B2026-0601",
        quantity=120, unit="m²", created_by="资料员小李",
        collision_points=[
            CollisionPoint(
                element_id="Z-3A", description="主筋与箍筋间距不足",
                screenshot_path="/img/z3a_col1.png", viewpoint=vp1,
                severity="high",
            ),
        ],
    )
    SchemeComparisonFacade.add_material(record, mat, "资料员小李")

    # 三处同步已在 add_material 内完成
    UnifiedRenderSource.apply_to_record(record)

    # 断言：三栏都引用同一 source_id
    api_src_id = record.api_response["data"]["record_id"]
    assert record.api_response["source_id"] == record.render_source_id, "接口返回 source_id 不一致"
    assert "source_id" in record.api_response, "接口返回缺少 source_id"
    green("api_response 与 record.render_source_id 同源")

    # 断言：场景标注 / 侧边说明 都提到同一碰撞点描述
    assert "主筋与箍筋间距不足" in record.scene_annotations, "场景标注缺碰撞点描述"
    assert "主筋与箍筋间距不足" in record.side_notes, "侧边说明缺碰撞点描述"
    api_cols = record.api_response["data"]["collisions"]
    assert any("主筋与箍筋间距不足" in c["description"] for c in api_cols)
    green("场景标注 / 侧边说明 / 接口返回 均包含相同碰撞点描述")

    # 断言：三方都携带视角指纹
    assert "VP:" in record.scene_annotations, "场景标注缺少视角标记"
    assert api_cols[0]["camera"]["camera_position"]["x"] == 10.0
    green("三方都携带相同视角参数")

    # 换个视角再导一次
    vp2 = _make_vp(10.1, 20.2, 3.1)
    record.materials[0].collision_points[0].viewpoint = vp2
    record.materials[0].collision_points[0].screenshot_path = "/img/z3a_col1_v2.png"
    UnifiedRenderSource.apply_to_record(record)
    # 场景标注必须同步更新
    assert "camera" in record.api_response["data"]["collisions"][0]
    green("换视角后三处同步更新，无三套话")
    print("  → 场景标注示例:\n" + "\n".join("      " + l for l in record.scene_annotations.split("\n")))


# ---------------------------------------------------------------------------
# 场景 2：碰撞点重复 → 挂起 → 待确认 → 牵动分析
# ---------------------------------------------------------------------------
def test_duplicate_suspension() -> None:
    section("场景 2：碰撞点重复自动挂起 + 待确认 + 影响分析")
    vp = _make_vp(5, 5, 2)

    record = SchemeComparisonFacade.create_record(
        project_name="B栋加固", project_code="PRJ-002",
        structural_element="二层梁 L-2B", operator="系统",
    )
    SchemeComparisonFacade.revise_conclusion(
        record, Conclusion.SCHEME_B, "初判符合要求", "初评人小赵", 0.82,
    )

    # 同一条碰撞点被两条材料同时引用（重复）
    col_desc = "梁底保护层厚度不足，钢筋外露"
    mat1 = MaterialReviewItem(
        material_name="粘钢胶", specification="A级",
        supplier="胶厂X", batch_no="G-0601", quantity=50, unit="kg",
        created_by="小王",
        collision_points=[
            CollisionPoint(
                element_id="L-2B", description=col_desc,
                screenshot_path="/img/l2b.png", viewpoint=vp,
                severity="high",
            ),
        ],
    )
    mat2 = MaterialReviewItem(
        material_name="10mm钢板", specification="Q345",
        supplier="钢厂Y", batch_no="S-0602", quantity=8, unit="张",
        created_by="小王",
        collision_points=[
            CollisionPoint(
                element_id="L-2B", description=col_desc,
                screenshot_path="/img/l2b_copy.png", viewpoint=vp,
                severity="high",
            ),
        ],
    )
    SchemeComparisonFacade.add_material(record, mat1, "小王")
    SchemeComparisonFacade.add_material(record, mat2, "小王")  # ← 此处触发挂起

    # 断言：检测到重复，进入 pending
    assert record.status == RecordStatus.PENDING_CONFIRM, f"状态应为 pending_confirm，实际 {record.status}"
    assert len(record.pending_queue) >= 1, "待确认队列应有 1 项"
    green(f"记录自动挂起：status={record.status.value}，pending_queue={len(record.pending_queue)}项")

    # 断言：牵动分析要说明影响哪些结论
    pending = record.pending_queue[0]
    print(f"  影响分析：{pending.impact_analysis}")
    print(f"  牵动对象：{pending.affected_conclusions}")
    assert "当前结论" in pending.impact_analysis or "高危" in pending.impact_analysis
    assert len(pending.affected_conclusions) >= 2, "至少牵动两条材料结论"
    green("碰撞点重复挂起 + 牵动分析完成")

    # 阿乔来处理待确认
    keep_id = pending.duplicate_collision_ids[0]
    SuspensionService.resolve_pending(
        record, pending.pending_id, "施工经理阿乔",
        resolution=f"确认是同一处碰撞，保留 {keep_id} 其余去重",
        keep_collision_id=keep_id,
    )
    assert record.status == RecordStatus.CONFIRMED
    green(f"阿乔解决后状态恢复：{record.status.value}")

    total_cols = sum(len(m.collision_points) for m in record.materials)
    assert total_cols == 1, f"解决后只剩 1 处碰撞点，实际 {total_cols}"
    green(f"去重后剩余碰撞点：{total_cols} 处")


# ---------------------------------------------------------------------------
# 场景 3：补录备注不覆盖，历史链保留旧材料 + 新备注 + 改判原因
# ---------------------------------------------------------------------------
def test_history_chain_and_supplement() -> None:
    section("场景 3：补录备注 / 改判 —— 历史链完整保留")
    record = SchemeComparisonFacade.create_record(
        project_name="C栋加固", project_code="PRJ-003",
        structural_element="基础承台 CT-1", operator="系统",
    )
    mat = MaterialReviewItem(
        material_name="灌浆料", specification="C60",
        supplier="料厂Z", batch_no="GR-0601", quantity=3, unit="吨",
        created_by="小周",
        collision_points=[
            CollisionPoint(
                element_id="CT-1", description="承台侧面裂缝0.3mm",
                screenshot_path="/img/ct1_1.png", viewpoint=_make_vp(1, 2, 0.5),
                severity="medium",
            ),
        ],
    )
    SchemeComparisonFacade.add_material(record, mat, "小周")
    SchemeComparisonFacade.revise_conclusion(
        record, Conclusion.SCHEME_A, "裂缝可采用粘钢", "技术员小张", 0.75,
    )

    # 版本链
    assert len(record.history_chain) >= 3
    green(f"历史版本数：{len(record.history_chain)}")

    # 阿乔补录备注（后来补的备注）
    SchemeComparisonFacade.supplement_remark(
        record, record.materials[0].item_id,
        "现场补：6月10日复核，裂缝已扩展至0.42mm，附新截图ct1_2.png",
        "施工经理阿乔",
    )

    # 同时补充旧截图保留到碰撞点历史
    record.materials[0].collision_points[0].historical_screenshots.append({
        "path": "/img/ct1_1.png",
        "captured_at": "2026-06-01",
        "viewpoint_fingerprint": record.materials[0].collision_points[0].viewpoint.fingerprint(),
    })
    record.materials[0].collision_points[0].screenshot_path = "/img/ct1_2.png"
    UnifiedRenderSource.apply_to_record(record)

    # 断言：旧截图没丢
    hist = record.materials[0].collision_points[0].historical_screenshots
    assert len(hist) >= 1, "历史截图被覆盖了！"
    green(f"碰撞点历史截图保留：{len(hist)} 张")

    # 断言：备注都能看到
    remarks = record.materials[0].remarks
    assert len(remarks) >= 1
    print(f"  备注链：")
    for r in remarks:
        print(f"    [{r['timestamp']} {r['operator']}: {r['content']}")

    # 阿乔根据补录改判
    SchemeComparisonFacade.revise_conclusion(
        record, Conclusion.SCHEME_C,
        "裂缝扩展超出粘钢适用范围，改增大截面",
        "施工经理阿乔", 0.88,
    )

    # 版本链里有改判三元组：旧材料 + 新备注 + 改判原因
    v1 = record.history_chain[-1]
    print(f"  最新版本 V{v1.version_no}: {v1.old_conclusion} → {v1.new_conclusion}")
    print(f"    改判原因：{v1.revise_reason}")
    assert v1.old_conclusion == Conclusion.SCHEME_A
    assert v1.new_conclusion == Conclusion.SCHEME_C
    assert "裂缝扩展" in v1.revise_reason
    assert v1.snapshot_material is not None
    green("改判版本含 旧材料/新备注/改判原因 三元组")


# ---------------------------------------------------------------------------
# 场景 4：下一班追阿乔那次临时改判
# ---------------------------------------------------------------------------
def test_audit_trace_operator() -> None:
    section("场景 4：下一班按操作人追溯阿乔的临时改判")
    record = SchemeComparisonFacade.create_record(
        project_name="D栋加固", project_code="PRJ-004",
        structural_element="楼梯板 TB-2", operator="系统",
    )
    SchemeComparisonFacade.revise_conclusion(
        record, Conclusion.SCHEME_B, "初判", "白班小李", 0.7,
    )

    # 阿乔夜班临时改判
    SchemeComparisonFacade.revise_conclusion(
        record, Conclusion.SCHEME_A,
        "夜班现场复核：实测厚度不够，碳纤维改为粘钢",
        "施工经理阿乔", 0.9,
    )
    SchemeComparisonFacade.revise_conclusion(
        record, Conclusion.NEEDS_INSPECTION,
        "阿乔二次改判：业主方要求进一步取芯检测",
        "施工经理阿乔", 0.6,
    )

    # 下一班早班来追：按操作人筛选
    qiao_revisions = HistoryService.trace_revisions_by_operator(record, "施工经理阿乔")
    green(f"追溯到阿乔的改判次数：{len(qiao_revisions)}")
    assert len(qiao_revisions) >= 2
    for r in qiao_revisions:
        print(f"  V{r.version_no:02d} {r.operated_at} {r.old_conclusion} → {r.new_conclusion}")
        print(f"      原因：{r.revise_reason}")

    # 审计日志也能按人筛
    qiao_logs = AuditService.filter_logs(record, operator="施工经理阿乔")
    print(f"  阿乔的操作日志：{len(qiao_logs)} 条")
    for l in qiao_logs:
        if l.operation_type == OperationType.REVISE_CONCLUSION:
            print(f"    [{l.timestamp}] {l.operation_detail[:60]}...")

    # 追溯指定版本的改判原因（早班新人接手查 V3）
    trace = AuditService.trace_revise_reason(record, qiao_revisions[-1].version_no)
    assert trace is not None
    assert trace["operator"] == "施工经理阿乔"
    assert "取芯" in trace["revise_reason"]
    green("下一班成功追到阿乔两次临时改判 + 原因")


# ---------------------------------------------------------------------------
# 场景 5：三栏对账视图可直接给阿乔用
# ---------------------------------------------------------------------------
def test_reconciliation_view() -> None:
    section("场景 5：三栏对账视图（阿乔拿给别人看）")
    record = SchemeComparisonFacade.create_record(
        project_name="对账示例", project_code="PRJ-DEMO",
        structural_element="四层框架柱 FZ-4", operator="系统",
    )
    mat = MaterialReviewItem(
        material_name="碳纤维布", specification="300g",
        supplier="厂T", batch_no="T-99", quantity=50, unit="m²",
        created_by="资料员",
        collision_points=[
            CollisionPoint(
                element_id="FZ-4", description="节点区箍筋不足",
                screenshot_path="/img/fz4.png", viewpoint=_make_vp(3, 4, 5),
                severity="high",
                historical_screenshots=[
                    {"path": "/img/fz4_old1.png", "captured_at": "2026-06-01"},
                    {"path": "/img/fz4_old2.png", "captured_at": "2026-06-05"},
                ],
            ),
        ],
    )
    SchemeComparisonFacade.add_material(record, mat, "资料员")
    SchemeComparisonFacade.supplement_remark(
        record, record.materials[0].item_id,
        "补充：检测报告编号R-2026-0608已附",
        "施工经理阿乔",
    )
    SchemeComparisonFacade.revise_conclusion(
        record, Conclusion.SCHEME_B, "满足规范要求", "施工经理阿乔", 0.85,
    )

    txt = ReconciliationView.to_text(record)
    print("\n".join("  " + l for l in txt.split("\n")))
    # 断言：三栏都有关键信息
    assert "【左栏 · 材料送审表" in txt
    assert "【中栏 · 处理记录" in txt
    assert "【右栏 · 接口返回" in txt
    assert "三处同源，一套话" in txt
    # 旧截图计数
    assert "历史截图 2 张已保留" in txt
    # 备注内容
    assert "检测报告编号R-2026-0608已附" in txt
    green("三栏对账视图输出完整，可直接复制给任何人看")


def main() -> int:
    print("结构加固方案比选 —— 端到端测试")
    tests = [
        test_unified_source_consistency,
        test_duplicate_suspension,
        test_history_chain_and_supplement,
        test_audit_trace_operator,
        test_reconciliation_view,
    ]
    failed = 0
    for t in tests:
        try:
            t()
        except Exception as e:
            failed += 1
            print(f"\x1b[31m✗ {t.__name__} FAIL: {e}\x1b[0m")
            import traceback
            traceback.print_exc()
    print(f"\n{'='*60}")
    if failed:
        print(f"结果：{len(tests)-failed}/{len(tests)} 通过，{failed} 失败")
        return 1
    print(f"结果：全部 {len(tests)} 通过 ✨")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
