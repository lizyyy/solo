from typing import Dict, Optional

from models import RiskFlag


ERROR_MESSAGES: Dict[str, Dict[str, str]] = {
    "MISSING_REVIEW_REPORT": {
        "user_message": "当天的复核日报还没上传哦，没有复核结论不能出最终结果",
        "suggestion": "请先上传复核日报，或在【待办】里补填当日的复核记录。如果是刚收到邮件补充材料，记得标记为'后补'"
    },
    "FREEZE_NOT_RELEASED": {
        "user_message": "有{count}笔冻结额度还没处理释放，这会让压力缺口算得比实际大",
        "suggestion": "请去【冻结管理】检查这{count}笔记录，确认是否该释放了。如果确实要继续冻结，请备注说明原因"
    },
    "DUPLICATE_CREDIT": {
        "user_message": "发现{count}位客户存在重复授信，同一个客户多笔授信会放大资产池规模",
        "suggestion": "请核对这{count}位客户的授信台账，确认是否是同一笔业务重复录入，还是真的有叠加授信"
    },
    "MANUAL_NOTE_OVERRIDE": {
        "user_message": "有{count}条记录用人工备注盖掉了之前的系统结论，这个动作需要复核",
        "suggestion": "请逐条确认人工备注内容是否合理，有没有完整记录修改原因。如果备注理由不充分，请打回修改"
    },
    "LATE_SUPPLEMENT": {
        "user_message": "这份复核日报是后补的（比补充邮件晚到{days}天），请确认有没有影响结论",
        "suggestion": "请对比补充邮件和后补日报的内容差异，特别关注压力缺口数字和结论有没有变化"
    },
    "REPORT_VERSION_CHANGED": {
        "user_message": "同一日期的复核日报已经是第{version}版了，相比上一版有{change_count}处变化",
        "suggestion": "请查看下方的版本差异对比，确认这些变化是补材料还是真的改了结论"
    },
    "CONCLUSION_CHANGED": {
        "user_message": "注意！这次复核日报的结论和上一版不一样：从\"{old}\"改成了\"{new}\"",
        "suggestion": "请务必让风控主管确认结论变更的原因，留存书面说明后再继续"
    },
    "INVALID_CREDIT_DATA": {
        "user_message": "授信台账里这条数据有问题：{detail}",
        "suggestion": "请去【授信管理】修正这条数据，或者联系运营岗同事核对原始凭证"
    },
    "CALCULATION_ERROR": {
        "user_message": "计算压力缺口时遇到了问题，请检查数据是否完整",
        "suggestion": "如果数据都齐了还出问题，可以点【重新计算】，或者联系系统支持岗"
    },
    "GAP_TOO_LARGE": {
        "user_message": "压力缺口率达到{ratio:.1%}，超过了警戒线{threshold:.1%}",
        "suggestion": "请立即启动压力缺口应急预案，排查是哪块资产出了问题，准备缓释措施"
    }
}


def get_user_friendly_error(
    error_code: str,
    **kwargs
) -> tuple[str, Optional[str]]:
    error = ERROR_MESSAGES.get(error_code)
    if not error:
        return "系统遇到了一个问题，请稍后再试", "请联系系统支持岗处理"

    user_msg = error["user_message"].format(**kwargs)
    suggestion = error["suggestion"].format(**kwargs) if error.get("suggestion") else None

    return user_msg, suggestion


def get_risk_flag_description(flag: RiskFlag, **kwargs) -> str:
    descriptions = {
        RiskFlag.FREEZE_NOT_RELEASED: "有{count}笔冻结额度未释放，涉及金额{amount:,.2f}万元",
        RiskFlag.DUPLICATE_CREDIT: "发现{count}位客户重复授信，涉及金额{amount:,.2f}万元",
        RiskFlag.MANUAL_NOTE_OVERRIDE: "有{count}条人工备注覆盖了系统原结论",
        RiskFlag.MISSING_REVIEW_REPORT: "缺少{date}的复核日报",
        RiskFlag.LATE_SUPPLEMENT: "后补材料，比邮件晚到{days}天",
        RiskFlag.NONE: ""
    }
    return descriptions.get(flag, "").format(**kwargs)
