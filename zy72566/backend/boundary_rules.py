"""
召回排序漏斗对账 - 边界规则定义

所有边界判断逻辑统一在此处定义，确保代码、页面、导出使用同一套规则。
"""
from typing import Tuple, Optional


class BoundaryRules:
    """
    边界规则集合

    规则版本: v1.0
    最后更新: 2026-06-07
    """

    MINORITY_THRESHOLD = 0.05
    TOTAL_METRIC_MASK_THRESHOLD = 0.95

    @staticmethod
    def is_minority_sample(
        sample_type: Optional[str],
        recall_rate: Optional[float],
        slice_minority_ratio: Optional[float] = None
    ) -> Tuple[bool, str]:
        """
        判断是否为少数类样本

        判断逻辑:
        1. 显式标记为"少数类"的样本
        2. 召回率显著低于切片平均水平的样本
        3. 样本占比低于5%的类别

        Args:
            sample_type: 样本类型标签
            recall_rate: 样本召回率
            slice_minority_ratio: 切片内少数类占比阈值

        Returns:
            (是否少数类, 判断依据)
        """
        if sample_type and "少数" in sample_type:
            return True, "样本类型显式标记为少数类"

        if recall_rate is not None and recall_rate < 0.3:
            return True, f"召回率{recall_rate:.2%}显著低于阈值"

        if slice_minority_ratio is not None and slice_minority_ratio < BoundaryRules.MINORITY_THRESHOLD:
            return True, f"类别占比{slice_minority_ratio:.2%}低于5%阈值"

        return False, "不满足少数类判定条件"

    @staticmethod
    def is_masked_by_total_metric(
        is_minority: bool,
        total_metric: Optional[float],
        slice_avg_metric: Optional[float] = None
    ) -> Tuple[bool, str]:
        """
        判断少数类样本是否被总指标盖住

        判断逻辑:
        1. 必须是少数类样本
        2. 总指标看起来正常(>=95%)，但细分维度异常
        3. 总指标高于切片平均，但少数类自身指标异常

        关键规则: 被总指标盖住的样本 **不能自动归为正常**，必须标记为待复核

        Args:
            is_minority: 是否少数类样本
            total_metric: 样本总指标
            slice_avg_metric: 切片平均总指标

        Returns:
            (是否被盖住, 判断依据)
        """
        if not is_minority:
            return False, "非少数类样本，不适用盖住判断"

        if total_metric is None:
            return False, "缺少总指标数据"

        if total_metric >= BoundaryRules.TOTAL_METRIC_MASK_THRESHOLD:
            if slice_avg_metric is not None and total_metric >= slice_avg_metric:
                return True, (
                    f"少数类样本总指标{total_metric:.2%} >= "
                    f"{BoundaryRules.TOTAL_METRIC_MASK_THRESHOLD:.0%}，"
                    f"且高于切片平均{slice_avg_metric:.2%}，"
                    f"存在被总指标盖住风险"
                )
            return True, (
                f"少数类样本总指标{total_metric:.2%} >= "
                f"{BoundaryRules.TOTAL_METRIC_MASK_THRESHOLD:.0%}，"
                f"存在被总指标盖住风险"
            )

        return False, "总指标未达到掩盖阈值"

    @staticmethod
    def can_auto_confirm_normal(
        is_masked: bool,
        is_minority: bool,
        status: str
    ) -> Tuple[bool, str]:
        """
        判断是否可以自动确认为正常

        关键规则:
        - 被总指标盖住的少数类样本 **禁止自动归为正常**
        - 必须留给算法工程师人工复核

        Args:
            is_masked: 是否被总指标盖住
            is_minority: 是否少数类样本
            status: 当前状态

        Returns:
            (是否可自动确认, 原因)
        """
        if is_masked and is_minority:
            return False, "少数类样本被总指标盖住，禁止自动归为正常，需算法工程师复核"

        return True, "满足自动确认条件"

    @staticmethod
    def validate_status_transition(
        current_status: str,
        target_status: str,
        is_masked: bool,
        is_minority: bool
    ) -> Tuple[bool, str]:
        """
        验证状态流转是否合法

        状态流转图:
        step1_imported -> step2_feature_added -> step3_threshold_updated
                                                         |
                                                         v
        (被盖住的少数类) pending_review -> confirmed_normal / confirmed_abnormal
                                                         |
                                                         v
        (任意状态) rollback -> step1_imported

        Args:
            current_status: 当前状态
            target_status: 目标状态
            is_masked: 是否被总指标盖住
            is_minority: 是否少数类样本

        Returns:
            (是否合法, 原因)
        """
        valid_transitions = {
            "step1_imported": ["step2_feature_added", "rollback"],
            "step2_feature_added": ["step3_threshold_updated", "rollback", "pending_review"],
            "step3_threshold_updated": ["pending_review", "confirmed_normal", "confirmed_abnormal", "rollback"],
            "pending_review": ["confirmed_normal", "confirmed_abnormal", "rollback"],
            "confirmed_normal": ["rollback"],
            "confirmed_abnormal": ["rollback"],
            "rollback": ["step1_imported"],
        }

        if target_status not in valid_transitions.get(current_status, []):
            return False, f"状态流转不合法: {current_status} -> {target_status}"

        if target_status == "confirmed_normal" and is_masked and is_minority:
            return False, "被总指标盖住的少数类样本，需先标记为待复核再确认"

        return True, "状态流转合法"

    @staticmethod
    def get_status_description(status: str) -> str:
        """获取状态的中文描述"""
        descriptions = {
            "step1_imported": "步骤1: 评测切片已导入",
            "step2_feature_added": "步骤2: 特征快照编号已补看",
            "step3_threshold_updated": "步骤3: 阈值回放已更新",
            "pending_review": "待算法工程师复核",
            "confirmed_normal": "已确认正常",
            "confirmed_abnormal": "已确认异常",
            "rollback": "已回滚",
        }
        return descriptions.get(status, status)

    @staticmethod
    def get_action_description(action: str) -> str:
        """获取操作的中文描述"""
        descriptions = {
            "import": "导入评测切片",
            "add_feature_snapshot": "补看特征快照编号",
            "update_threshold": "阈值回放更新",
            "mark_pending_review": "标记待复核",
            "confirm_normal": "确认正常",
            "confirm_abnormal": "确认异常",
            "rollback": "回滚操作",
            "add_note": "添加备注",
        }
        return descriptions.get(action, action)
