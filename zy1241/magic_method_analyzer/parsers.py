"""文件解析器：读取 YAML、JSONL 和 Python snippets"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, TextIO, Union

import yaml

from .models import (
    MagicCase,
    MagicMethodCall,
    MagicMethodType,
)


class YAMLParser:
    """YAML 文件解析器（magic-cases.yaml）"""
    
    @staticmethod
    def parse_file(file_path: Union[str, Path]) -> List[MagicCase]:
        """解析 magic-cases.yaml 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"YAML 文件不存在: {file_path}")
        
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = yaml.safe_load(f)
            except yaml.YAMLError as e:
                raise ValueError(f"YAML 解析错误: {e}")
        
        if not data:
            return []
        
        if "cases" not in data:
            raise ValueError("YAML 文件格式错误：缺少 'cases' 字段")
        
        cases = []
        for idx, case_data in enumerate(data["cases"]):
            try:
                case = YAMLParser._parse_case(case_data, idx)
                cases.append(case)
            except KeyError as e:
                raise ValueError(f"用例 {idx} 格式错误：缺少字段 {e}")
            except ValueError as e:
                raise ValueError(f"用例 {idx} 格式错误：{e}")
        
        return cases
    
    @staticmethod
    def _parse_case(case_data: Dict[str, Any], idx: int) -> MagicCase:
        """解析单个测试用例"""
        # 必需字段
        case_id = case_data.get("id") or case_data.get("case_id") or f"case_{idx:03d}"
        name = case_data["name"]
        description = case_data["description"]
        category = case_data["category"]
        expected_behavior = case_data.get("expected_behavior", [])
        if isinstance(expected_behavior, str):
            expected_behavior = [expected_behavior]
        
        code_snippet = case_data.get("code_snippet") or case_data.get("code")
        if code_snippet is None:
            raise ValueError("缺少 'code_snippet' 或 'code' 字段")
        
        # 元数据
        metadata = {
            k: v for k, v in case_data.items()
            if k not in ["id", "case_id", "name", "description", "category", 
                        "expected_behavior", "code_snippet", "code"]
        }
        
        return MagicCase(
            case_id=case_id,
            name=name,
            description=description,
            category=category,
            expected_behavior=expected_behavior,
            code_snippet=code_snippet,
            metadata=metadata,
        )
    
    @staticmethod
    def validate_format(file_path: Union[str, Path]) -> tuple:
        """验证 YAML 文件格式，返回 (是否有效, 错误信息列表)"""
        errors = []
        warnings = []
        
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                errors.append(f"文件不存在: {file_path}")
                return False, errors, warnings
            
            with open(file_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            
            if data is None:
                warnings.append("文件为空")
                return True, errors, warnings
            
            if not isinstance(data, dict):
                errors.append("根节点必须是字典类型")
                return False, errors, warnings
            
            if "cases" not in data:
                errors.append("缺少 'cases' 字段")
            else:
                if not isinstance(data["cases"], list):
                    errors.append("'cases' 必须是列表类型")
                else:
                    for idx, case in enumerate(data["cases"]):
                        case_errors, case_warnings = YAMLParser._validate_case(case, idx)
                        errors.extend(case_errors)
                        warnings.extend(case_warnings)
            
            return len(errors) == 0, errors, warnings
            
        except yaml.YAMLError as e:
            errors.append(f"YAML 语法错误: {e}")
            return False, errors, warnings
        except Exception as e:
            errors.append(f"解析错误: {e}")
            return False, errors, warnings
    
    @staticmethod
    def _validate_case(case_data: Dict[str, Any], idx: int) -> tuple:
        """验证单个用例格式"""
        errors = []
        warnings = []
        
        if not isinstance(case_data, dict):
            errors.append(f"用例 {idx}: 必须是字典类型")
            return errors, warnings
        
        required_fields = ["name", "description", "category"]
        for field in required_fields:
            if field not in case_data:
                errors.append(f"用例 {idx}: 缺少必需字段 '{field}'")
        
        if "code_snippet" not in case_data and "code" not in case_data:
            errors.append(f"用例 {idx}: 缺少 'code_snippet' 或 'code' 字段")
        
        if "expected_behavior" in case_data:
            if not isinstance(case_data["expected_behavior"], (list, str)):
                warnings.append(f"用例 {idx}: 'expected_behavior' 应该是列表或字符串")
        
        return errors, warnings


class JSONLParser:
    """JSONL 文件解析器（events.jsonl）"""
    
    # 方法名到枚举的映射
    METHOD_MAP: Dict[str, MagicMethodType] = {
        "__getattribute__": MagicMethodType.GETATTRIBUTE,
        "__getattr__": MagicMethodType.GETATTR,
        "__setattr__": MagicMethodType.SETATTR,
        "__delattr__": MagicMethodType.DELATTR,
        "__call__": MagicMethodType.CALL,
        "__len__": MagicMethodType.LEN,
        "__bool__": MagicMethodType.BOOL,
        "__eq__": MagicMethodType.EQ,
        "__hash__": MagicMethodType.HASH,
        "__enter__": MagicMethodType.ENTER,
        "__exit__": MagicMethodType.EXIT,
        "__str__": MagicMethodType.STR,
        "__repr__": MagicMethodType.REPR,
        "__init__": MagicMethodType.INIT,
        "__new__": MagicMethodType.NEW,
    }
    
    @staticmethod
    def parse_file(file_path: Union[str, Path]) -> List[MagicMethodCall]:
        """解析 events.jsonl 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"JSONL 文件不存在: {file_path}")
        
        calls = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"第 {line_num} 行 JSON 解析错误: {e}")
                
                try:
                    call = JSONLParser._parse_call(data, line_num)
                    calls.append(call)
                except KeyError as e:
                    raise ValueError(f"第 {line_num} 行缺少字段: {e}")
                except ValueError as e:
                    raise ValueError(f"第 {line_num} 行格式错误: {e}")
        
        return calls
    
    @staticmethod
    def _parse_call(data: Dict[str, Any], line_num: int) -> MagicMethodCall:
        """解析单个方法调用记录"""
        # 必需字段
        method_name = data["method"]
        if method_name not in JSONLParser.METHOD_MAP:
            raise ValueError(f"未知的魔术方法: {method_name}")
        
        method_type = JSONLParser.METHOD_MAP[method_name]
        
        # 解析时间戳
        timestamp_str = data.get("timestamp") or data.get("time")
        if timestamp_str:
            try:
                if isinstance(timestamp_str, str):
                    # 尝试多种格式
                    for fmt in [
                        "%Y-%m-%dT%H:%M:%S.%f",
                        "%Y-%m-%dT%H:%M:%S",
                        "%Y-%m-%d %H:%M:%S.%f",
                        "%Y-%m-%d %H:%M:%S",
                    ]:
                        try:
                            timestamp = datetime.strptime(timestamp_str, fmt)
                            break
                        except ValueError:
                            continue
                    else:
                        timestamp = datetime.fromisoformat(timestamp_str)
                else:
                    # 可能是 Unix 时间戳
                    timestamp = datetime.fromtimestamp(float(timestamp_str))
            except (ValueError, TypeError):
                raise ValueError(f"无法解析时间戳: {timestamp_str}")
        else:
            timestamp = datetime.now()
        
        # 其他字段
        caller = data.get("caller", "unknown")
        target = data.get("target", "unknown")
        
        # 参数
        args = tuple(data.get("args", []))
        kwargs = data.get("kwargs", {})
        
        # 结果和异常
        result = data.get("result")
        exception_data = data.get("exception")
        exception = None
        if exception_data:
            if isinstance(exception_data, str):
                exception = Exception(exception_data)
            elif isinstance(exception_data, dict):
                exc_type = exception_data.get("type", "Exception")
                exc_msg = exception_data.get("message", str(exception_data))
                exception = type(exc_type, (Exception,), {})(exc_msg)
        
        # 调用栈
        stack_trace = data.get("stack_trace", data.get("stack", []))
        if isinstance(stack_trace, str):
            stack_trace = [stack_trace]
        
        # 元数据
        metadata = {
            k: v for k, v in data.items()
            if k not in ["method", "timestamp", "time", "caller", "target",
                        "args", "kwargs", "result", "exception", "stack_trace", "stack"]
        }
        
        return MagicMethodCall(
            method_type=method_type,
            timestamp=timestamp,
            caller=caller,
            target=target,
            args=args,
            kwargs=kwargs,
            result=result,
            exception=exception,
            stack_trace=stack_trace,
            metadata=metadata,
        )
    
    @staticmethod
    def validate_format(file_path: Union[str, Path]) -> tuple:
        """验证 JSONL 文件格式"""
        errors = []
        warnings = []
        
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                errors.append(f"文件不存在: {file_path}")
                return False, errors, warnings
            
            with open(file_path, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError as e:
                        errors.append(f"第 {line_num} 行: JSON 语法错误 - {e}")
                        continue
                    
                    if not isinstance(data, dict):
                        errors.append(f"第 {line_num} 行: 必须是 JSON 对象")
                        continue
                    
                    if "method" not in data:
                        errors.append(f"第 {line_num} 行: 缺少 'method' 字段")
                    else:
                        method = data["method"]
                        if method not in JSONLParser.METHOD_MAP:
                            warnings.append(f"第 {line_num} 行: 未知方法 '{method}'")
                    
                    if "timestamp" not in data and "time" not in data:
                        warnings.append(f"第 {line_num} 行: 缺少时间戳字段")
            
            return len(errors) == 0, errors, warnings
            
        except Exception as e:
            errors.append(f"读取错误: {e}")
            return False, errors, warnings


class SnippetParser:
    """Python 代码片段解析器（snippets/*.py）"""
    
    @staticmethod
    def parse_directory(dir_path: Union[str, Path]) -> Dict[str, str]:
        """解析 snippets 目录下的所有 Python 文件"""
        dir_path = Path(dir_path)
        if not dir_path.exists():
            raise FileNotFoundError(f"目录不存在: {dir_path}")
        
        if not dir_path.is_dir():
            raise NotADirectoryError(f"不是目录: {dir_path}")
        
        snippets = {}
        for py_file in sorted(dir_path.glob("*.py")):
            try:
                content = py_file.read_text(encoding="utf-8")
                snippets[py_file.name] = content
            except Exception as e:
                raise ValueError(f"读取文件 {py_file} 失败: {e}")
        
        return snippets
    
    @staticmethod
    def parse_file(file_path: Union[str, Path]) -> str:
        """解析单个 Python 文件"""
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            return file_path.read_text(encoding="utf-8")
        except Exception as e:
            raise ValueError(f"读取文件失败: {e}")
    
    @staticmethod
    def extract_magic_methods(content: str) -> Dict[str, List[Dict]]:
        """从代码中提取魔术方法定义"""
        import ast
        
        try:
            tree = ast.parse(content)
        except SyntaxError as e:
            raise ValueError(f"代码语法错误: {e}")
        
        methods = {}
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                class_name = node.name
                class_methods = []
                
                for item in node.body:
                    if isinstance(item, ast.FunctionDef):
                        method_name = item.name
                        if method_name.startswith("__") and method_name.endswith("__"):
                            # 这是一个魔术方法
                            class_methods.append({
                                "name": method_name,
                                "lineno": item.lineno,
                                "args": [arg.arg for arg in item.args.args],
                                "has_decorator": len(item.decorator_list) > 0,
                            })
                
                if class_methods:
                    methods[class_name] = class_methods
        
        return methods
    
    @staticmethod
    def validate_syntax(file_path: Union[str, Path]) -> tuple:
        """验证 Python 代码语法"""
        try:
            file_path = Path(file_path)
            content = file_path.read_text(encoding="utf-8")
            
            import ast
            ast.parse(content)
            
            return True, [], []
        except SyntaxError as e:
            return False, [f"语法错误: 第 {e.lineno} 行 - {e.msg}"], []
        except Exception as e:
            return False, [f"验证错误: {e}"], []
