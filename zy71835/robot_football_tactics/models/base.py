from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List


@dataclass
class VersionInfo:
    """版本信息，用于追踪每一份材料的提交历史"""
    version_id: str
    submitted_at: datetime
    submitted_by: str = "未知"
    comment: str = ""
    is_material_only: bool = False  # 是否只是补材料，不影响结论


@dataclass
class ChangeRecord:
    """变更记录，用于记录不同版本之间的差异"""
    field_path: str
    old_value: Any
    new_value: Any
    change_type: str  # "material"（补材料） / "conclusion"（改结论） / "unknown"
    human_description: str
    affects_conclusion: bool = False  # 是否影响最终结论
