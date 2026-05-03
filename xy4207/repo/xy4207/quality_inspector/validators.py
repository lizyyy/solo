"""
数据校验模块
用于验证输入数据的字段完整性和格式正确性
"""

import os
import json
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from quality_inspector.models import (
    Conversation,
    Message,
    SpeakerType,
    Violation,
    ViolationType,
    Severity,
)


class ValidationError(Exception):
    """数据校验错误异常"""
    
    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        value: Any = None,
        source_file: Optional[str] = None
    ):
        super().__init__(message)
        self.message = message
        self.field = field
        self.value = value
        self.source_file = source_file
    
    def __str__(self) -> str:
        parts = [self.message]
        if self.field:
            parts.append(f"字段: {self.field}")
        if self.value is not None:
            parts.append(f"值: {repr(self.value)}")
        if self.source_file:
            parts.append(f"文件: {self.source_file}")
        return " | ".join(parts)
    
    def to_violation(self) -> Violation:
        """转换为违规记录"""
        return Violation(
            violation_type=ViolationType.INVALID_FORMAT,
            severity=Severity.HIGH if self.field else Severity.MEDIUM,
            description=self.message,
            extra_data={
                "field": self.field,
                "value": str(self.value) if self.value is not None else None,
                "source_file": self.source_file
            }
        )


class DataValidator:
    """数据校验器"""
    
    def __init__(self, strict_mode: bool = False):
        """
        初始化校验器
        
        Args:
            strict_mode: 是否严格模式，严格模式下任何字段缺失都会报错
        """
        self.strict_mode = strict_mode
        self.errors: List[ValidationError] = []
    
    def validate_required_fields(
        self,
        data: Dict[str, Any],
        required_fields: List[str],
        source_file: str = ""
    ) -> bool:
        """
        校验必填字段
        
        Args:
            data: 数据字典
            required_fields: 必填字段列表
            source_file: 源文件路径
            
        Returns:
            是否通过校验
        """
        valid = True
        for field in required_fields:
            if field not in data or data[field] in (None, "", []):
                error = ValidationError(
                    message=f"必填字段缺失或为空",
                    field=field,
                    value=data.get(field),
                    source_file=source_file
                )
                self.errors.append(error)
                
                if self.strict_mode:
                    raise error
                
                valid = False
        
        return valid
    
    def validate_field_type(
        self,
        data: Dict[str, Any],
        field: str,
        expected_type: type,
        source_file: str = ""
    ) -> bool:
        """
        校验字段类型
        
        Args:
            data: 数据字典
            field: 字段名
            expected_type: 期望类型
            source_file: 源文件路径
            
        Returns:
            是否通过校验
        """
        if field not in data:
            return True  # 字段不存在，跳过类型校验
        
        value = data[field]
        if value is None:
            return True  # 空值跳过类型校验
        
        if not isinstance(value, expected_type):
            error = ValidationError(
                message=f"字段类型错误，期望类型: {expected_type.__name__}",
                field=field,
                value=value,
                source_file=source_file
            )
            self.errors.append(error)
            
            if self.strict_mode:
                raise error
            
            return False
        
        return True
    
    def validate_conversation_data(
        self,
        data: Dict[str, Any],
        source_file: str = ""
    ) -> Tuple[bool, List[ValidationError]]:
        """
        校验对话数据
        
        Args:
            data: 对话数据字典
            source_file: 源文件路径
            
        Returns:
            (是否通过校验, 错误列表)
        """
        # 清空之前的错误
        self.errors = []
        
        # 必填字段校验
        required_fields = ["messages"]
        if self.strict_mode:
            required_fields.extend(["agent_name", "customer_name", "conversation_time"])
        
        self.validate_required_fields(data, required_fields, source_file)
        
        # 类型校验
        type_checks = [
            ("messages", list),
            ("agent_name", str),
            ("customer_name", str),
            ("conversation_id", str),
        ]
        
        for field, expected_type in type_checks:
            self.validate_field_type(data, field, expected_type, source_file)
        
        # 校验消息列表
        messages = data.get("messages", [])
        if messages:
            for i, msg in enumerate(messages):
                if not isinstance(msg, dict):
                    error = ValidationError(
                        message=f"消息格式错误，应为字典类型",
                        field=f"messages[{i}]",
                        value=msg,
                        source_file=source_file
                    )
                    self.errors.append(error)
                    continue
                
                # 校验消息必填字段
                msg_required = ["content"]
                if self.strict_mode:
                    msg_required.extend(["speaker", "index"])
                
                for field in msg_required:
                    if field not in msg or msg[field] in (None, ""):
                        error = ValidationError(
                            message=f"消息字段缺失或为空",
                            field=f"messages[{i}].{field}",
                            value=msg.get(field),
                            source_file=source_file
                        )
                        self.errors.append(error)
                
                # 校验说话者类型
                speaker = msg.get("speaker", "")
                if speaker and isinstance(speaker, str):
                    valid_speakers = ["agent", "customer", "unknown", "坐席", "客户", "客服", "用户"]
                    if speaker.lower() not in [s.lower() for s in valid_speakers]:
                        error = ValidationError(
                            message=f"未知的说话者类型",
                            field=f"messages[{i}].speaker",
                            value=speaker,
                            source_file=source_file
                        )
                        self.errors.append(error)
        
        is_valid = len(self.errors) == 0
        return is_valid, self.errors.copy()
    
    def validate_file(self, file_path: str) -> Tuple[bool, List[ValidationError], Optional[Dict]]:
        """
        校验文件
        
        Args:
            file_path: 文件路径
            
        Returns:
            (是否通过校验, 错误列表, 解析的数据)
        """
        if not os.path.exists(file_path):
            error = ValidationError(
                message=f"文件不存在",
                source_file=file_path
            )
            self.errors = [error]
            return False, [error], None
        
        if not os.path.isfile(file_path):
            error = ValidationError(
                message=f"路径不是文件",
                source_file=file_path
            )
            self.errors = [error]
            return False, [error], None
        
        # 根据文件扩展名选择解析方式
        ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if ext == ".json":
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            elif ext in [".md", ".markdown"]:
                # Markdown文件，先尝试解析为对话格式
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                # 尝试解析为JSON（如果是Markdown包裹的JSON）
                try:
                    # 提取```json和```之间的内容
                    import re
                    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
                    if json_match:
                        data = json.loads(json_match.group(1))
                    else:
                        # 尝试直接解析整个内容
                        data = json.loads(content)
                except json.JSONDecodeError:
                    # 如果不是JSON格式，按纯Markdown处理
                    # 这里返回None，由上层处理
                    data = {"_is_markdown": True, "content": content}
            else:
                error = ValidationError(
                    message=f"不支持的文件格式: {ext}",
                    source_file=file_path
                )
                self.errors = [error]
                return False, [error], None
        
        except json.JSONDecodeError as e:
            error = ValidationError(
                message=f"JSON解析错误: {str(e)}",
                source_file=file_path
            )
            self.errors = [error]
            return False, [error], None
        except UnicodeDecodeError as e:
            error = ValidationError(
                message=f"文件编码错误: {str(e)}",
                source_file=file_path
            )
            self.errors = [error]
            return False, [error], None
        except Exception as e:
            error = ValidationError(
                message=f"文件读取错误: {str(e)}",
                source_file=file_path
            )
            self.errors = [error]
            return False, [error], None
        
        # 如果是纯Markdown，跳过数据校验
        if data and "_is_markdown" in data:
            return True, [], data
        
        # 校验数据格式
        is_valid, errors = self.validate_conversation_data(data, file_path)
        
        return is_valid, errors, data


def validate_conversation(
    data: Dict[str, Any],
    strict_mode: bool = False,
    source_file: str = ""
) -> Tuple[bool, List[ValidationError]]:
    """
    校验对话数据的便捷函数
    
    Args:
        data: 对话数据字典
        strict_mode: 是否严格模式
        source_file: 源文件路径
        
    Returns:
        (是否通过校验, 错误列表)
    """
    validator = DataValidator(strict_mode=strict_mode)
    return validator.validate_conversation_data(data, source_file)


def validate_file(
    file_path: str,
    strict_mode: bool = False
) -> Tuple[bool, List[ValidationError], Optional[Dict]]:
    """
    校验文件的便捷函数
    
    Args:
        file_path: 文件路径
        strict_mode: 是否严格模式
        
    Returns:
        (是否通过校验, 错误列表, 解析的数据)
    """
    validator = DataValidator(strict_mode=strict_mode)
    return validator.validate_file(file_path)


def validate_directory(
    directory_path: str,
    strict_mode: bool = False,
    recursive: bool = False
) -> Dict[str, Tuple[bool, List[ValidationError], Optional[Dict]]]:
    """
    校验目录中的所有JSON/Markdown文件
    
    Args:
        directory_path: 目录路径
        strict_mode: 是否严格模式
        recursive: 是否递归处理子目录
        
    Returns:
        字典，键为文件路径，值为(是否通过校验, 错误列表, 解析的数据)
    """
    if not os.path.exists(directory_path):
        raise ValidationError(
            message=f"目录不存在",
            source_file=directory_path
        )
    
    if not os.path.isdir(directory_path):
        raise ValidationError(
            message=f"路径不是目录",
            source_file=directory_path
        )
    
    results = {}
    validator = DataValidator(strict_mode=strict_mode)
    
    # 遍历目录
    for root, dirs, files in os.walk(directory_path):
        for filename in files:
            if filename.startswith("."):
                continue  # 跳过隐藏文件
            
            ext = os.path.splitext(filename)[1].lower()
            if ext not in [".json", ".md", ".markdown"]:
                continue  # 只处理JSON和Markdown文件
            
            file_path = os.path.join(root, filename)
            is_valid, errors, data = validator.validate_file(file_path)
            results[file_path] = (is_valid, errors, data)
        
        if not recursive:
            break  # 不递归的话，只处理第一层
    
    return results
