from typing import List, Optional
from datetime import datetime
from .models import (
    EvalSlice,
    FeatureStatus,
    ExplainableSummary,
    ActionItem,
    ResponsibleRole,
    YamlParams,
    ReviewStatus,
)


class SummaryEngine:
    def __init__(self, yaml_params: Optional[YamlParams] = None):
        self.yaml_params = yaml_params

    def set_yaml_params(self, yaml_params: YamlParams):
        self.yaml_params = yaml_params

    def generate_summary(
        self,
        slice_data: EvalSlice,
        review_note: str = "",
    ) -> ExplainableSummary:
        why_kept = self._explain_why_kept(slice_data)
        missing_materials = self._list_missing_materials(slice_data)
        next_step, responsible = self._determine_next_step(slice_data)
        feature_insights = self._generate_feature_insights(slice_data)
        action_items = self._generate_action_items(slice_data)

        return ExplainableSummary(
            slice_id=slice_data.slice_id,
            why_kept=why_kept,
            missing_materials=missing_materials,
            next_step=next_step,
            responsible_person=responsible,
            feature_insights=feature_insights,
            action_items=action_items,
            generated_at=datetime.now(),
            review_note=review_note,
        )

    def regenerate_after_review(
        self,
        slice_data: EvalSlice,
        old_summary: ExplainableSummary,
        reviewer_notes: str = "",
    ) -> ExplainableSummary:
        new_summary = self.generate_summary(slice_data, reviewer_notes)

        if slice_data.review_status == ReviewStatus.REVIEWED_BY_XIAOQIAO and reviewer_notes:
            new_summary.review_note = f"【小乔复核】{reviewer_notes}"
            if not slice_data.has_missing_features:
                new_summary.next_step = "特征补全完成，推荐负责人可确认通过或继续提优化建议"
                new_summary.responsible_person = ResponsibleRole.REC_LEADER
            else:
                new_summary.next_step = "小乔已标记，仍有特征缺失问题，转推荐负责人复核是否可接受或需补数据"
                new_summary.responsible_person = ResponsibleRole.REC_LEADER

        elif slice_data.review_status == ReviewStatus.CONFIRMED_BY_REC_LEADER:
            new_summary.next_step = "推荐负责人已确认，切片可用于奖励回放或标记为待跟进"
            new_summary.responsible_person = ResponsibleRole.ALGORITHM_ENGINEER

        return new_summary

    def _explain_why_kept(self, slice_data: EvalSlice) -> str:
        reasons = []

        reward_diff = slice_data.reward_score - slice_data.predicted_reward
        if abs(reward_diff) > 0.1:
            if reward_diff > 0:
                reasons.append(f"实际奖励(%.3f)比预测(%.3f)高 %.3f，属于正向偏离样本，保留用于分析模型低估原因" % (
                    slice_data.reward_score, slice_data.predicted_reward, reward_diff
                ))
            else:
                reasons.append(f"实际奖励(%.3f)比预测(%.3f)低 %.3f，属于负向偏离样本，保留用于分析模型高估风险" % (
                    slice_data.reward_score, slice_data.predicted_reward, abs(reward_diff)
                ))

        if slice_data.has_missing_features:
            missing_count = len(slice_data.missing_features)
            missing_default = [f for f in slice_data.missing_features if f.status == FeatureStatus.MISSING_WITH_DEFAULT]
            if missing_default:
                reasons.append(f"有 {len(missing_default)} 个线上特征缺失但使用了默认值计算奖励，需确认默认分是否合理，不建议直接归为正常")
            else:
                reasons.append(f"有 {missing_count} 个特征完全缺失无默认值，奖励计算可能不准确，需重点复核")

        if len(reasons) == 0:
            if slice_data.reward_score > 0.7:
                reasons.append("高奖励样本，作为正例保留")
            elif slice_data.reward_score < 0.3:
                reasons.append("低奖励样本，作为负例保留")
            else:
                reasons.append("中等奖励样本，作为基准参考保留")

        return "；".join(reasons)

    def _list_missing_materials(self, slice_data: EvalSlice) -> List[str]:
        materials = []

        if not self.yaml_params:
            materials.append("尚未加载参数YAML，无法校验特征完整性和权重配置")
        else:
            for feat in slice_data.missing_features:
                feat_desc = feat.description or feat.name
                if feat.status == FeatureStatus.MISSING_WITH_DEFAULT:
                    materials.append(f"特征[{feat_desc}({feat.name})]：线上缺失，当前用默认值 {feat.default_value} 计算，需补真实线上值")
                else:
                    materials.append(f"特征[{feat_desc}({feat.name})]：完全缺失且无默认配置，需补充特征定义或线上数据")

        if slice_data.review_status == ReviewStatus.PENDING:
            materials.append("缺少算法工程师小乔的复核意见")

        return materials

    def _determine_next_step(self, slice_data: EvalSlice) -> tuple[str, ResponsibleRole]:
        if not self.yaml_params:
            return "先导入参数YAML确认特征配置和权重", ResponsibleRole.ALGORITHM_ENGINEER

        if not slice_data.has_missing_features:
            if slice_data.review_status == ReviewStatus.PENDING:
                return "特征完整，算法工程师小乔可先复核样本是否有其他异常", ResponsibleRole.ALGORITHM_ENGINEER
            elif slice_data.review_status == ReviewStatus.REVIEWED_BY_XIAOQIAO:
                return "小乔已复核，推荐负责人确认是否可用于奖励回放", ResponsibleRole.REC_LEADER
            else:
                return "已完成复核，可纳入奖励回放大池", ResponsibleRole.ALGORITHM_ENGINEER

        missing_default = [f for f in slice_data.missing_features if f.status == FeatureStatus.MISSING_WITH_DEFAULT]

        if missing_default:
            if slice_data.review_status == ReviewStatus.PENDING:
                return "有特征缺失用了默认值，算法工程师小乔先补看评测切片、确认默认分合理性，别急着归正常", ResponsibleRole.ALGORITHM_ENGINEER
            elif slice_data.review_status == ReviewStatus.REVIEWED_BY_XIAOQIAO:
                return "小乔已补看，推荐负责人复核：默认分是否可接受？是否需要数据工程补线上特征？", ResponsibleRole.REC_LEADER
            else:
                return "推荐负责人已确认，按结论执行（接受默认/补数据/丢弃）", ResponsibleRole.ALGORITHM_ENGINEER
        else:
            if slice_data.review_status == ReviewStatus.PENDING:
                return "特征完全缺失，算法工程师小乔先核查是否为新特征未上线", ResponsibleRole.ALGORITHM_ENGINEER
            else:
                return "需要数据工程排查特征链路，或推荐负责人确认是否丢弃该样本", ResponsibleRole.DATA_ENGINEER

    def _generate_feature_insights(self, slice_data: EvalSlice) -> dict[str, str]:
        insights = {}

        for feat_name, feat in slice_data.features.items():
            if feat.status == FeatureStatus.NORMAL:
                continue
            elif feat.status == FeatureStatus.MISSING_WITH_DEFAULT:
                weight = ""
                if self.yaml_params and feat_name in self.yaml_params.reward_weights:
                    w = self.yaml_params.reward_weights[feat_name]
                    weight = f"，奖励权重 {w}"
                insights[feat_name] = f"⚠️ 线上缺失，用默认值 {feat.default_value} 代替{weight}，实际值未知"
            elif feat.status == FeatureStatus.MISSING_NO_DEFAULT:
                insights[feat_name] = "❌ 完全缺失，无默认值可用，奖励计算可能偏差"
            elif feat.status == FeatureStatus.OUTLIER:
                insights[feat_name] = f"⚠️ 异常值 {feat.actual_value}，超出阈值范围"

        return insights

    def _generate_action_items(self, slice_data: EvalSlice) -> List[ActionItem]:
        items = []

        if not self.yaml_params:
            items.append(ActionItem(
                description="导入参数YAML文件，确认特征列表和权重配置",
                responsible=ResponsibleRole.ALGORITHM_ENGINEER,
                priority="high",
            ))

        for feat in slice_data.missing_features:
            if feat.status == FeatureStatus.MISSING_WITH_DEFAULT:
                items.append(ActionItem(
                    description=f"补录特征[{feat.name}]的线上真实值，或确认默认值 {feat.default_value} 是否可接受",
                    responsible=ResponsibleRole.ALGORITHM_ENGINEER,
                    priority="high",
                ))
            else:
                items.append(ActionItem(
                    description=f"核查特征[{feat.name}]的定义和数据链路，确认是否上线",
                    responsible=ResponsibleRole.DATA_ENGINEER,
                    priority="high",
                ))

        if slice_data.review_status == ReviewStatus.PENDING:
            items.append(ActionItem(
                description="算法工程师小乔复核该评测切片，标记是否有其他问题",
                responsible=ResponsibleRole.ALGORITHM_ENGINEER,
                priority="medium",
            ))

        if slice_data.review_status == ReviewStatus.REVIEWED_BY_XIAOQIAO:
            items.append(ActionItem(
                description="推荐负责人复核小乔的标记，确认最终处理方式",
                responsible=ResponsibleRole.REC_LEADER,
                priority="medium",
            ))

        return items

    def batch_generate_summaries(self, slices: List[EvalSlice]) -> dict[str, ExplainableSummary]:
        return {s.slice_id: self.generate_summary(s) for s in slices}
