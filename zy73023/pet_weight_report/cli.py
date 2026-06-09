import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

from .models import (
    FosteringRegistration,
    EvidenceMaterial,
    PetRecord,
    WeightReport,
    ProcessingStatus,
)
from .deduplicator import DeduplicationEngine
from .history import HistoryManager
from .classifier import StatusClassifier
from .exporter import ReportExporter


def _build_sample_dataset() -> Tuple[List[PetRecord], HistoryManager]:
    now = datetime.now()

    registrations = [
        FosteringRegistration(
            registration_id="REG-2026-001",
            pet_aliases=["胖胖", "橘座"],
            pet_type="橘猫",
            owner_name="张阿姨",
            owner_phone="138****1234",
            fostering_period="2026-05-01 至 2026-06-01",
            original_statement="寄养期间体重从7.5kg减到6.2kg，已达标，有前后称重照片",
            submitted_at=now - timedelta(days=8),
            source_channel="前台小温",
            batch_number="BATCH-第1批",
        ),
        FosteringRegistration(
            registration_id="REG-2026-002",
            pet_aliases=["豆豆", "小胖"],
            pet_type="柴犬",
            owner_name="李先生",
            owner_phone="139****5678",
            fostering_period="2026-05-05 至 2026-06-05",
            original_statement="柴犬豆豆从18kg减到16kg，照片晚些补，先登记",
            submitted_at=now - timedelta(days=7),
            source_channel="前台小温",
            batch_number="BATCH-第1批",
        ),
        FosteringRegistration(
            registration_id="REG-2026-003",
            pet_aliases=["咪咪", "小咪"],
            pet_type="英短",
            owner_name="王女士",
            owner_phone="137****9012",
            fostering_period="2026-05-10 至 2026-06-10",
            original_statement="咪咪从5.8kg减到5.0kg，已达标",
            submitted_at=now - timedelta(days=5),
            source_channel="前台小温",
            batch_number="BATCH-第2批",
        ),
        FosteringRegistration(
            registration_id="REG-2026-004",
            pet_aliases=["胖胖", "大胖"],
            pet_type="金毛",
            owner_name="陈先生",
            owner_phone="136****3456",
            fostering_period="2026-05-12 至 2026-06-12",
            original_statement="我家胖胖（金毛）从32kg减到29.5kg，目标是30kg，已过目标线",
            submitted_at=now - timedelta(days=4),
            source_channel="前台小温",
            batch_number="BATCH-第2批",
        ),
        FosteringRegistration(
            registration_id="REG-2026-005",
            pet_aliases=["球球", "团子"],
            pet_type="博美",
            owner_name="赵小姐",
            owner_phone="135****7890",
            fostering_period="2026-05-15 至 2026-06-15",
            original_statement="球球从4.2kg减到3.6kg，目标3.5kg，还差0.1kg，下周补",
            submitted_at=now - timedelta(days=2),
            source_channel="前台小温",
            batch_number="BATCH-第3批",
        ),
        FosteringRegistration(
            registration_id="REG-2026-006",
            pet_aliases=["豆豆"],
            pet_type="柯基",
            owner_name="刘大叔",
            owner_phone="134****2345",
            fostering_period="2026-05-18 至 2026-06-18",
            original_statement="柯基豆豆从15kg减到13.2kg，已达标，照片发在微信群里",
            submitted_at=now - timedelta(days=1),
            source_channel="前台小温",
            batch_number="BATCH-第3批",
        ),
    ]

    evidences_initial = {
        "REG-2026-001": [
            EvidenceMaterial(
                evidence_id="EVI-001-A",
                evidence_type="称重照片",
                file_path="/photos/2026-05/zhangs_orangecat_before.jpg",
                description="入托称重：7.5kg，5月1日",
                uploaded_at=now - timedelta(days=8),
                uploaded_by="前台小温",
                hash_value="sha256:a1b2c3d4",
                source_chat="微信群-寄养组",
            ),
            EvidenceMaterial(
                evidence_id="EVI-001-B",
                evidence_type="称重照片",
                file_path="/photos/2026-06/zhangs_orangecat_after.jpg",
                description="出托称重：6.2kg，6月1日",
                uploaded_at=now - timedelta(days=3),
                uploaded_by="前台小温",
                hash_value="sha256:e5f6g7h8",
                source_chat="微信群-寄养组",
            ),
        ],
        "REG-2026-002": [],
        "REG-2026-003": [
            EvidenceMaterial(
                evidence_id="EVI-003-A",
                evidence_type="称重照片",
                file_path="/photos/2026-05/wangs_brit_before.jpg",
                description="入托称重：5.8kg，5月10日",
                uploaded_at=now - timedelta(days=5),
                uploaded_by="前台小温",
                hash_value="sha256:11122233",
            ),
        ],
        "REG-2026-004": [
            EvidenceMaterial(
                evidence_id="EVI-004-A",
                evidence_type="称重照片",
                file_path="/photos/2026-05/chens_golden_before.jpg",
                description="入托称重：32kg，5月12日",
                uploaded_at=now - timedelta(days=4),
                uploaded_by="前台小温",
                hash_value="sha256:44455566",
            ),
            EvidenceMaterial(
                evidence_id="EVI-004-B",
                evidence_type="称重照片",
                file_path="/photos/2026-06/chens_golden_after.jpg",
                description="出托称重：29.5kg，6月12日",
                uploaded_at=now - timedelta(days=1),
                uploaded_by="前台小温",
                hash_value="sha256:77788899",
                source_chat="微信群-寄养组",
            ),
        ],
        "REG-2026-005": [],
        "REG-2026-006": [],
    }

    weight_params = [
        (7.5, 6.2, 6.5),
        (18.0, 17.8, 16.0),
        (5.8, 5.0, 5.2),
        (32.0, 29.5, 30.0),
        (4.2, 3.6, 3.5),
        (15.0, 13.2, 14.0),
    ]

    records = []
    for i, (reg, (iw, cw, tw)) in enumerate(zip(registrations, weight_params)):
        record = PetRecord(
            record_id=f"REC-{2026:04d}-{i + 1:03d}",
            fostering_registration=reg,
            initial_weight=iw,
            current_weight=cw,
            target_weight=tw,
            evidence_materials=evidences_initial[reg.registration_id],
        )
        if record.evidence_materials and not record.duplicate_issues:
            if record.is_target_met:
                record.current_status = ProcessingStatus.PASSED
            else:
                record.current_status = ProcessingStatus.NEED_EVIDENCE
        elif not record.evidence_materials:
            record.current_status = ProcessingStatus.NEED_EVIDENCE
        records.append(record)

    history_mgr = HistoryManager()

    late_evidence_002 = EvidenceMaterial(
        evidence_id="EVI-002-A",
        evidence_type="称重照片",
        file_path="/photos/2026-06/lis_shiba_after.jpg",
        description="柴犬豆豆出托称重：16.2kg，照片晚补（原说法16kg，核实为16.2kg仍超标）",
        uploaded_at=now - timedelta(hours=2),
        uploaded_by="前台小温",
        hash_value="sha256:999aaa88",
        source_chat="私信-李先生",
    )
    history_mgr.add_incremental_evidence(
        record=records[1],
        new_evidence=late_evidence_002,
        operator="前台小温",
        reason="柴犬豆豆照片分批次补到，原始登记未带照片，属于后补材料不覆盖早先判断",
        notes="实际称重16.2kg，原目标16.0kg，仍不达标，需再观察一周",
    )

    revision_evidence_005 = EvidenceMaterial(
        evidence_id="EVI-005-A",
        evidence_type="称重照片",
        file_path="/photos/2026-06/zhaos_pomeranian_recheck.jpg",
        description="补录最新称重：3.45kg，达成目标，之前3.6kg是上周数据",
        uploaded_at=now - timedelta(minutes=30),
        uploaded_by="项目经理",
        hash_value="sha256:bbbccc11",
        source_chat="微信群-寄养组",
    )
    history_mgr.revise_weight(
        record=records[4],
        new_current_weight=3.45,
        operator="项目经理",
        reason="补录6月14日最新称重，3.6kg为上周数据，最新照片显示3.45kg已达标",
        supporting_evidence=revision_evidence_005,
        notes="结论变化：从待补证据改为已放行，旧材料为口头描述（3.6kg），新材料为照片（3.45kg）",
    )

    chat_evidence_006 = EvidenceMaterial(
        evidence_id="EVI-006-A",
        evidence_type="聊天截图",
        file_path="/chats/2026-06/lius_corgi_wechat.png",
        description="微信群里找到的体重秤截图，与刘大叔说法吻合：13.2kg",
        uploaded_at=now - timedelta(minutes=15),
        uploaded_by="前台小温",
        hash_value="sha256:dddeee22",
        source_chat="微信群-寄养组-5月群",
    )
    history_mgr.add_incremental_evidence(
        record=records[5],
        new_evidence=chat_evidence_006,
        operator="前台小温",
        reason="从历史聊天里捞到散图，柯基豆豆的称重终于凑齐",
        notes="虽然别名豆豆和第2条柴犬重复，但柴犬已出托，柯基是另一只",
    )

    return records, history_mgr


def run_sample_pipeline(output_dir: str = "output") -> Dict[str, Any]:
    print("🐾 正在运行「宠物减重报告导出」整包样例流水线...")
    print("=" * 60)

    records, history_mgr = _build_sample_dataset()
    print(f"  ✅ 已加载寄养登记表分批次样例：共 {len(records)} 条记录")
    print(f"     批次：第1批2条 / 第2批2条 / 第3批2条（模拟分批凑齐）")

    dedup = DeduplicationEngine(normalize=True)
    duplicate_issues = dedup.process_records(records)
    print(f"  🔍 已完成宠物别名去重检测：发现 {len(duplicate_issues)} 个重复别名")
    for issue in duplicate_issues:
        print(f"     - 别名「{issue.alias}」卡在第{issue.first_found_index}行，"
              f"涉及：{'、'.join(issue.related_registration_ids)}")

    report = WeightReport(
        report_id=f"RPT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        generated_at=datetime.now(),
        records=records,
        all_duplicate_issues=duplicate_issues,
    )
    report.raw_registration_mapping = {
        r.fostering_registration.registration_id: r.record_id for r in records
    }

    classifier = StatusClassifier()
    interface = classifier.build_interface_response(report)
    summary = report.get_summary()
    print(f"  📊 状态分类结果：")
    print(f"     ✅ 已放行 {summary['已放行']} 条")
    print(f"     📸 待补证据 {summary['待补证据']} 条")
    print(f"     ✏️  人工改过 {summary['人工改过']} 条")
    print(f"     📛 异常(重复别名) {summary['异常记录']} 条")

    exporter = ReportExporter(output_dir=output_dir)
    output_paths = exporter.export_full_report(report)
    print(f"  💾 报告已导出到：{output_dir}/")
    for key, path in output_paths.items():
        print(f"     · {key}: {path}")

    exit_code = ReportExporter.print_exit_block(report)
    print("=" * 60)
    if exit_code == 0:
        print("🎉 「宠物减重报告导出」整包样例运行完成，无阻塞异常。")
    else:
        print("⚠️  运行完成，但存在必须人工处理的别名重复阻塞项（见上方）。")
        print("   处理要求：请先消除重复再放行，系统已标记为异常，未默默放行。")

    changed_count = sum(
        1 for r in records if history_mgr.has_conclusion_changed(r)
    )
    print(f"   📜 结论变化记录：{changed_count} 条，完整旧材料/新备注/改判原因已写入 改判历史.json")

    return {
        "report": report,
        "interface_response": interface,
        "output_paths": output_paths,
        "exit_code": exit_code,
        "duplicate_issues": duplicate_issues,
        "conclusion_changed_count": changed_count,
    }


def main() -> int:
    args = sys.argv[1:]
    output_dir = "output"
    if "--output" in args:
        idx = args.index("--output")
        if idx + 1 < len(args):
            output_dir = args[idx + 1]

    result = run_sample_pipeline(output_dir=output_dir)
    return result["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
