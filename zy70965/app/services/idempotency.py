from typing import List, Dict, Any, Tuple
import hashlib
import json


def calculate_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def generate_batch_id(quality_hash: str, audio_hash: str, appeal_hash: str) -> str:
    combined = f"{quality_hash}|{audio_hash}|{appeal_hash}"
    return hashlib.md5(combined.encode()).hexdigest()[:16]


RULES = [
    {
        "rule_code": "DEDUCTION_REVOKE",
        "rule_name": "扣分项撤销规则",
        "description": "当申诉理由充分且有录音摘要佐证时，原扣分项应被撤销。边界说明：若申诉仅部分有理，则只撤销对应部分，而非全部撤销。",
        "applicable_scenarios": [
            "申诉理由与录音摘要内容一致",
            "扣分标准引用错误",
            "质检时对录音内容理解偏差"
        ],
        "example": "原扣分项：未使用标准开场白(-5分)。申诉：录音显示已使用标准开场白。处理：撤销该扣分项，回加5分。"
    },
    {
        "rule_code": "SECOND_REVIEW",
        "rule_name": "二次复核规则",
        "description": "当申诉与初次复核意见存在重大分歧，或涉及5分以上大额扣分时，触发二次复核。边界说明：二次复核为最终结论，不再接受申诉。",
        "applicable_scenarios": [
            "初次复核与申诉意见完全相反",
            "单次扣分≥5分",
            "涉及敏感或重大违规判定"
        ],
        "example": "原扣分：服务态度恶劣(-10分)。申诉：否认态度恶劣。初次复核维持原判。触发二次复核，由质检主管重审。"
    },
    {
        "rule_code": "SCORE_WRITE_BACK",
        "rule_name": "成绩回写规则",
        "description": "申诉处理完成后，最终成绩必须同步回写至原始质检记录。边界说明：若申诉被驳回，成绩保持不变；若部分撤销，按比例调整。",
        "applicable_scenarios": [
            "申诉成功（全部/部分）",
            "申诉驳回",
            "二次复核完成"
        ],
        "example": "原得分85分，因申诉成功撤销5分扣分项，最终成绩回写为90分。"
    },
    {
        "rule_code": "INCONSISTENCY_DETECT",
        "rule_name": "分数不一致检测",
        "description": "当复核分数与最终分数不一致时，标记为待确认项。边界说明：差异≥2分时强制触发复核流程。",
        "applicable_scenarios": [
            "申诉后分数与原分数不一致",
            "复核分数与申诉处理分数不一致"
        ],
        "example": "原始分85，申诉后应得90，但系统显示88。差异2分，标记待确认。"
    }
]
