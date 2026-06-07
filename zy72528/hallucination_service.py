from typing import List, Dict, Optional, Tuple
from datetime import datetime
from models import SampleRecord, ConflictEvidence, HistoryRecord, SampleStatus, MaterialType
from importer import SampleImporter
from conflict_detector import ConflictDetector
from link_checker import LinkChecker
from self_check import SelfChecker
from errors import HallucinationMarkError, Link404Error


class HallucinationMarkService:
    def __init__(self):
        self.importer = SampleImporter()
        self.conflict_detector = ConflictDetector()
        self.link_checker = LinkChecker()

    def step1_import_prompt_version(
        self,
        sample_id: str,
        prompt_version: str,
        knowledge_link: str,
        material_type: str,
        hallucination_mark: bool,
        operator: str = "系统"
    ) -> Tuple[SampleRecord, Optional[ConflictEvidence]]:
        print(f"\n{'='*60}")
        print(f"【第一步】导入提示词版本号 - 样本 {sample_id}")
        print(f"{'='*60}")

        sample = self.importer.import_sample(
            sample_id=sample_id,
            prompt_version=prompt_version,
            knowledge_link=knowledge_link,
            material_type=material_type,
            hallucination_mark=hallucination_mark,
            operator=operator
        )

        print(f"✅ 导入成功：{sample_id}")
        print(f"   提示词版本: {sample.prompt_version}")
        print(f"   材料类型: {sample.material_type.value}")
        print(f"   幻觉标记: {'是' if sample.hallucination_mark else '否'}")
        print(f"   当前状态: {sample.status.value}")

        conflict = self.conflict_detector.detect_conflicts(sample)
        if conflict:
            sample.status = SampleStatus.CONFLICT
            self._add_history(
                sample_id,
                "冲突检测",
                SampleStatus.PENDING.value,
                SampleStatus.CONFLICT.value,
                "系统",
                f"检测到冲突：{conflict.conflict_type}"
            )
            print(f"\n⚠️  检测到冲突！")
            print(f"   冲突类型: {conflict.conflict_type}")
            print(f"   冲突描述: {conflict.description}")

        return sample, conflict

    def step2_review_knowledge_link(
        self,
        sample_id: str,
        operator: str = "算法运营老唐"
    ) -> Tuple[bool, Optional[str]]:
        print(f"\n{'='*60}")
        print(f"【第二步】算法运营老唐补看知识库引用链接 - 样本 {sample_id}")
        print(f"{'='*60}")

        sample = self.importer.get_sample(sample_id)
        print(f"📋 样本信息：")
        print(f"   样本ID: {sample.sample_id}")
        print(f"   知识库链接: {sample.knowledge_link}")
        print(f"   当前状态: {sample.status.value}")

        try:
            is_valid = self.link_checker.check_link(sample, auto_mark_status=True)
            print(f"✅ 链接检测通过：{sample.knowledge_link}")
            return True, None
        except Link404Error as e:
            print(f"⚠️  {e.friendly_message}")
            print(f"   状态已自动设为：待产品复核")
            return False, e.friendly_message

    def step3_update_conflict_table(
        self,
        sample_id: str,
        operator: str = "算法运营老唐"
    ) -> Optional[ConflictEvidence]:
        print(f"\n{'='*60}")
        print(f"【第三步】冲突样本表更新 - 样本 {sample_id}")
        print(f"{'='*60}")

        sample = self.importer.get_sample(sample_id)
        conflict = self.conflict_detector.get_conflict(sample_id)

        if sample.status == SampleStatus.NEED_PRODUCT_REVIEW:
            print(f"⏳ 样本 {sample_id} 当前是【待产品复核】状态")
            print(f"   原因：链接404，留给产品经理复核，暂不处理冲突")
            return None

        if conflict:
            print(f"\n📋 发现待处理冲突：")
            print(f"   冲突类型: {conflict.conflict_type}")
            print(f"   提示词版本证据: {conflict.prompt_evidence}")
            print(f"   知识库链接证据: {conflict.link_evidence}")
            print(f"   冲突描述: {conflict.description}")
            print(f"\n⚠️  请算法运营老唐选择处理方式：")
            print(f"   1 - 确认通过")
            print(f"   2 - 驳回")
            return conflict
        else:
            print(f"✅ 样本 {sample_id} 没有待处理的冲突")
            if sample.status == SampleStatus.PENDING:
                sample.status = SampleStatus.NORMAL
                self._add_history(
                    sample_id,
                    "状态更新",
                    SampleStatus.PENDING.value,
                    SampleStatus.NORMAL.value,
                    operator,
                    "无冲突，标记为正常"
                )
                print(f"   状态已更新为：正常")
            return None

    def resolve_conflict_manually(
        self,
        sample_id: str,
        confirm: bool,
        remark: str,
        operator: str = "算法运营老唐"
    ) -> ConflictEvidence:
        conflict = self.conflict_detector.resolve_conflict(
            sample_id=sample_id,
            resolution=remark,
            operator=operator,
            confirm=confirm
        )

        sample = self.importer.get_sample(sample_id)
        before_status = sample.status.value
        sample.status = SampleStatus.CONFIRMED if confirm else SampleStatus.REJECTED
        sample.remark = remark

        self._add_history(
            sample_id,
            "人工处理冲突",
            before_status,
            sample.status.value,
            operator,
            f"{'确认通过' if confirm else '驳回'}，备注：{remark}"
        )

        action = "确认通过" if confirm else "驳回"
        print(f"\n✅ 冲突已处理：{action}")
        print(f"   处理人: {operator}")
        print(f"   备注: {remark}")

        return conflict

    def run_full_workflow(
        self,
        sample_id: str,
        prompt_version: str,
        knowledge_link: str,
        material_type: str,
        hallucination_mark: bool,
        conflict_resolution: Optional[Tuple[bool, str]] = None
    ) -> Dict:
        print(f"\n{'#'*60}")
        print(f"# 开始处理样本: {sample_id}")
        print(f"{'#'*60}")

        result = {
            "sample_id": sample_id,
            "steps": [],
            "final_status": None,
            "conflict": None,
            "link_404": False
        }

        sample, conflict = self.step1_import_prompt_version(
            sample_id, prompt_version, knowledge_link, material_type, hallucination_mark
        )
        result["steps"].append("第一步：导入完成")
        result["conflict"] = conflict is not None

        link_ok, link_msg = self.step2_review_knowledge_link(sample_id)
        result["steps"].append("第二步：链接检查完成")
        result["link_404"] = not link_ok

        conflict_evidence = self.step3_update_conflict_table(sample_id)
        result["steps"].append("第三步：冲突表更新完成")

        if conflict_evidence and conflict_resolution:
            confirm, remark = conflict_resolution
            self.resolve_conflict_manually(sample_id, confirm, remark)
            result["steps"].append("冲突已人工处理")

        sample = self.importer.get_sample(sample_id)
        result["final_status"] = sample.status.value

        print(f"\n{'#'*60}")
        print(f"# 样本 {sample_id} 处理完成，最终状态：{sample.status.value}")
        print(f"{'#'*60}")

        return result

    def get_conflict_table(self) -> List[Dict]:
        conflicts = self.conflict_detector.get_all_conflicts(resolved=False)
        table = []
        for c in conflicts:
            sample = self.importer.get_sample(c.sample_id)
            table.append({
                "样本ID": c.sample_id,
                "冲突类型": c.conflict_type,
                "提示词版本": sample.prompt_version,
                "知识库链接": sample.knowledge_link,
                "材料类型": sample.material_type.value,
                "当前状态": sample.status.value,
                "冲突描述": c.description
            })
        return table

    def get_full_history(self, sample_id: str = None) -> List[HistoryRecord]:
        all_history = []
        all_history.extend(self.importer.get_history(sample_id))
        all_history.extend(self.conflict_detector.get_history(sample_id))
        all_history.extend(self.link_checker.get_history(sample_id))
        all_history.sort(key=lambda x: x.timestamp)
        return all_history

    def run_self_check(self) -> str:
        checker = SelfChecker(
            self.importer.samples,
            self.get_full_history()
        )
        return checker.generate_report()

    def export_data(self) -> List[Dict]:
        return [s.to_dict() for s in self.importer.get_all_samples()]

    def _add_history(
        self,
        sample_id: str,
        action: str,
        before_status: str,
        after_status: str,
        operator: str,
        detail: str
    ):
        self.importer._add_history(
            sample_id, action, before_status, after_status, operator, detail
        )
