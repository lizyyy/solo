from typing import Dict


USER_FRIENDLY_ERRORS: Dict[str, str] = {
    "inst_name_mismatch": "流水尾号 {tail} 的机构名称前后对不上。导入时叫「{imported}」，但登记的标准名称是「{official}」。请财务复核确认后再处理。",
    "inst_name_mismatch_detail": "流水尾号 {tail} 在 {date} 这笔的机构名称填成了「{imported}」，但之前同尾号的记录用的是「{official}」。名称不一致，已标记待财务复核，不能直接归档。",
    "no_mapping_found": "流水尾号 {tail} 还没在系统里登记过机构映射。请先找支付平台产品阿南补录机构信息。",
    "supplement_not_found": "流水尾号 {tail} 存在历史口径差异，但还没收到客户经理的补充说明邮件。请让阿南跟进客户经理补材料。",
    "supplement_match": "已找到流水尾号 {tail} 的客户经理补充邮件（{email_id}），里面说明当时用的是旧口径「{old_name}」，与历史记录能对上。",
    "supplement_mismatch": "流水尾号 {tail} 的补充邮件里说的旧口径是「{email_name}」，但实际导入的是「{imported}」，两者还是对不上，请再核实。",
    "historical_match": "补录后流水尾号 {tail} 的机构名称「{name}」与历史归档记录（{date}）一致，可以正常归档。",
    "historical_mismatch": "补录后流水尾号 {tail} 的机构名称「{name}」与历史记录仍有差异，请财务复核。",
    "manual_fix_applied": "流水尾号 {tail} 已由 {operator} 人工修正，备注：{note}",
    "rerun_completed": "流水尾号 {tail} 已完成第 {count} 次重跑，当前状态：{status}",
    "archive_success": "流水尾号 {tail} 滑点数据已成功归档，归档时间：{time}",
    "pending_review_reminder": "⚠️  流水尾号 {tail} 目前是「待财务复核」状态，在财务确认前不能归档。"
}


def get_error(key: str, **kwargs) -> str:
    template = USER_FRIENDLY_ERRORS.get(key, key)
    try:
        return template.format(**kwargs)
    except KeyError as e:
        return f"提示信息缺少参数：{e}"
