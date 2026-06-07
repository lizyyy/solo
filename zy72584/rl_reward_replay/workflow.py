import uuid
from typing import Optional, Dict, List, Tuple
from datetime import datetime

from .models import (
    ReplaySession,
    YamlParams,
    EvalSlice,
    ExplainableSummary,
    ReviewStatus,
    FeatureStatus,
    ResponsibleRole,
)
from .yaml_parser import YamlParser
from .slice_importer import SliceImporter
from .summary_engine import SummaryEngine
from .visualizer import Visualizer


class ReplayWorkflow:
    def __init__(self, session_id: Optional[str] = None):
        self.session = ReplaySession(
            session_id=session_id or f"session_{uuid.uuid4().hex[:8]}",
            current_step=0,
        )
        self.yaml_parser = YamlParser()
        self.slice_importer = SliceImporter()
        self.summary_engine = SummaryEngine()
        self.visualizer = Visualizer()

    def step1_import_yaml(self, yaml_path: str) -> Tuple[YamlParams, List[str]]:
        print(f"\n{'='*60}")
        print(f"📋 第一步: 导入参数 YAML - {yaml_path}")
        print(f"{'='*60}")

        params = self.yaml_parser.parse(yaml_path)
        errors = self.yaml_parser.validate(params)

        if errors:
            print(f"⚠️  YAML 参数校验发现问题:")
            for err in errors:
                print(f"   - {err}")
        else:
            print(f"✅ YAML 参数校验通过")

        self.session.yaml_params = params
        self.slice_importer.set_yaml_params(params)
        self.summary_engine.set_yaml_params(params)
        self.visualizer.set_yaml_params(params)
        self.session.current_step = 1

        print(f"   模型名称: {params.model_name}")
        print(f"   特征数量: {len(params.feature_list)}")
        print(f"   特征列表: {', '.join(params.feature_list)}")
        print(f"   版本: {params.version}")

        return params, errors

    def step2_import_slices(self, slice_path: str, file_type: str = "json") -> Dict[str, EvalSlice]:
        if self.session.current_step < 1:
            raise RuntimeError("请先执行第一步：导入参数 YAML")

        print(f"\n{'='*60}")
        print(f"📊 第二步: 导入评测切片 - {slice_path}")
        print(f"{'='*60}")

        if file_type == "json":
            slices = self.slice_importer.import_from_json(slice_path)
        elif file_type == "csv":
            slices = self.slice_importer.import_from_csv(slice_path)
        else:
            raise ValueError(f"不支持的文件类型: {file_type}")

        self.session.eval_slices = slices
        self.session.current_step = 2

        report = self.slice_importer.generate_missing_report(slices)

        print(f"✅ 成功导入 {report['total_slices']} 条评测切片")
        print(f"   其中 {report['slices_with_missing']} 条存在特征缺失问题 (占比 {report['missing_ratio']:.1%})")

        if report["feature_missing_counts"]:
            print(f"\n🔍 特征缺失统计:")
            for feat_name, count in report["feature_missing_counts"].items():
                print(f"   - {feat_name}: {count} 次")

        missing_slices = self.slice_importer.get_slices_with_missing_features(slices)
        if missing_slices:
            print(f"\n⚠️  注意: 以下切片存在线上特征缺失但给了默认分的情况")
            print(f"   别急着归正常，先标记出来留给推荐负责人复核")
            for s in missing_slices[:5]:
                missing_feats = [f.name for f in s.missing_features]
                print(f"   - {s.slice_id}: 缺失特征 {missing_feats}")
            if len(missing_slices) > 5:
                print(f"   ... 还有 {len(missing_slices) - 5} 条")

        summaries = self.summary_engine.batch_generate_summaries(slices)
        self.session.summaries = summaries

        print(f"\n📝 已为所有切片生成可解释摘要")
        return {s.slice_id: s for s in slices}

    def step3_xiaoqiao_review(
        self,
        slice_id: str,
        reviewer_notes: str,
        update_features: Optional[Dict[str, any]] = None,
    ) -> Tuple[EvalSlice, ExplainableSummary]:
        if self.session.current_step < 2:
            raise RuntimeError("请先执行第二步：导入评测切片")

        print(f"\n{'='*60}")
        print(f"👩‍💻 第三步: 算法工程师小乔复核切片 - {slice_id}")
        print(f"{'='*60}")

        slice_data = next((s for s in self.session.eval_slices if s.slice_id == slice_id), None)
        if not slice_data:
            raise ValueError(f"未找到切片: {slice_id}")

        old_summary = self.session.summaries.get(slice_id)

        if update_features:
            for feat_name, new_value in update_features.items():
                if feat_name in slice_data.features:
                    feat = slice_data.features[feat_name]
                    feat.actual_value = new_value
                    if new_value is not None:
                        feat.status = FeatureStatus.NORMAL
                        feat.confidence_score = 1.0
                    print(f"   ✅ 补录特征 {feat_name}: {feat.default_value} -> {new_value}")

        slice_data.review_status = ReviewStatus.REVIEWED_BY_XIAOQIAO
        slice_data.reviewer_notes = reviewer_notes

        new_summary = self.summary_engine.regenerate_after_review(
            slice_data, old_summary, reviewer_notes
        )
        self.session.summaries[slice_id] = new_summary

        print(f"\n📝 小乔复核意见: {reviewer_notes}")
        print(f"\n📋 更新后的可解释摘要:")
        print(f"   为什么保留: {new_summary.why_kept}")
        print(f"   缺失材料:")
        for mat in new_summary.missing_materials:
            print(f"      - {mat}")
        print(f"   下一步: {new_summary.next_step}")
        print(f"   负责人: {new_summary.responsible_person.value}")

        if slice_data.has_missing_features:
            print(f"\n⚠️  仍有特征缺失，留给推荐负责人复核，不急着归正常")
        else:
            print(f"\n✅ 特征已补全，转推荐负责人确认")

        self.session.current_step = 3
        return slice_data, new_summary

    def rec_leader_review(
        self,
        slice_id: str,
        approved: bool,
        leader_notes: str = "",
    ) -> Tuple[EvalSlice, ExplainableSummary]:
        slice_data = next((s for s in self.session.eval_slices if s.slice_id == slice_id), None)
        if not slice_data:
            raise ValueError(f"未找到切片: {slice_id}")

        old_summary = self.session.summaries.get(slice_id)

        if approved:
            slice_data.review_status = ReviewStatus.CONFIRMED_BY_REC_LEADER
            status_text = "✅ 推荐负责人已确认通过"
        else:
            slice_data.review_status = ReviewStatus.NEEDS_FOLLOWUP
            status_text = "⚠️ 推荐负责人标记为需跟进"

        print(f"\n{'='*60}")
        print(f"👔 推荐负责人复核 - {slice_id}")
        print(f"{'='*60}")
        print(f"   {status_text}")
        if leader_notes:
            print(f"   意见: {leader_notes}")

        new_summary = self.summary_engine.regenerate_after_review(
            slice_data, old_summary, leader_notes
        )
        self.session.summaries[slice_id] = new_summary

        print(f"\n   下一步: {new_summary.next_step}")
        return slice_data, new_summary

    def generate_dashboard(self, output_path: str) -> str:
        if self.session.current_step < 2:
            raise RuntimeError("请先导入评测切片后再生成看板")

        print(f"\n📊 生成服务复核看板 -> {output_path}")
        return self.visualizer.create_dashboard(
            self.session.eval_slices,
            self.session.summaries,
            output_path,
        )

    def get_summary(self, slice_id: str) -> Optional[ExplainableSummary]:
        return self.session.summaries.get(slice_id)

    def get_all_summaries(self) -> Dict[str, ExplainableSummary]:
        return self.session.summaries

    def get_slices_with_missing(self) -> List[EvalSlice]:
        return [s for s in self.session.eval_slices if s.has_missing_features]

    def print_summary_report(self):
        print(f"\n{'='*60}")
        print(f"📑 强化学习奖励回放 - 复核报告")
        print(f"{'='*60}")
        print(f"会话ID: {self.session.session_id}")
        print(f"当前步骤: 第{self.session.current_step}步")
        if self.session.yaml_params:
            print(f"模型: {self.session.yaml_params.model_name}")
        print(f"切片总数: {len(self.session.eval_slices)}")

        missing_slices = self.get_slices_with_missing()
        print(f"有特征缺失的切片: {len(missing_slices)}")

        if missing_slices:
            print(f"\n{'='*60}")
            print(f"🔴 需要重点关注的切片 (特征缺失用了默认分):")
            print(f"{'='*60}")
            for s in missing_slices:
                summary = self.session.summaries.get(s.slice_id)
                print(f"\n--- 切片 {s.slice_id} ---")
                print(f"   时间: {s.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"   实际奖励: {s.reward_score:.4f}, 预测奖励: {s.predicted_reward:.4f}")
                print(f"   缺失特征:")
                for f in s.missing_features:
                    status = "有默认值" if f.status == FeatureStatus.MISSING_WITH_DEFAULT else "无默认值"
                    print(f"      - {f.name}: {status}, 默认={f.default_value}")
                if summary:
                    print(f"   为什么保留: {summary.why_kept}")
                    print(f"   下一步: {summary.next_step}")
                    print(f"   负责人: {summary.responsible_person.value}")

        print(f"\n{'='*60}\n")

    def run_full_workflow(
        self,
        yaml_path: str,
        slice_path: str,
        slice_file_type: str = "json",
        review_slice_id: Optional[str] = None,
        xiaoqiao_notes: str = "",
        dashboard_path: Optional[str] = None,
    ):
        print(f"\n🚀 开始执行完整工作流 (三步流程)")
        print(f"   目标: YAML导入 → 切片导入 → 小乔复核 → 摘要更新")

        self.step1_import_yaml(yaml_path)
        self.step2_import_slices(slice_path, slice_file_type)

        if review_slice_id is None:
            missing = self.get_slices_with_missing()
            if missing:
                review_slice_id = missing[0].slice_id
                print(f"\n💡 自动选择第一条有特征缺失的切片进行复核: {review_slice_id}")
            else:
                review_slice_id = self.session.eval_slices[0].slice_id

        if not xiaoqiao_notes:
            xiaoqiao_notes = "已核对该切片，发现有特征缺失用了默认分，需要推荐负责人确认默认分是否可接受，或安排补数据"

        self.step3_xiaoqiao_review(review_slice_id, xiaoqiao_notes)

        if dashboard_path:
            self.generate_dashboard(dashboard_path)

        self.print_summary_report()
        print(f"✅ 工作流完成！中间碰到线上特征缺失却给了默认分时，已留给推荐负责人复核")
