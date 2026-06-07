import uuid
from typing import List, Tuple
from models import (
    DataStore, Complaint, Photo, Summary, AuditLog, CommunityAlias
)


def gen_id() -> str:
    return str(uuid.uuid4())[:8]


class MarketLoadingService:
    def __init__(self, store: DataStore = None):
        self.store = store or DataStore()

    def import_complaint(self, complaint_no: str, community_name: str,
                         content: str, raw_conclusion: str, operator: str) -> Tuple[Complaint, str]:
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

        return complaint, note

    def add_road_photo(self, complaint_id: str, file_name: str, uploaded_by: str) -> Photo:
        pid = gen_id()
        photo = Photo(
            id=pid,
            complaint_id=complaint_id,
            file_name=file_name,
            uploaded_by=uploaded_by
        )
        self.store.add_photo(photo)
        self.store.update_complaint(complaint_id, {"has_photo": True})
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="add_photo",
            complaint_id=complaint_id,
            operator=uploaded_by,
            detail=f"补录路口照片：{file_name}"
        ))
        return photo

    def generate_summary(self, complaint_id: str, why_kept: str,
                         missing_materials: List[str], next_step: str,
                         next_contact: str) -> Summary:
        existing = self.store.get_summaries(complaint_id)
        version = len(existing) + 1

        summary = Summary(
            id=gen_id(),
            complaint_id=complaint_id,
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
            complaint_id=complaint_id,
            operator="system",
            detail=f"生成摘要 v{version}，下一步：{next_step}，对接：{next_contact}"
        ))
        return summary

    def manual_correct(self, complaint_id: str, field: str, old_val: str,
                       new_val: str, operator: str) -> None:
        self.store.update_complaint(complaint_id, {field: new_val})
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="manual_correct",
            complaint_id=complaint_id,
            operator=operator,
            detail=f"人工修正 {field}: '{old_val}' → '{new_val}'"
        ))

    def rerun_summary(self, complaint_id: str) -> Summary:
        c = self.store.get_complaint(complaint_id)
        if not c:
            raise ValueError("投诉不存在")

        why_kept, missing, next_step, contact = self._decide_summary_parts(c)
        summary = self.generate_summary(
            complaint_id, why_kept, missing, next_step, contact
        )
        self.store.add_audit(AuditLog(
            id=gen_id(),
            action="rerun_summary",
            complaint_id=complaint_id,
            operator="system",
            detail=f"重跑摘要，照片状态：{'已补' if c['has_photo'] else '未补'}"
        ))
        return summary

    def _decide_summary_parts(self, complaint: dict) -> Tuple[str, List[str], str, str]:
        reasons = []
        missing = []
        next_step = ""
        contact = ""

        if complaint["need_review"]:
            reasons.append(f"小区名'{complaint['community_name']}'存在新旧名称映射，需复核")
            missing.append("市政巡检员对小区名称的复核确认")
            next_step = "请市政巡检员核实小区新旧名称对应关系"
            contact = "市政巡检员"
        else:
            reasons.append("结论与现场情况需核对，原始结论不能直接照抄")

        if not complaint["has_photo"]:
            missing.append("路口现场照片")
            reasons.append("缺少路口照片佐证")
            if not next_step:
                next_step = "请社区书记周姐补录路口照片后重新生成摘要"
                contact = "社区书记周姐"
        else:
            reasons.append("已有路口照片佐证，需结合照片重新判断")
            if not next_step:
                next_step = "照片已补，可提交街道或安排现场核查"
                contact = "社区书记周姐 / 街道城管"

        if not reasons:
            reasons.append("需进一步核实")

        return "；".join(reasons), missing, next_step or "待补充材料后推进", contact or "社区书记周姐"

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

    def get_complaint_detail(self, complaint_id: str) -> dict:
        c = self.store.get_complaint(complaint_id)
        if not c:
            return {}
        return {
            "complaint": c,
            "summaries": self.store.get_summaries(complaint_id),
            "audit_log": self.store.get_audit_log(complaint_id)
        }

    def get_street_summary_text(self, complaint_id: str) -> str:
        c = self.store.get_complaint(complaint_id)
        summaries = self.store.get_summaries(complaint_id)
        if not summaries:
            return "（未生成摘要）"
        s = summaries[-1]
        lines = [
            "=" * 50,
            f"📋 农贸市场装卸时窗 —— 给街道的摘要",
            f"投诉编号：{c['complaint_no']}",
            f"涉及小区：{c['community_name']}",
            f"当前状态：{c['status']}",
            "─" * 50,
            f"📍 为什么这条被留下：",
            f"    {s['why_kept']}",
            "",
            f"📎 还缺什么材料：",
        ]
        for m in s["missing_materials"]:
            lines.append(f"    □ {m}")
        lines.extend([
            "",
            f"🚶 下一步该找谁：{s['next_contact']}",
            f"📝 下一步做什么：{s['next_step']}",
            "",
            f"摘要版本：v{s['version']}",
            "=" * 50,
        ])
        return "\n".join(lines)
