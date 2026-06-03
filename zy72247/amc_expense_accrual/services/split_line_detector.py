from typing import Dict, List, Optional, Tuple


SPLIT_LINE_ROLES = ("手续费", "本金")

SPLIT_LINE_JUDGMENT_RULES = {
    "same_business_no": "同一业务号出现两行以上记录",
    "role_keywords": "行类型包含'手续费'或'本金'",
    "complementary_amounts": "手续费金额 + 本金金额 ≈ 业务总金额（容差0.01元）",
    "judgment": "同时满足以上三条则判定为拆行记录",
}

SPLIT_LINE_BOUNDARY = {
    "auto_action": "标记为 split_line_pending_supervisor，不自动归为正常",
    "manual_resolve": "结算主管复核后手动改为 confirmed 或 modified",
    "rollback": "撤回时恢复上一版差异清单，拆行标记一并回滚",
    "prohibition": "不得在未经结算主管确认的情况下将拆行记录自动归入正常",
}


class SplitLineDetector:
    def __init__(self, tolerance: float = 0.01):
        self._tolerance = tolerance

    def detect(
        self, records_by_business_no: Dict[str, List[dict]]
    ) -> Dict[str, List[dict]]:
        result: Dict[str, List[dict]] = {}
        for biz_no, records in records_by_business_no.items():
            if len(records) < 2:
                for r in records:
                    r["is_split_line"] = False
                    r["split_line_role"] = ""
                result[biz_no] = records
                continue

            roles = []
            for r in records:
                lt = r.get("line_type", "")
                if "手续费" in lt:
                    roles.append("手续费")
                elif "本金" in lt:
                    roles.append("本金")
                else:
                    roles.append("")

            has_fee = "手续费" in roles
            has_principal = "本金" in roles
            is_split = has_fee and has_principal

            if is_split:
                total_amount = sum(r.get("amount", 0) for r in records)
                fee_amount = sum(
                    r.get("amount", 0) for r, role in zip(records, roles) if role == "手续费"
                )
                principal_amount = sum(
                    r.get("amount", 0) for r, role in zip(records, roles) if role == "本金"
                )
                complementary = abs(total_amount - (fee_amount + principal_amount)) < self._tolerance
                if not complementary:
                    is_split = False

            for r, role in zip(records, roles):
                r["is_split_line"] = is_split
                r["split_line_role"] = role if is_split else ""
                if is_split:
                    r["status"] = "split_line_pending_supervisor"

            result[biz_no] = records

        return result

    def explain_judgment(self, biz_no: str, records: List[dict]) -> str:
        if len(records) < 2:
            return f"业务号 {biz_no} 只有1行记录，不构成拆行"

        roles = []
        for r in records:
            lt = r.get("line_type", "")
            if "手续费" in lt:
                roles.append("手续费")
            elif "本金" in lt:
                roles.append("本金")
            else:
                roles.append(lt)

        has_fee = "手续费" in roles
        has_principal = "本金" in roles

        if not (has_fee and has_principal):
            return f"业务号 {biz_no} 缺少手续费或本金角色，不判定为拆行"

        total_amount = sum(r.get("amount", 0) for r in records)
        fee_amount = sum(
            r.get("amount", 0) for r, role in zip(records, roles) if role == "手续费"
        )
        principal_amount = sum(
            r.get("amount", 0) for r, role in zip(records, roles) if role == "本金"
        )
        diff = abs(total_amount - (fee_amount + principal_amount))

        if diff < self._tolerance:
            return (
                f"业务号 {biz_no} 判定为拆行：手续费{fee_amount} + 本金{principal_amount} = "
                f"{fee_amount + principal_amount}，总金额{total_amount}，差值{diff:.4f}"
            )
        else:
            return (
                f"业务号 {biz_no} 有手续费和本金角色但金额不互补（差值{diff:.4f}），"
                f"不判定为拆行，需人工核实"
            )
