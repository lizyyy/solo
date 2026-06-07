class FriendlyError(Exception):
    def __init__(self, message: str, suggestion: str = "", details: dict = None):
        self.message = message
        self.suggestion = suggestion
        self.details = details or {}
        super().__init__(self.message)

    def __str__(self):
        if self.suggestion:
            return f"❌ {self.message}\n💡 建议：{self.suggestion}"
        return f"❌ {self.message}"


class DuplicateImportError(FriendlyError):
    def __init__(self, material_id: str, model_name: str):
        super().__init__(
            message=f"材料重复导入：模型【{model_name}】的材料ID【{material_id}】已经导入过了",
            suggestion=f"请检查是否误操作。如果是补录材料，请使用补录类型导入，系统会自动重算。"
        )


class MinorityMaskedError(FriendlyError):
    def __init__(self, model_name: str, overall_metric: float, minority_metric: float):
        super().__init__(
            message=f"少数类样本被总指标盖住了！模型【{model_name}】总指标{overall_metric:.2%}看起来不错，但少数类指标只有{minority_metric:.2%}",
            suggestion=f"别急着归为正常，已标记为【需算法工程师复核】，请通知算法同学检查少数类样本的阈值是否合理。"
        )


class CaliberMismatchError(FriendlyError):
    def __init__(self, model_name: str, expected: str, actual: str):
        super().__init__(
            message=f"材料口径不对：模型【{model_name}】期望口径是【{expected}】，但导入的是【{actual}】",
            suggestion=f"请确认材料来源，或选择【错口径材料】类型导入以便后续跟踪。"
        )


class ThresholdConflictError(FriendlyError):
    def __init__(self, model_name: str, note_threshold: float, bucket_threshold: float):
        super().__init__(
            message=f"阈值冲突：模型【{model_name}】阈值调参笔记写的是{note_threshold}，但线上实验桶实际跑出来是{bucket_threshold}",
            suggestion=f"已列出冲突证据，请推荐策略老唐选择【确认】或【驳回】，系统不会自动拍板。"
        )


class WorkflowStepError(FriendlyError):
    def __init__(self, current_step: str, expected_step: str):
        super().__init__(
            message=f"工作流步骤不对：当前在【{current_step}】，不能直接跳到【{expected_step}】",
            suggestion=f"请按顺序走：阈值调参笔记导入 → 老唐看线上实验桶 → 阈值回放更新。"
        )
