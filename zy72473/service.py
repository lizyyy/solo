import uuid
from typing import List, Tuple, Dict
from datetime import datetime
from models import (
    DataStore, Complaint, Photo, Summary, AuditLog, CommunityAlias
)


def gen_id() -> str:
    return str(uuid.uuid4())[:8]


def _now() -> str:
    return datetime.now().isoformat()


class MarketLoadingService:
    def __init__(self, store: DataStore = None):
        self.store = store or DataStore()

    def _resolve_cid(self, cid_or_no: str) -> str:
        c = self.store.get_complaint(cid_or_no)
        if not c:
            raise ValueError(f"投诉 {cid_or_no} 不存在")
        return c["id"]

    def import_complaint(self, complaint_no: str, community_name: str,
                         content: str, raw_conclusion: str, operator: str) -> Tuple[Complaint, str, dict]:
        cid = gen_id()
        complaint = Complaint(
            id=cid,
            complaint_no=complaint_no,
            community_name=community_name,
            content=content,
            raw_conclusion=raw_conclusion,
            status="imported"
        )

        alias = self.store.check_alias(community_name)
        if alias:
            complaint.need_review = True
            complaint.review_note = f"小区名'{community_name}'存在新旧名称映射，需市政巡检员复核"
            complaint.status = "need_muni_review"

        self.store.add_complaint(complaint)
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="import",
            complaint_id=cid,
            operator=operator,
            detail=f"导入投诉 {complaint_no}，小区：{community_name}"
        ))

        note = ""
        if complaint.need_review:
            note = f"⚠️  注意：小区'{community_name}'存在新旧名称映射，已标记待市政巡检员复核，不直接归为正常"

        self._assess_missing_materials(cid)
        self.rerun_summary(cid)

        report = self._build_import_report(cid)
        return complaint, note, report

    def _assess_missing_materials(self, cid: str) -> None:
        c = self.store.get_complaint(cid)
        materials = []

        if not c["has_photo"]:
            materials.append({
                "name": "路口现场照片",
                "source": "投诉处理规范：需路口照片佐证现场情况",
                "status": "待补",
                "resolved_by": "",
                "resolved_at": ""
            })

        if c["need_review"]:
            materials.append({
                "name": "市政巡检员对小区名称的复核确认",
                "source": f"小区名'{c['community_name']}'存在新旧名称映射，需复核确认",
                "status": "待补",
                "resolved_by": "",
                "resolved_at": ""
            })

        materials.append({
            "name": "人工复核原始结论",
            "source": "系统原始结论不能直接照抄，需人工复核确认",
            "status": "待补",
            "resolved_by": "",
            "resolved_at": ""
        })

        self.store.update_complaint(cid, {"missing_materials": materials})

    def resolve_missing_material(self, cid_or_no: str, material_name: str,
                                 operator: str, remark: str = "") -> None:
        cid = self._resolve_cid(cid_or_no)
        c = self.store.get_complaint(cid)
        materials = c.get("missing_materials", [])
        found = False
        for m in materials:
            if m["name"] == material_name and m["status"] == "待补":
                m["status"] = "已补"
                m["resolved_by"] = operator
                m["resolved_at"] = _now()
                if remark:
                    m["remark"] = remark
                found = True
                break

        if not found:
            raise ValueError(f"未找到待补的材料：{material_name}")

        self.store.update_complaint(cid, {"missing_materials": materials})
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="resolve_material",
            complaint_id=cid,
            operator=operator,
            detail=f"补录缺失材料：{material_name}" + (f"（{remark}）" if remark else "")
        ))

        if material_name == "路口现场照片":
            pass
        if material_name == "市政巡检员对小区名称的复核确认":
            self.store.update_complaint(cid, {"need_review": False, "review_note": "已复核"})

        self.rerun_summary(cid)

    def add_road_photo(self, cid_or_no: str, file_name: str, uploaded_by: str) -> Photo:
        cid = self._resolve_cid(cid_or_no)
        pid = gen_id()
        photo = Photo(
            id=pid,
            complaint_id=cid,
            file_name=file_name,
            uploaded_by=uploaded_by
        )
        self.store.add_photo(photo)
        self.store.update_complaint(cid, {"has_photo": True})
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="add_photo",
            complaint_id=cid,
            operator=uploaded_by,
            detail=f"补录路口照片：{file_name}"
        ))

        self.resolve_missing_material(cid, "路口现场照片", uploaded_by, f"照片文件：{file_name}")
        return photo

    def generate_summary(self, cid_or_no: str, why_kept: str,
                         missing_materials: List[str], next_step: str,
                         next_contact: str) -> Summary:
        cid = self._resolve_cid(cid_or_no)
        existing = self.store.get_summaries(cid)
        version = len(existing) + 1

        summary = Summary(
            id=gen_id(),
            complaint_id=cid,
            why_kept=why_kept,
            missing_materials=missing_materials,
            next_step=next_step,
            next_contact=next_contact,
            version=version
        )
        self.store.add_summary(summary)
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="generate_summary",
            complaint_id=cid,
            operator="system",
            detail=f"生成摘要 v{version}，下一步：{next_step}，对接：{next_contact}"
        ))
        return summary

    def manual_correct(self, cid_or_no: str, field: str, old_val: str,
                       new_val: str, operator: str) -> None:
        cid = self._resolve_cid(cid_or_no)
        self.store.update_complaint(cid, {field: new_val})
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="manual_correct",
            complaint_id=cid,
            operator=operator,
            detail=f"人工修正 {field}: '{old_val}' → '{new_val}'"
        ))

        if field == "raw_conclusion":
            try:
                self.resolve_missing_material(cid, "人工复核原始结论", operator, "原始结论已人工复核")
            except ValueError:
                pass

    def rerun_summary(self, cid_or_no: str) -> Summary:
        cid = self._resolve_cid(cid_or_no)
        c = self.store.get_complaint(cid)
        if not c:
            raise ValueError("投诉不存在")

        why_kept, missing, next_step, contact = self._decide_summary_parts(c)
        summary = self.generate_summary(
            cid, why_kept, missing, next_step, contact
        )
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="rerun_summary",
            complaint_id=cid,
            operator="system",
            detail=f"重跑摘要，照片状态：{'已补' if c['has_photo'] else '未补'}，待补材料：{len([m for m in c.get('missing_materials',[]) if m['status']=='待补'])}项"
        ))
        return summary

    def _decide_summary_parts(self, complaint: dict) -> Tuple[str, List[str], str, str]:
        reasons = []
        missing = []
        next_step = ""
        contact = ""

        for m in complaint.get("missing_materials", []):
            if m["status"] == "待补":
                missing.append(m["name"])

        if complaint["need_review"]:
            reasons.append(f"小区名'{complaint['community_name']}'存在新旧名称映射，需复核")
        else:
            reasons.append("结论与现场情况需核对，原始结论不能直接照抄")

        if not complaint["has_photo"]:
            reasons.append("缺少路口照片佐证")
        else:
            reasons.append("已有路口照片佐证，需结合照片重新判断")

        if not reasons:
            reasons.append("需进一步核实")

        if "市政巡检员对小区名称的复核确认" in missing:
            next_step = "请市政巡检员核实小区新旧名称对应关系"
            contact = "市政巡检员"
        elif "路口现场照片" in missing:
            next_step = "请社区书记周姐补录路口照片后重新生成摘要"
            contact = "社区书记周姐"
        elif "人工复核原始结论" in missing:
            next_step = "请社区书记周姐人工复核原始结论后重新生成摘要"
            contact = "社区书记周姐"
        elif len(missing) > 0:
            next_step = "请补全剩余缺失材料后推进"
            contact = "社区书记周姐"
        else:
            next_step = "材料已补全，可提交街道或安排现场核查"
            contact = "社区书记周姐 / 街道城管"

        return "；".join(reasons), missing, next_step, contact

    def register_community_alias(self, old_name: str, new_name: str) -> CommunityAlias:
        alias = CommunityAlias(old_name=old_name, new_name=new_name)
        self.store.set_community_alias(alias)
        return alias

    def confirm_alias(self, old_name: str, new_name: str, operator: str) -> None:
        key = f"{old_name}->{new_name}"
        if key in self.store._data["communities"]:
            self.store._data["communities"][key]["confirmed"] = True
            self.store.save()
            self.store.add_audit(AuditLog(
                id=gen_id(),
                action="confirm_alias",
                complaint_id="system",
                operator=operator,
                detail=f"确认小区别名：{old_name} = {new_name}"
            ))

    def _build_import_report(self, cid: str) -> dict:
        c = self.store.get_complaint(cid)
        materials = c.get("missing_materials", [])
        summaries = self.store.get_summaries(cid)
        latest_summary = summaries[-1] if summaries else None

        return {
            "complaint_no": c["complaint_no"],
            "community_name": c["community_name"],
            "status": c["status"],
            "raw_conclusion": c["raw_conclusion"],
            "conclusion_note": "原始结论不能直接照抄，需人工复核确认",
            "missing_materials": [
                {
                    "name": m["name"],
                    "source": m["source"],
                    "status": m["status"]
                }
                for m in materials
            ],
            "pending_count": len([m for m in materials if m["status"] == "待补"]),
            "summary": latest_summary,
            "why_kept": latest_summary["why_kept"] if latest_summary else "",
            "next_step": latest_summary["next_step"] if latest_summary else "",
            "next_contact": latest_summary["next_contact"] if latest_summary else "",
        }

    def get_complaint_detail(self, cid_or_no: str) -> dict:
        cid = self._resolve_cid(cid_or_no)
        c = self.store.get_complaint(cid)
        if not c:
            return {}
        return {
            "complaint": c,
            "summaries": self.store.get_summaries(cid),
            "audit_log": self.store.get_audit_log(cid),
            "missing_materials": c.get("missing_materials", [])
        }

    def get_street_summary_text(self, cid_or_no: str) -> str:
        cid = self._resolve_cid(cid_or_no)
        c = self.store.get_complaint(cid)
        summaries = self.store.get_summaries(cid)
        if not summaries:
            return "（未生成摘要）"
        s = summaries[-1]
        lines = [
            "=" * 56,
            f"📋 农贸市场装卸时窗 —— 给街道的摘要",
            f"投诉编号：{c['complaint_no']}",
            f"涉及小区：{c['community_name']}",
            f"当前状态：{c['status']}",
            "─" * 56,
            f"📍 为什么这条被留下：",
            f"    {s['why_kept']}",
            "",
            f"📎 还缺什么材料（共{len(s['missing_materials'])}项待补）：",
        ]
        for m in s["missing_materials"]:
            lines.append(f"    □ {m}")
        lines.extend([
            "",
            f"🚶 下一步该找谁：{s['next_contact']}",
            f"📝 下一步做什么：{s['next_step']}",
            "",
            f"摘要版本：v{s['version']}",
            "=" * 56,
        ])
        return "\n".join(lines)

    def get_import_report_text(self, cid_or_no: str) -> str:
        cid = self._resolve_cid(cid_or_no)
        report = self._build_import_report(cid)
        lines = [
            "=" * 60,
            f"📄 居民投诉首次导入报告",
            f"投诉编号：{report['complaint_no']}",
            f"涉及小区：{report['community_name']}",
            f"当前状态：{report['status']}",
            "─" * 60,
            f"🔍 原始结论：",
            f"    {report['raw_conclusion']}",
            f"    ⚠️  {report['conclusion_note']}",
            "",
            f"📦 还缺什么材料（待补 {report['pending_count']} 项）：",
        ]
        for i, m in enumerate(report["missing_materials"], 1):
            status_icon = "□" if m["status"] == "待补" else "■"
            lines.append(f"  {status_icon} 材料{i}：{m['name']}")
            lines.append(f"     来源：{m['source']}")
            lines.append(f"     状态：{m['status']}")
        lines.extend([
            "",
            "─" * 60,
            f"📌 为什么这条被留下：{report['why_kept']}",
            f"👤 下一步对接：{report['next_contact']}",
            f"🎯 下一步动作：{report['next_step']}",
            "=" * 60,
        ])
        return "\n".join(lines)
