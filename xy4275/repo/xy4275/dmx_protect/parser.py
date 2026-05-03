"""
数据解析器模块

用于解析 CUE 表 CSV、灯具 Patch JSON 和修改记录 JSON 文件。
"""

import csv
import json
import ast
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from .models import (
    Cue, Fixture, Modification, ChannelChange,
    TriggerType, FixtureType
)


class ParseError(Exception):
    """解析错误异常"""
    pass


class CueParser:
    """CUE 表解析器"""
    
    @staticmethod
    def parse_file(file_path: str) -> List[Cue]:
        """从 CSV 文件解析 CUE 列表"""
        path = Path(file_path)
        if not path.exists():
            raise ParseError(f"CUE 文件不存在: {file_path}")
        
        cues = []
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    cue = CueParser._parse_row(row, row_num)
                    cues.append(cue)
                except Exception as e:
                    raise ParseError(f"解析第 {row_num} 行失败: {e}")
        
        return cues
    
    @staticmethod
    def _parse_row(row: Dict[str, str], row_num: int) -> Cue:
        """解析单行 CUE 数据"""
        required_fields = ['cue_number', 'description', 'trigger_type', 'trigger_value', 'duration', 'channels']
        for field in required_fields:
            if field not in row:
                raise ParseError(f"缺少必要字段: {field}")
        
        cue_number = row['cue_number'].strip()
        if not cue_number:
            raise ParseError("CUE 编号不能为空")
        
        description = row.get('description', '').strip()
        
        try:
            trigger_type = TriggerType(row['trigger_type'].strip().lower())
        except ValueError:
            raise ParseError(f"无效的触发类型: {row['trigger_type']}，有效值: time, auto, manual")
        
        try:
            trigger_value = float(row['trigger_value'].strip())
        except ValueError:
            raise ParseError(f"触发值必须是数字: {row['trigger_value']}")
        
        try:
            duration = float(row['duration'].strip())
        except ValueError:
            raise ParseError(f"持续时间必须是数字: {row['duration']}")
        
        channels = CueParser._parse_channels(row['channels'].strip())
        
        return Cue(
            cue_number=cue_number,
            description=description,
            trigger_type=trigger_type,
            trigger_value=trigger_value,
            duration=duration,
            channels=channels
        )
    
    @staticmethod
    def _parse_channels(channels_str: str) -> Dict[int, int]:
        """解析通道值字符串"""
        if not channels_str or channels_str == '{}':
            return {}
        
        try:
            channels_dict = ast.literal_eval(channels_str)
            if not isinstance(channels_dict, dict):
                raise ValueError("通道值必须是字典格式")
            
            result = {}
            for key, value in channels_dict.items():
                try:
                    ch = int(key)
                except (TypeError, ValueError):
                    raise ValueError(f"无效通道号: {key}")
                
                try:
                    val = int(value)
                except (TypeError, ValueError):
                    raise ValueError(f"通道 {key} 的值无效: {value}")
                
                result[ch] = val
            
            return result
        except Exception as e:
            raise ParseError(f"解析通道值失败: {e}")


class FixtureParser:
    """灯具 Patch 解析器"""
    
    @staticmethod
    def parse_file(file_path: str) -> List[Fixture]:
        """从 JSON 文件解析灯具列表"""
        path = Path(file_path)
        if not path.exists():
            raise ParseError(f"灯具 Patch 文件不存在: {file_path}")
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ParseError(f"灯具 Patch JSON 解析失败: {e}")
        
        if 'fixtures' not in data:
            raise ParseError("灯具 Patch 文件缺少 'fixtures' 字段")
        
        fixtures = []
        for idx, fixture_data in enumerate(data['fixtures']):
            try:
                fixture = FixtureParser._parse_fixture(fixture_data)
                fixtures.append(fixture)
            except Exception as e:
                raise ParseError(f"解析第 {idx + 1} 个灯具失败: {e}")
        
        return fixtures
    
    @staticmethod
    def _parse_fixture(data: Dict[str, Any]) -> Fixture:
        """解析单个灯具数据"""
        required_fields = ['id', 'name', 'type', 'start_channel', 'channel_count']
        for field in required_fields:
            if field not in data:
                raise ParseError(f"缺少必要字段: {field}")
        
        fixture_id = data['id'].strip()
        if not fixture_id:
            raise ParseError("灯具 ID 不能为空")
        
        name = data['name'].strip()
        if not name:
            raise ParseError("灯具名称不能为空")
        
        try:
            fixture_type = FixtureType(data['type'].strip().lower())
        except ValueError:
            raise ParseError(f"无效的灯具类型: {data['type']}")
        
        try:
            start_channel = int(data['start_channel'])
        except (TypeError, ValueError):
            raise ParseError(f"起始通道必须是整数: {data['start_channel']}")
        
        try:
            channel_count = int(data['channel_count'])
        except (TypeError, ValueError):
            raise ParseError(f"通道数必须是整数: {data['channel_count']}")
        
        channels = data.get('channels', {})
        if not isinstance(channels, dict):
            raise ParseError("channels 字段必须是字典")
        
        requires_confirmation = bool(data.get('requires_confirmation', False))
        
        return Fixture(
            id=fixture_id,
            name=name,
            type=fixture_type,
            start_channel=start_channel,
            channel_count=channel_count,
            channels=channels,
            requires_confirmation=requires_confirmation
        )


class ModificationParser:
    """修改记录解析器"""
    
    @staticmethod
    def parse_file(file_path: str) -> List[Modification]:
        """从 JSON 文件解析修改记录列表"""
        path = Path(file_path)
        if not path.exists():
            raise ParseError(f"修改记录文件不存在: {file_path}")
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ParseError(f"修改记录 JSON 解析失败: {e}")
        
        if 'modifications' not in data:
            raise ParseError("修改记录文件缺少 'modifications' 字段")
        
        modifications = []
        for idx, mod_data in enumerate(data['modifications']):
            try:
                modification = ModificationParser._parse_modification(mod_data)
                modifications.append(modification)
            except Exception as e:
                raise ParseError(f"解析第 {idx + 1} 条修改记录失败: {e}")
        
        return modifications
    
    @staticmethod
    def _parse_modification(data: Dict[str, Any]) -> Modification:
        """解析单条修改记录"""
        required_fields = ['id', 'cue_number', 'modified_at', 'modified_by', 'changes']
        for field in required_fields:
            if field not in data:
                raise ParseError(f"缺少必要字段: {field}")
        
        mod_id = data['id'].strip()
        if not mod_id:
            raise ParseError("修改记录 ID 不能为空")
        
        cue_number = data['cue_number'].strip()
        if not cue_number:
            raise ParseError("CUE 编号不能为空")
        
        try:
            if isinstance(data['modified_at'], str):
                modified_at = datetime.fromisoformat(data['modified_at'])
            else:
                modified_at = datetime.now()
        except ValueError:
            raise ParseError(f"无效的时间格式: {data['modified_at']}")
        
        modified_by = data['modified_by'].strip()
        
        changes_data = data['changes']
        if not isinstance(changes_data, list):
            raise ParseError("changes 字段必须是列表")
        
        changes = []
        for ch_data in changes_data:
            changes.append(ModificationParser._parse_channel_change(ch_data))
        
        confirmed = bool(data.get('confirmed', False))
        
        return Modification(
            id=mod_id,
            cue_number=cue_number,
            modified_at=modified_at,
            modified_by=modified_by,
            changes=changes,
            confirmed=confirmed
        )
    
    @staticmethod
    def _parse_channel_change(data: Dict[str, Any]) -> ChannelChange:
        """解析通道修改记录"""
        required_fields = ['channel', 'old_value', 'new_value']
        for field in required_fields:
            if field not in data:
                raise ParseError(f"通道修改记录缺少必要字段: {field}")
        
        try:
            channel = int(data['channel'])
        except (TypeError, ValueError):
            raise ParseError(f"通道号必须是整数: {data['channel']}")
        
        try:
            old_value = int(data['old_value'])
        except (TypeError, ValueError):
            raise ParseError(f"旧值必须是整数: {data['old_value']}")
        
        try:
            new_value = int(data['new_value'])
        except (TypeError, ValueError):
            raise ParseError(f"新值必须是整数: {data['new_value']}")
        
        reason = data.get('reason', '').strip()
        
        return ChannelChange(
            channel=channel,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )
