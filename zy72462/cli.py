#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from bike_dispatch import (
    create_case, import_grid_inspection, supplement_ramp,
    import_construction_notice, review_ramp, generate_report,
    get_ramp_by_id, set_display_mode,
    GridInspection, ConstructionNotice, ReviewStatus, Ramp,
    RectificationSuggestion, Evidence, EvidenceSource, ResponsibleRole, DispatchCase
)


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="共享单车潮汐调度系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    create_parser = subparsers.add_parser("create", help="创建新案件")
    create_parser.add_argument("title", help="案件标题")

    import_inspect_parser = subparsers.add_parser("import-inspection", help="导入网格员巡查表")
    import_inspect_parser.add_argument("case_id", help="案件ID")
    import_inspect_parser.add_argument("--json", help="巡查表JSON文件路径")

    supplement_parser = subparsers.add_parser("supplement-ramp", help="补录坡道信息")
    supplement_parser.add_argument("case_id", help="案件ID")
    supplement_parser.add_argument("ramp_id", help="坡道ID")
    supplement_parser.add_argument("--note", required=True, help="补录备注")
    supplement_parser.add_argument("--accessible", type=bool, help="是否无障碍")
    supplement_parser.add_argument("--bike-parking", type=bool, help="是否有单车停放区")

    import_notice_parser = subparsers.add_parser("import-notice", help="导入施工告示")
    import_notice_parser.add_argument("case_id", help="案件ID")
    import_notice_parser.add_argument("--json", help="施工告示JSON文件路径")
    import_notice_parser.add_argument("--reviewed", action="store_true", help="社区书记已审阅")

    review_parser = subparsers.add_parser("review", help="复核坡道")
    review_parser.add_argument("case_id", help="案件ID")
    review_parser.add_argument("ramp_id", help="坡道ID")
    review_parser.add_argument("--status", required=True, choices=["confirmed", "needs_supplement", "escalated", "pending"], help="复核状态")
    review_parser.add_argument("--note", default="", help="复核备注（可补充勘查记录、数量统计等说明，会自动识别为已提供材料）")

    report_parser = subparsers.add_parser("report", help="生成报告")
    report_parser.add_argument("case_id", help="案件ID")
    report_parser.add_argument("--format", choices=["text", "html"], default="text", help="报告格式")
    report_parser.add_argument("--output", help="输出文件路径")

    display_parser = subparsers.add_parser("display", help="设置展示模式")
    display_parser.add_argument("case_id", help="案件ID")
    display_parser.add_argument("--mode", choices=["list", "3d", "chart"], default="list", help="展示模式")

    list_parser = subparsers.add_parser("list", help="查看案件详情")
    list_parser.add_argument("case_id", help="案件ID")

    args = parser.parse_args()

    store = CaseStore()

    if args.command == "create":
        case = create_case(args.title)
        store.save(case)
        print(f"✅ 案件已创建")
        print(f"案件ID: {case.id}")
        print(f"案件标题: {case.title}")
        print(f"创建时间: {case.created_at.strftime('%Y-%m-%d %H:%M:%S')}")

    elif args.command == "import-inspection":
        case = store.load(args.case_id)
        if not case:
            print(f"❌ 案件不存在: {args.case_id}")
            sys.exit(1)
        
        if args.json:
            data = load_json(args.json)
        else:
            data = {}
            data["inspector_name"] = input("网格员姓名: ")
            data["location"] = input("巡查地点: ")
            data["notes"] = input("巡查备注: ")
            data["bike_overflow"] = input("是否共享单车堆积? (y/n): ").lower() == 'y'
            data["blocked_access"] = input("是否通道阻挡? (y/n): ").lower() == 'y'
            data["damaged_facilities"] = input("是否设施损坏? (y/n): ").lower() == 'y'
        
        inspection = GridInspection(
            id="",
            inspector_name=data.get("inspector_name", "未知"),
            inspection_date=datetime.now(),
            location=data.get("location", "未知"),
            bike_overflow=data.get("bike_overflow", False),
            blocked_access=data.get("blocked_access", False),
            damaged_facilities=data.get("damaged_facilities", False),
            notes=data.get("notes", "")
        )
        
        case = import_grid_inspection(case, inspection)
        store.save(case)
        print(f"✅ 巡查表已导入")
        print(f"巡查评分: {inspection.score:.1f}")
        print(f"生成坡道数量: {len(case.ramps)}")

    elif args.command == "supplement-ramp":
        case = store.load(args.case_id)
        if not case:
            print(f"❌ 案件不存在: {args.case_id}")
            sys.exit(1)
        
        ramp = supplement_ramp(
            case, args.ramp_id, args.note,
            is_accessible=args.accessible,
            has_bike_parking=args.bike_parking
        )
        
        if not ramp:
            print(f"❌ 坡道不存在: {args.ramp_id}")
            sys.exit(1)
        
        store.save(case)
        print(f"✅ 坡道补录完成")
        print(f"坡道位置: {ramp.location}")
        print(f"评分变化: {ramp.score_before:.1f} → {ramp.score_after:.1f}")
        if not ramp.score_changed:
            print(f"⚠️  评分无变化，已转交通协管复核")
        print(f"复核状态: {ramp.review_status.value}")

    elif args.command == "import-notice":
        case = store.load(args.case_id)
        if not case:
            print(f"❌ 案件不存在: {args.case_id}")
            sys.exit(1)
        
        if args.json:
            data = load_json(args.json)
        else:
            data = {}
            data["title"] = input("施工告示标题: ")
            data["location"] = input("施工地点: ")
            data["impact_description"] = input("影响描述: ")
            data["site_statement"] = input("现场说法: ")
        
        notice = ConstructionNotice(
            id="",
            title=data.get("title", "施工告示"),
            location=data.get("location", "未知"),
            start_date=datetime.now(),
            end_date=datetime.now(),
            impact_description=data.get("impact_description", ""),
            site_statement=data.get("site_statement", "")
        )
        
        case = import_construction_notice(case, notice, reviewed_by_secretary=args.reviewed)
        store.save(case)
        print(f"✅ 施工告示已导入")
        print(f"告示标题: {notice.title}")
        print(f"社区书记审阅: {'是' if notice.reviewed_by_secretary else '否'}")

    elif args.command == "review":
        case = store.load(args.case_id)
        if not case:
            print(f"❌ 案件不存在: {args.case_id}")
            sys.exit(1)
        
        status_map = {
            "confirmed": ReviewStatus.CONFIRMED,
            "needs_supplement": ReviewStatus.NEEDS_SUPPLEMENT,
            "escalated": ReviewStatus.ESCALATED,
            "pending": ReviewStatus.PENDING
        }
        
        ramp = review_ramp(case, args.ramp_id, status_map[args.status], note=args.note)
        if not ramp:
            print(f"❌ 坡道不存在: {args.ramp_id}")
            sys.exit(1)
        
        store.save(case)
        print(f"✅ 复核完成")
        print(f"坡道位置: {ramp.location}")
        print(f"新状态: {ramp.review_status.value}")
        if ramp.provided_materials:
            print(f"累计已提供材料: {', '.join(ramp.provided_materials)}")

    elif args.command == "report":
        case = store.load(args.case_id)
        if not case:
            print(f"❌ 案件不存在: {args.case_id}")
            sys.exit(1)
        
        report = generate_report(case, output_format=args.format)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(report)
            print(f"✅ 报告已保存到: {args.output}")
        else:
            print(report)

    elif args.command == "display":
        case = store.load(args.case_id)
        if not case:
            print(f"❌ 案件不存在: {args.case_id}")
            sys.exit(1)
        
        case = set_display_mode(case, args.mode)
        store.save(case)
        print(f"✅ 展示模式已设置为: {args.mode}")
        if args.mode in ["3d", "chart"]:
            print(f"💡 提示：在3D/图表模式下，点击坡道仍可返回原始巡查表或施工告示")

    elif args.command == "list":
        case = store.load(args.case_id)
        if not case:
            print(f"❌ 案件不存在: {args.case_id}")
            sys.exit(1)
        
        print(f"案件: {case.title} ({case.id})")
        print(f"展示模式: {case.display_mode}")
        print(f"")
        print(f"网格员巡查表: {len(case.grid_inspections)} 份")
        for insp in case.grid_inspections:
            print(f"  - {insp.inspector_name} @ {insp.location} (评分: {insp.score:.1f})")
        print(f"")
        print(f"施工告示: {len(case.construction_notices)} 份")
        for notice in case.construction_notices:
            print(f"  - {notice.title} @ {notice.location} (书记审阅: {'是' if notice.reviewed_by_secretary else '否'})")
        print(f"")
        print(f"坡道: {len(case.ramps)} 处（含先服务复核、材料对账）")
        for ramp in case.ramps:
            status_icon = "⚠️" if ramp.review_status == ReviewStatus.ESCALATED else "✓" if ramp.review_status == ReviewStatus.CONFIRMED else "🔍"
            changed = "有变" if ramp.score_changed else "不变"
            esc_tag = "[先服务复核→交通协管]" if ramp.review_status == ReviewStatus.ESCALATED else "[先服务复核→网格员补证]" if ramp.review_status == ReviewStatus.PENDING else ""
            print(f"  {status_icon} [{ramp.id}] {ramp.location} - {ramp.review_status.value} - 评分{changed} {esc_tag}")
            if ramp.provided_materials:
                print(f"      ✅ 已提供: {', '.join(ramp.provided_materials)}")
            for s in case.suggestions:
                if s.ramp_id == ramp.id:
                    if s.missing_materials:
                        print(f"      ❌ 还缺:  {', '.join(s.missing_materials)}")
                    if s.provided_materials and not ramp.provided_materials:
                        print(f"      ✅ 已提供: {', '.join(s.provided_materials)}")
                    print(f"      👤 责任人: {s.responsible_role.value} | 下一步: {s.next_step[:50]}...")
                    if s.evidence_trace:
                        print(f"      🔗 原始追溯（共{len(s.evidence_trace)}条）:")
                        for t in s.evidence_trace[:2]:
                            print(f"         - {t}")
                        if len(s.evidence_trace) > 2:
                            print(f"         - （还有 {len(s.evidence_trace)-2} 条，report 命令查看完整）")

    else:
        parser.print_help()


class CaseStore:
    def __init__(self):
        import os
        self.data_dir = os.path.join(os.getcwd(), "data")
        os.makedirs(self.data_dir, exist_ok=True)
    
    def _get_path(self, case_id):
        import os
        return os.path.join(self.data_dir, f"case_{case_id}.json")
    
    def save(self, case):
        import json
        data = self._case_to_dict(case)
        with open(self._get_path(case.id), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    
    def load(self, case_id):
        import json
        import os
        path = self._get_path(case_id)
        if not os.path.exists(path):
            return None
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return self._dict_to_case(data)
    
    def _case_to_dict(self, case):
        return {
            "id": case.id,
            "title": case.title,
            "created_at": case.created_at.isoformat(),
            "display_mode": case.display_mode,
            "status": case.status,
            "grid_inspections": [
                {
                    "id": i.id,
                    "inspector_name": i.inspector_name,
                    "inspection_date": i.inspection_date.isoformat(),
                    "location": i.location,
                    "bike_overflow": i.bike_overflow,
                    "blocked_access": i.blocked_access,
                    "damaged_facilities": i.damaged_facilities,
                    "notes": i.notes,
                    "score": i.score
                } for i in case.grid_inspections
            ],
            "construction_notices": [
                {
                    "id": n.id,
                    "title": n.title,
                    "location": n.location,
                    "start_date": n.start_date.isoformat(),
                    "end_date": n.end_date.isoformat(),
                    "impact_description": n.impact_description,
                    "site_statement": n.site_statement,
                    "reviewed_by_secretary": n.reviewed_by_secretary
                } for n in case.construction_notices
            ],
            "ramps": [
                {
                    "id": r.id,
                    "location": r.location,
                    "is_accessible": r.is_accessible,
                    "has_bike_parking": r.has_bike_parking,
                    "issues": r.issues,
                    "score_before": r.score_before,
                    "score_after": r.score_after,
                    "score_changed": r.score_changed,
                    "supplementary_note": r.supplementary_note,
                    "provided_materials": getattr(r, "provided_materials", []),
                    "review_status": r.review_status.value,
                    "status_history": getattr(r, "status_history", [])
                } for r in case.ramps
            ],
            "suggestions": [
                {
                    "id": s.id,
                    "ramp_id": s.ramp_id,
                    "issue_description": s.issue_description,
                    "why_kept": s.why_kept,
                    "missing_materials": s.missing_materials,
                    "provided_materials": getattr(s, "provided_materials", []),
                    "evidence_trace": getattr(s, "evidence_trace", []),
                    "next_step": s.next_step,
                    "responsible_role": s.responsible_role.value,
                    "priority": s.priority,
                    "updated_at": s.updated_at.isoformat()
                } for s in case.suggestions
            ],
            "evidences": [
                {
                    "source": e.source.value,
                    "description": e.description,
                    "recorded_at": e.recorded_at.isoformat(),
                    "recorded_by": e.recorded_by
                } for e in case.evidences
            ]
        }
    
    def _dict_to_case(self, data):
        from bike_dispatch.models import DispatchCase
        case = DispatchCase(
            id=data["id"],
            title=data["title"],
            created_at=datetime.fromisoformat(data["created_at"]),
            display_mode=data.get("display_mode", "list"),
            status=data.get("status", "active")
        )
        
        for i in data.get("grid_inspections", []):
            case.grid_inspections.append(GridInspection(
                id=i["id"],
                inspector_name=i["inspector_name"],
                inspection_date=datetime.fromisoformat(i["inspection_date"]),
                location=i["location"],
                bike_overflow=i["bike_overflow"],
                blocked_access=i["blocked_access"],
                damaged_facilities=i["damaged_facilities"],
                notes=i["notes"],
                score=i["score"]
            ))
        
        for n in data.get("construction_notices", []):
            case.construction_notices.append(ConstructionNotice(
                id=n["id"],
                title=n["title"],
                location=n["location"],
                start_date=datetime.fromisoformat(n["start_date"]),
                end_date=datetime.fromisoformat(n["end_date"]),
                impact_description=n["impact_description"],
                site_statement=n["site_statement"],
                reviewed_by_secretary=n["reviewed_by_secretary"]
            ))
        
        for r in data.get("ramps", []):
            case.ramps.append(Ramp(
                id=r["id"],
                location=r["location"],
                is_accessible=r["is_accessible"],
                has_bike_parking=r["has_bike_parking"],
                issues=r["issues"],
                score_before=r["score_before"],
                score_after=r["score_after"],
                score_changed=r["score_changed"],
                supplementary_note=r.get("supplementary_note", ""),
                provided_materials=r.get("provided_materials", []),
                review_status=ReviewStatus(r.get("review_status", "待复核")),
                status_history=r.get("status_history", [])
            ))
        
        for s in data.get("suggestions", []):
            case.suggestions.append(RectificationSuggestion(
                id=s["id"],
                ramp_id=s["ramp_id"],
                issue_description=s["issue_description"],
                why_kept=s["why_kept"],
                missing_materials=s["missing_materials"],
                provided_materials=s.get("provided_materials", []),
                evidence_trace=s.get("evidence_trace", []),
                next_step=s["next_step"],
                responsible_role=ResponsibleRole(s["responsible_role"]),
                priority=s.get("priority", 2),
                updated_at=datetime.fromisoformat(s["updated_at"])
            ))
        
        for e in data.get("evidences", []):
            case.evidences.append(Evidence(
                source=EvidenceSource(e["source"]),
                description=e["description"],
                recorded_at=datetime.fromisoformat(e["recorded_at"]),
                recorded_by=e["recorded_by"]
            ))
        
        return case


if __name__ == "__main__":
    main()
