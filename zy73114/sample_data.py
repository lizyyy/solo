from datetime import datetime, timedelta
from models import (
    ChangeOrder,
    DrawingVersion,
    Judgement,
    CoordinateOffset,
    JudgementImpact,
)


def build_review_meeting_sample() -> ChangeOrder:
    co = ChangeOrder(
        project_name="A栋写字楼（主体结构阶段）",
        change_order_no="CO-2026-0611-A栋-003",
        created_by="结构工程师老叶",
    )

    co.drawing_versions.extend([
        DrawingVersion(
            version="V1.0",
            issued_at=datetime(2026, 5, 20),
            issued_by="华东设计院",
            is_latest=False,
            description="施工图初版（送审用）",
        ),
        DrawingVersion(
            version="V2.0",
            issued_at=datetime(2026, 6, 1),
            issued_by="华东设计院",
            is_latest=False,
            description="根据审图意见调整梁柱节点",
        ),
        DrawingVersion(
            version="V3.0",
            issued_at=datetime(2026, 6, 10),
            issued_by="华东设计院",
            is_latest=True,
            description="优化剪力墙配筋 + 基础梁加强",
        ),
    ])

    co.judgements.extend([
        Judgement(
            item_code="STR-A-001",
            item_name="A区一层梁配筋",
            original_judgement="按V2.0图纸配4根HRB400 25钢筋",
            final_judgement="按V3.0图纸配6根HRB400 25钢筋",
            basis=["DWG-V3.0-STRUCT-A-01", "审图意见S-2026-018"],
        ),
        Judgement(
            item_code="STR-A-002",
            item_name="A区二层柱截面",
            original_judgement="柱截面600x600，C30混凝土",
            final_judgement="柱截面700x700，C35混凝土",
            basis=["DWG-V3.0-STRUCT-A-02"],
        ),
        Judgement(
            item_code="STR-B-001",
            item_name="B区三层板厚",
            original_judgement="板厚120mm，双层双向C8@200",
            final_judgement="板厚120mm，双层双向C8@200",
            basis=["DWG-V3.0-STRUCT-B-01"],
        ),
        Judgement(
            item_code="STR-B-002",
            item_name="B区地下室外墙",
            original_judgement="墙厚300mm，配C14@150",
            final_judgement="墙厚300mm，配C14@150",
            basis=["DWG-V3.0-STRUCT-B-02"],
        ),
    ])

    co.coordinate_offsets.append(CoordinateOffset(
        offset_x=0.045,
        offset_y=-0.028,
        offset_z=0.012,
        detected_at=datetime(2026, 6, 10, 15, 42),
        source_record_id="BIM-CALIBRATE-2026-0610-A栋",
        source_record_title="A栋主体结构BIM模型6月10日校准记录",
        confirmer_role="结构工程师",
        confirmer_name="老叶",
        confirmation_status="pending",
        affected_regions=["A区", "B区"],
    ))

    co.save_version(operator="老叶", change_summary="评审会前V1：V3.0图纸原始判断")

    co.override_judgement(
        item_code="STR-B-002",
        new_judgement="墙厚350mm，配C16@150（迎水面保护层加厚至50mm）",
        operator="老叶",
        reason="6月9日现场查看地下水位高于勘测报告，结构安全裕度不足，临时加厚外墙并加密配筋",
    )
    co.save_version(operator="老叶", change_summary="评审会前V2：老叶临时调整B区地下室外墙配筋")

    return co
