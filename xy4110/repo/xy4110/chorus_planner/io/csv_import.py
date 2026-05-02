"""CSV 成员导入模块"""
import csv
import io
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set, Any
from pathlib import Path

from ..models.member import Member, VoicePart, SeniorityLevel, MemberStatus


@dataclass
class ImportResult:
    """导入结果"""
    success: bool = True
    message: str = ""
    
    imported_count: int = 0
    updated_count: int = 0
    skipped_count: int = 0
    error_count: int = 0
    
    members: Dict[str, Member] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class CSVImporter:
    """CSV 成员导入器"""
    
    EXPECTED_HEADERS = {
        "name", "姓名",
        "voice_part", "声部", "声部1", "声部2",
        "height", "身高", "身高cm",
        "seniority", "资深度", "资历",
        "status", "状态", "到场",
        "mentor_name", "mentor", "带教老师", "导师",
        "notes", "备注",
    }
    
    def __init__(self):
        self.header_mapping: Dict[str, str] = {}
    
    def import_from_file(self, file_path: Path, existing_members: Optional[Dict[str, Member]] = None) -> ImportResult:
        """从文件导入"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return self.import_from_string(content, existing_members)
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    content = f.read()
                return self.import_from_string(content, existing_members)
            except Exception as e:
                result = ImportResult()
                result.success = False
                result.message = f"文件编码错误：{e}"
                result.error_count = 1
                result.errors.append(str(e))
                return result
        except Exception as e:
            result = ImportResult()
            result.success = False
            result.message = f"读取文件失败：{e}"
            result.error_count = 1
            result.errors.append(str(e))
            return result
    
    def import_from_string(self, content: str, existing_members: Optional[Dict[str, Member]] = None) -> ImportResult:
        """从字符串内容导入"""
        result = ImportResult()
        
        if existing_members:
            result.members = {k: v for k, v in existing_members.items()}
        
        lines = content.splitlines()
        if not lines:
            result.message = "CSV 文件为空"
            result.success = False
            return result
        
        try:
            reader = csv.DictReader(io.StringIO(content))
        except Exception as e:
            result.success = False
            result.message = f"CSV 解析错误：{e}"
            result.errors.append(str(e))
            return result
        
        if not reader.fieldnames:
            result.message = "CSV 没有表头行"
            result.success = False
            return result
        
        self._build_header_mapping(reader.fieldnames)
        
        name_to_id: Dict[str, str] = {}
        for member_id, member in result.members.items():
            name_to_id[member.name] = member_id
        
        row_idx = 0
        for row in reader:
            row_idx += 1
            try:
                name = self._get_value(row, "name")
                if not name or not name.strip():
                    result.warnings.append(f"第 {row_idx + 1} 行：姓名为空，跳过")
                    result.skipped_count += 1
                    continue
                
                name = name.strip()
                
                if name in name_to_id:
                    member_id = name_to_id[name]
                    member = result.members[member_id]
                    updated = self._update_member_from_row(member, row)
                    if updated:
                        result.updated_count += 1
                else:
                    member = self._create_member_from_row(row, name)
                    result.members[member.id] = member
                    name_to_id[name] = member.id
                    result.imported_count += 1
                    
            except Exception as e:
                result.error_count += 1
                result.errors.append(f"第 {row_idx + 1} 行：{e}")
        
        self._resolve_mentor_relationships(result.members, name_to_id)
        
        result.message = f"导入完成：新增 {result.imported_count} 人，更新 {result.updated_count} 人"
        if result.errors:
            result.message += f"，错误 {result.error_count} 个"
        
        return result
    
    def _build_header_mapping(self, headers):
        """建立表头映射"""
        self.header_mapping = {}
        
        mapping_rules = [
            (["name", "姓名"], "name"),
            (["voice_part", "声部", "声部1"], "voice_part"),
            (["voice_part2", "声部2"], "voice_part2"),
            (["height", "身高", "身高cm"], "height"),
            (["seniority", "资深度", "资历"], "seniority"),
            (["status", "状态", "到场"], "status"),
            (["mentor_name", "mentor", "带教老师", "导师"], "mentor_name"),
            (["notes", "备注"], "notes"),
        ]
        
        for h in headers:
            h_lower = h.strip().lower()
            for aliases, target in mapping_rules:
                if h_lower in aliases or h.strip() in aliases:
                    self.header_mapping[h] = target
                    break
            else:
                self.header_mapping[h] = h_lower
    
    def _get_value(self, row: Dict, key: str) -> str:
        """从行获取值"""
        for original_key, mapped_key in self.header_mapping.items():
            if mapped_key == key and original_key in row:
                return row.get(original_key, "").strip()
        return row.get(key, "").strip()
    
    def _create_member_from_row(self, row: Dict, name: str) -> Member:
        """从行创建成员"""
        member = Member(name=name)
        
        voice_part_str = self._get_value(row, "voice_part")
        if voice_part_str:
            member.voice_part = VoicePart.from_string(voice_part_str)
        
        height_str = self._get_value(row, "height")
        if height_str:
            try:
                height = int(height_str.replace("cm", "").replace("CM", "").strip())
                if 100 <= height <= 220:
                    member.height_cm = height
            except ValueError:
                pass
        
        seniority_str = self._get_value(row, "seniority")
        if seniority_str:
            member.seniority = SeniorityLevel.from_string(seniority_str)
        
        status_str = self._get_value(row, "status")
        if status_str:
            status_map = {
                "到场": MemberStatus.PRESENT,
                "是": MemberStatus.PRESENT,
                "在": MemberStatus.PRESENT,
                "请假": MemberStatus.LEAVE,
                "请假中": MemberStatus.LEAVE,
                "缺席": MemberStatus.ABSENT,
                "未到": MemberStatus.ABSENT,
            }
            member.status = status_map.get(status_str, MemberStatus.UNKNOWN)
        
        notes = self._get_value(row, "notes")
        if notes:
            member.notes = notes
        
        return member
    
    def _update_member_from_row(self, member: Member, row: Dict) -> bool:
        """从行更新成员"""
        updated = False
        
        voice_part_str = self._get_value(row, "voice_part")
        if voice_part_str:
            new_voice = VoicePart.from_string(voice_part_str)
            if new_voice != member.voice_part and new_voice != VoicePart.UNASSIGNED:
                member.voice_part = new_voice
                updated = True
        
        height_str = self._get_value(row, "height")
        if height_str:
            try:
                height = int(height_str.replace("cm", "").replace("CM", "").strip())
                if 100 <= height <= 220 and height != member.height_cm:
                    member.height_cm = height
                    updated = True
            except ValueError:
                pass
        
        seniority_str = self._get_value(row, "seniority")
        if seniority_str:
            new_seniority = SeniorityLevel.from_string(seniority_str)
            if new_seniority != member.seniority:
                member.seniority = new_seniority
                updated = True
        
        status_str = self._get_value(row, "status")
        if status_str:
            status_map = {
                "到场": MemberStatus.PRESENT,
                "是": MemberStatus.PRESENT,
                "在": MemberStatus.PRESENT,
                "请假": MemberStatus.LEAVE,
                "请假中": MemberStatus.LEAVE,
                "缺席": MemberStatus.ABSENT,
                "未到": MemberStatus.ABSENT,
            }
            new_status = status_map.get(status_str)
            if new_status and new_status != member.status:
                member.status = new_status
                updated = True
        
        return updated
    
    def _resolve_mentor_relationships(self, members: Dict[str, Member], name_to_id: Dict[str, str]):
        """解析带教关系"""
        pass


def get_sample_csv_content() -> str:
    """获取示例 CSV 内容"""
    return """姓名,声部,身高,资深度,状态,带教老师,备注
张明,女高音1,170,资深,到场,,声部长
李华,女高音1,165,新人,到场,张明,新来的需要多带
王芳,女高音2,168,中级,到场,,
赵丽,女低音1,162,中级,到场,,
钱伟,女低音1,160,新人,到场,赵丽,
孙强,男高音1,175,资深,到场,,声部长
周斌,男高音1,172,中级,到场,,
吴凯,男高音2,178,初级,到场,,
郑涛,男低音1,180,资深,到场,,声部长
冯杰,男低音1,176,中级,请假,,
陈磊,男低音2,182,初级,到场,,
"""


def import_members_from_csv(
    file_path: str,
    existing_members: Optional[Dict[str, Member]] = None
) -> ImportResult:
    """便捷函数：从 CSV 导入成员"""
    importer = CSVImporter()
    return importer.import_from_file(Path(file_path), existing_members)
