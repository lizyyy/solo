"""成员数据模型"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List
from datetime import datetime
import uuid


class VoicePart(Enum):
    """声部枚举"""
    SOPRANO_1 = "S1"
    SOPRANO_2 = "S2"
    ALTO_1 = "A1"
    ALTO_2 = "A2"
    TENOR_1 = "T1"
    TENOR_2 = "T2"
    BASS_1 = "B1"
    BASS_2 = "B2"
    UNASSIGNED = "UN"

    @classmethod
    def display_name(cls, part):
        """获取声部显示名称"""
        names = {
            cls.SOPRANO_1: "女高音1",
            cls.SOPRANO_2: "女高音2",
            cls.ALTO_1: "女低音1",
            cls.ALTO_2: "女低音2",
            cls.TENOR_1: "男高音1",
            cls.TENOR_2: "男高音2",
            cls.BASS_1: "男低音1",
            cls.BASS_2: "男低音2",
            cls.UNASSIGNED: "未分配"
        }
        return names.get(part, part.value)

    @classmethod
    def from_string(cls, s):
        """从字符串解析声部"""
        s = s.strip().upper()
        for part in cls:
            if part.value == s or s in [part.value, part.display_name(part)]:
                return part
        # 尝试模糊匹配
        lower_map = {
            "S1": cls.SOPRANO_1,
            "S2": cls.SOPRANO_2,
            "A1": cls.ALTO_1,
            "A2": cls.ALTO_2,
            "T1": cls.TENOR_1,
            "T2": cls.TENOR_2,
            "B1": cls.BASS_1,
            "B2": cls.BASS_2,
            "女高音": cls.SOPRANO_1,
            "女高1": cls.SOPRANO_1,
            "女高2": cls.SOPRANO_2,
            "女低音": cls.ALTO_1,
            "女低1": cls.ALTO_1,
            "女低2": cls.ALTO_2,
            "男高音": cls.TENOR_1,
            "男高1": cls.TENOR_1,
            "男高2": cls.TENOR_2,
            "男低音": cls.BASS_1,
            "男低1": cls.BASS_1,
            "男低2": cls.BASS_2,
        }
        return lower_map.get(s, cls.UNASSIGNED)


class SeniorityLevel(Enum):
    """资深度枚举"""
    NEW = "NEW"
    JUNIOR = "JUNIOR"
    MID = "MID"
    SENIOR = "SENIOR"
    LEADER = "LEADER"

    @classmethod
    def display_name(cls, level):
        """获取资深度显示名称"""
        names = {
            cls.NEW: "新人",
            cls.JUNIOR: "初级",
            cls.MID: "中级",
            cls.SENIOR: "资深",
            cls.LEADER: "声部长"
        }
        return names.get(level, level.value)

    @classmethod
    def from_string(cls, s):
        """从字符串解析资深度"""
        s = s.strip().upper()
        for level in cls:
            if level.value == s:
                return level
        lower_map = {
            "新人": cls.NEW,
            "新": cls.NEW,
            "初级": cls.JUNIOR,
            "初": cls.JUNIOR,
            "中级": cls.MID,
            "中": cls.MID,
            "资深": cls.SENIOR,
            "老": cls.SENIOR,
            "声部长": cls.LEADER,
            "队长": cls.LEADER,
        }
        return lower_map.get(s, cls.MID)


class MemberStatus(Enum):
    """成员状态（到场情况）"""
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LEAVE = "LEAVE"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def display_name(cls, status):
        """获取状态显示名称"""
        names = {
            cls.PRESENT: "到场",
            cls.ABSENT: "缺席",
            cls.LEAVE: "请假",
            cls.UNKNOWN: "未知"
        }
        return names.get(status, status.value)


@dataclass
class Member:
    """合唱团成员"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    voice_part: VoicePart = VoicePart.UNASSIGNED
    height_cm: int = 165
    seniority: SeniorityLevel = SeniorityLevel.MID
    status: MemberStatus = MemberStatus.UNKNOWN
    
    mentor_id: Optional[str] = None
    mentee_ids: List[str] = field(default_factory=list)
    
    restricted_partner_ids: List[str] = field(default_factory=list)
    preferred_partner_ids: List[str] = field(default_factory=list)
    
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def is_new(self):
        """检查是否为新人"""
        return self.seniority == SeniorityLevel.NEW

    def is_mentor(self):
        """检查是否是带教老师（带新人）"""
        return len(self.mentee_ids) > 0 or self.seniority in [SeniorityLevel.SENIOR, SeniorityLevel.LEADER]

    def can_see_over(self, shorter_member):
        """检查当前成员是否会遮挡后面的成员
        
        规则：前排成员身高 > 后排成员身高 - 5cm 时，会产生视线遮挡
        """
        return self.height_cm > (shorter_member.height_cm - 5)

    def to_dict(self):
        """序列化为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "voice_part": self.voice_part.value,
            "height_cm": self.height_cm,
            "seniority": self.seniority.value,
            "status": self.status.value,
            "mentor_id": self.mentor_id,
            "mentee_ids": self.mentee_ids.copy(),
            "restricted_partner_ids": self.restricted_partner_ids.copy(),
            "preferred_partner_ids": self.preferred_partner_ids.copy(),
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def from_dict(cls, data):
        """从字典反序列化"""
        return cls(
            id=data.get("id", str(uuid.uuid4())[:8]),
            name=data.get("name", ""),
            voice_part=VoicePart(data.get("voice_part", "UN")),
            height_cm=data.get("height_cm", 165),
            seniority=SeniorityLevel(data.get("seniority", "MID")),
            status=MemberStatus(data.get("status", "UNKNOWN")),
            mentor_id=data.get("mentor_id"),
            mentee_ids=data.get("mentee_ids", []).copy(),
            restricted_partner_ids=data.get("restricted_partner_ids", []).copy(),
            preferred_partner_ids=data.get("preferred_partner_ids", []).copy(),
            notes=data.get("notes", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now(),
        )

    def __repr__(self):
        return f"<Member {self.id}: {self.name} ({self.voice_part.value})>"
