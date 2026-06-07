class UserFriendlyError(Exception):
    """用户友好的错误，说人话不吐字段名"""
    
    def __init__(self, message: str, suggestion: str = ""):
        self.message = message
        self.suggestion = suggestion
        super().__init__(self.message)
    
    def __str__(self):
        if self.suggestion:
            return f"{self.message}\n建议：{self.suggestion}"
        return self.message


class ErrorMessages:
    @staticmethod
    def record_not_found(record_id: str) -> UserFriendlyError:
        return UserFriendlyError(
            message=f"找不到编号为 {record_id} 的记录",
            suggestion="请检查记录编号是否正确，或者先导入这条记录再处理"
        )

    @staticmethod
    def invalid_score(score: float) -> UserFriendlyError:
        return UserFriendlyError(
            message=f"评分 {score} 分不对，评分范围应该是 0-100 分",
            suggestion="请输入一个 0 到 100 之间的数字作为评分"
        )

    @staticmethod
    def missing_bus_time() -> UserFriendlyError:
        return UserFriendlyError(
            message="公交刷卡时段还没填",
            suggestion="请在导入数据前先填写公交刷卡的具体时段，比如早高峰 07:30-09:00"
        )

    @staticmethod
    def ramp_already_supplemented() -> UserFriendlyError:
        return UserFriendlyError(
            message="这条记录已经做过坡道补录了",
            suggestion="如果需要修改，请用人工修正功能，不要重复补录"
        )

    @staticmethod
    def redline_already_checked() -> UserFriendlyError:
        return UserFriendlyError(
            message="这条记录已经看过红线图备注了",
            suggestion="如果需要更新备注内容，请用人工修正功能"
        )

    @staticmethod
    def step_out_of_order(current_step: str, expected_step: str) -> UserFriendlyError:
        return UserFriendlyError(
            message=f"操作顺序不对，现在应该先{expected_step}，而不是{current_step}",
            suggestion="请按流程来：先导入公交数据 → 再补录坡道 → 再看红线图备注 → 最后人工修正"
        )

    @staticmethod
    def empty_supplement_content() -> UserFriendlyError:
        return UserFriendlyError(
            message="坡道补录的内容不能空着",
            suggestion="请写清楚坡道的位置、长度、占用情况这些关键信息"
        )

    @staticmethod
    def empty_redline_note() -> UserFriendlyError:
        return UserFriendlyError(
            message="红线图备注内容不能空着",
            suggestion="请填写从红线图上看到的备注信息，比如是不是旧口径、有没有历史遗留问题"
        )

    @staticmethod
    def cannot_mark_normal_automatically() -> UserFriendlyError:
        return UserFriendlyError(
            message="坡道补录后评分没变，不能直接算正常",
            suggestion="请交给交通协管去现场复核，确认没问题后再由人工标记为正常"
        )

    @staticmethod
    def operator_required() -> UserFriendlyError:
        return UserFriendlyError(
            message="请填写操作人姓名",
            suggestion="每条操作记录都需要知道是谁做的，方便以后追溯"
        )


class InputValidator:
    @staticmethod
    def validate_record_id(record_id: str) -> None:
        if not record_id or not record_id.strip():
            raise UserFriendlyError(
                message="记录编号不能为空",
                suggestion="请填写正确的记录编号，比如 TX-2026-001"
            )

    @staticmethod
    def validate_score(score: float) -> None:
        if score < 0 or score > 100:
            raise ErrorMessages.invalid_score(score)

    @staticmethod
    def validate_operator(operator: str) -> None:
        if not operator or not operator.strip():
            raise ErrorMessages.operator_required()

    @staticmethod
    def validate_bus_card_time(bus_card_time: str) -> None:
        if not bus_card_time or not bus_card_time.strip():
            raise ErrorMessages.missing_bus_time()
