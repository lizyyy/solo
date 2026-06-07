from typing import Dict, Any, Optional, List, Tuple

BOUNDARY_RULES: Dict[str, Dict[str, Any]] = {
    "phone_number_masking": {
        "id": "RULE_001",
        "name": "手机号漏遮判定规则",
        "description": "手机号在导出中漏遮的判定、处理、回滚边界",
        "criteria": [
            "内容中包含匹配模式 r'1[3-9]\\d{9}' 的字符串",
            "该字符串未被替换为 '1*********'",
            "该字段出现在导出的最终输出中",
        ],
        "severity": "high",
        "judgment": {
            "auto_detect": True,
            "auto_fix_allowed": False,
            "requires_human_review": True,
            "escalate_to": "algorithm_team",
        },
        "handling": {
            "step_1": "自动标记为 has_unmasked_phone=True",
            "step_2": "自动设置 masking_status=needs_review",
            "step_3": "导出时默认跳过(include_unreviewed=False)",
            "step_4": "review_status 设为 pending_algorithm_review",
        },
        "rollback": {
            "allowed": True,
            "requires_audit": True,
            "rollback_triggers": [
                "误判：非手机号的数字组合",
                "已手动修正脱敏",
                "算法团队复核后确认放行",
            ],
        },
        "data_sources": {
            "model_output": "可回溯",
            "manual_review": "可回溯",
            "source_reference": "保留 model_output_id 和 manual_review_id",
        },
    },
    "duplicate_import": {
        "id": "RULE_002",
        "name": "重复导入去重规则",
        "description": "重复导入同一批模型输出片段时的去重边界",
        "criteria": [
            "model_output_id 已存在于系统中",
            "且现有记录的 is_active=True",
            "且内容哈希完全一致",
        ],
        "severity": "low",
        "judgment": {
            "auto_detect": True,
            "auto_fix_allowed": True,
            "requires_human_review": False,
        },
        "handling": {
            "duplicate_action": "skip（不创建新记录，数量不翻倍）",
            "content_diff_action": "update（版本号+1，保留历史）",
            "batch_id_update": "更新为最新 batch_id",
        },
        "rollback": {
            "allowed": False,
            "reason": "去重是幂等操作，无需回滚",
        },
    },
    "single_line_review": {
        "id": "RULE_003",
        "name": "单条备注修改历史规则",
        "description": "只改了一条备注时，历史中要能看出改前改后",
        "criteria": [
            "source_manual_review 或 review_comment 字段发生变更",
            "变更来自人工改判表导入",
            "仅单条字段值变化",
        ],
        "severity": "medium",
        "judgment": {
            "auto_detect": True,
            "auto_fix_allowed": False,
            "requires_human_review": False,
        },
        "handling": {
            "version_increment": "每次修改版本号+1",
            "history_record": "记录 field_name、old_value、new_value、changed_by、change_reason",
            "diff_visible": "可通过 compare_versions 查看改前改后",
        },
        "rollback": {
            "allowed": True,
            "requires_audit": True,
        },
    },
    "visualization_review": {
        "id": "RULE_004",
        "name": "3D/图表展示复核规则",
        "description": "选择3D或图表展示时，先服务复核的边界",
        "criteria": [
            "展示方式选择 3D 或 图表",
            "点击到一条有手机号漏遮的记录",
        ],
        "severity": "high",
        "judgment": {
            "auto_detect": True,
            "auto_fix_allowed": False,
            "requires_human_review": True,
        },
        "handling": {
            "redirect_to": "模型输出片段 或 人工改判表原始页面",
            "not_only_visual": "禁止只展示漂亮画面，必须可溯源",
            "source_trace": "点击时携带 model_output_id 或 manual_review_id",
        },
        "rollback": {
            "allowed": False,
            "reason": "展示层逻辑，不影响数据状态",
        },
    },
    "three_step_workflow": {
        "id": "RULE_005",
        "name": "三步工作流边界规则",
        "description": "模型输出导入→人工改判补看→脱敏导出更新的流程边界",
        "step_1_import": {
            "name": "模型输出片段第一次导入",
            "actions": [
                "创建 Recommendation 记录",
                "标记来源 model_output_id",
                "自动检测脱敏问题",
                "手机号漏遮不自动归为正常",
            ],
        },
        "step_2_review": {
            "name": "模型评测同事小孟补看人工改判表",
            "actions": [
                "补全 source_manual_review 字段",
                "review_status 设为 reviewed",
                "reviewer 设为 xiaomeng",
                "再次检测脱敏问题",
            ],
        },
        "step_3_export": {
            "name": "脱敏导出更新",
            "actions": [
                "对内容应用全部脱敏规则",
                "has_unmasked_phone=True 的记录默认不导出",
                "手机号漏遮留给算法同事复核",
                "review_status 设为 pending_algorithm_review",
            ],
            "phone_issue_handling": "不急着归正常，留给算法同事复核",
        },
    },
    "audit_and_replay": {
        "id": "RULE_006",
        "name": "审计与复盘规则",
        "description": "输出可复盘的记录和可重新跑的命令",
        "requirements": [
            "所有操作写入 audit_logs/audit.log.jsonl",
            "每条记录带 timestamp、event_type、data",
            "可生成 replay 命令列表",
            "可追溯每个 recommendation 的完整版本历史",
            "可追溯每次导入的 item_count、new、updated、duplicates",
            "可追溯脱敏检测的 violation_type 和 matched_texts",
            "可追溯回滚操作的 from_version 和 to_version",
        ],
    },
}

MASKING_SEVERITY_ORDER = ["high", "medium", "low"]

REVIEW_STATUS_FLOW: Dict[str, List[str]] = {
    "pending": ["reviewed", "pending_algorithm_review"],
    "reviewed": ["pending_algorithm_review", "pending"],
    "pending_algorithm_review": ["reviewed", "pending"],
}

MASKING_STATUS_FLOW: Dict[str, List[str]] = {
    "pending": ["clean", "violations_found", "needs_review", "auto_masked"],
    "clean": ["violations_found", "needs_review"],
    "violations_found": ["clean", "needs_review", "auto_masked"],
    "needs_review": ["clean", "auto_masked", "violations_found"],
    "auto_masked": ["clean", "needs_review"],
}


def get_boundary_rule(rule_id: str) -> Optional[Dict[str, Any]]:
    for key, rule in BOUNDARY_RULES.items():
        if rule.get("id") == rule_id or key == rule_id:
            return rule
    return None


def validate_operation(
    operation: str,
    context: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    errors = []
    warnings = []

    if operation == "export_with_phone_unmasked":
        if not context.get("include_unreviewed"):
            errors.append("RULE_001: 有手机号漏遮的记录禁止在未复核状态下导出")
        else:
            warnings.append("RULE_001: 导出含未脱敏手机号，已记录审计日志")

    if operation == "auto_fix_phone":
        errors.append("RULE_001: 手机号漏遮不允许自动修复，需算法同事复核")

    if operation == "visualize_without_source":
        errors.append("RULE_004: 3D/图表展示必须可回溯到模型输出或人工改判表")

    is_valid = len(errors) == 0
    return is_valid, errors + warnings
