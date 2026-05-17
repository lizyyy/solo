import json
import re
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from .models import (
    TopologyData, Exchange, Queue, Binding, Policy,
    ValidationError, ExchangeType
)


class LineNumberedJSONParser:
    def __init__(self, content: str, lines: List[str]):
        self.content = content
        self.lines = lines
        self.line_offsets = self._calculate_line_offsets()
    
    def _calculate_line_offsets(self) -> List[int]:
        offsets = [0]
        current = 0
        for line in self.lines:
            current += len(line)
            offsets.append(current)
        return offsets
    
    def _get_line_number(self, char_pos: int) -> int:
        for i, offset in enumerate(self.line_offsets):
            if char_pos < offset:
                return i
        return len(self.lines)
    
    def find_object_line_numbers(self, obj_str: str) -> Tuple[int, int]:
        pattern = re.escape(obj_str)
        match = re.search(pattern, self.content)
        if match:
            start_line = self._get_line_number(match.start())
            end_line = self._get_line_number(match.end())
            return (start_line, end_line)
        return (None, None)


class TopologyParser:
    def __init__(self):
        self.topology = TopologyData()
        self._json_parser = None
        self._raw_content = None

    def parse_file(self, file_path: str) -> TopologyData:
        file_path = Path(file_path)
        if not file_path.exists():
            self.topology.errors.append(ValidationError(
                error_type="FileNotFound",
                message=f"文件不存在: {file_path}",
                raw_data=str(file_path)
            ))
            return self.topology

        if file_path.suffix.lower() != '.json':
            self.topology.errors.append(ValidationError(
                error_type="InvalidFileType",
                message=f"不支持的文件类型，需要JSON文件: {file_path}",
                raw_data=str(file_path)
            ))
            return self.topology

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                content = ''.join(lines)
        except Exception as e:
            self.topology.errors.append(ValidationError(
                error_type="FileReadError",
                message=f"读取文件失败: {str(e)}",
                raw_data=str(file_path)
            ))
            return self.topology

        self._raw_content = content
        self._json_parser = LineNumberedJSONParser(content, lines)

        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            line_no = e.lineno
            self.topology.errors.append(ValidationError(
                line_number=line_no,
                error_type="JSONDecodeError",
                message=f"JSON解析失败: {str(e)}",
                raw_data=lines[line_no - 1].strip() if line_no <= len(lines) else content
            ))
            return self.topology

        self._parse_topology(data)
        return self.topology

    def _parse_topology(self, data: Dict[str, Any]):
        if not isinstance(data, dict):
            self.topology.errors.append(ValidationError(
                error_type="InvalidStructure",
                message="根节点必须是对象",
                raw_data=str(type(data))
            ))
            return

        self._parse_exchanges(data.get('exchanges', []))
        self._parse_queues(data.get('queues', []))
        self._parse_bindings(data.get('bindings', []))
        self._parse_policies(data.get('policies', []))

    def _find_item_line_number(self, item: Any, field_name: str, idx: int) -> Optional[int]:
        if not self._json_parser or not self._raw_content:
            return None
        
        pattern = rf'"{field_name}"\s*:\s*\['
        match = re.search(pattern, self._raw_content)
        if not match:
            return None
        
        array_start_pos = match.end()
        content_after_array_start = self._raw_content[array_start_pos:]
        
        brace_count = 0
        in_object = False
        object_start_pos = None
        current_object_idx = 0
        
        for i, char in enumerate(content_after_array_start):
            if char == '{':
                if brace_count == 0:
                    in_object = True
                    object_start_pos = array_start_pos + i
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and in_object:
                    if current_object_idx == idx:
                        return self._json_parser._get_line_number(object_start_pos)
                    current_object_idx += 1
                    in_object = False
                    if current_object_idx > idx:
                        break
        
        array_start_line = self._json_parser._get_line_number(array_start_pos)
        return array_start_line + idx

    def _parse_exchanges(self, exchanges: List[Any]):
        for idx, item in enumerate(exchanges):
            line_no = self._find_item_line_number(item, 'exchanges', idx)
            try:
                if not isinstance(item, dict):
                    raise ValueError("exchange必须是对象")
                
                if 'name' not in item:
                    raise ValueError("缺少必填字段: name")

                exchange = Exchange(**item)
                self.topology.exchanges.append(exchange)
            except Exception as e:
                self.topology.errors.append(ValidationError(
                    line_number=line_no,
                    field="exchanges",
                    error_type="ExchangeParseError",
                    message=f"Exchange解析失败: {str(e)}",
                    raw_data=json.dumps(item, ensure_ascii=False)
                ))

    def _parse_queues(self, queues: List[Any]):
        for idx, item in enumerate(queues):
            line_no = self._find_item_line_number(item, 'queues', idx)
            try:
                if not isinstance(item, dict):
                    raise ValueError("queue必须是对象")
                
                if 'name' not in item:
                    raise ValueError("缺少必填字段: name")

                queue = Queue(**item)
                self.topology.queues.append(queue)
            except Exception as e:
                self.topology.errors.append(ValidationError(
                    line_number=line_no,
                    field="queues",
                    error_type="QueueParseError",
                    message=f"Queue解析失败: {str(e)}",
                    raw_data=json.dumps(item, ensure_ascii=False)
                ))

    def _parse_bindings(self, bindings: List[Any]):
        for idx, item in enumerate(bindings):
            line_no = self._find_item_line_number(item, 'bindings', idx)
            try:
                if not isinstance(item, dict):
                    raise ValueError("binding必须是对象")
                
                required_fields = ['source', 'destination']
                for field in required_fields:
                    if field not in item:
                        raise ValueError(f"缺少必填字段: {field}")

                binding = Binding(**item)
                self.topology.bindings.append(binding)
            except Exception as e:
                self.topology.errors.append(ValidationError(
                    line_number=line_no,
                    field="bindings",
                    error_type="BindingParseError",
                    message=f"Binding解析失败: {str(e)}",
                    raw_data=json.dumps(item, ensure_ascii=False)
                ))

    def _parse_policies(self, policies: List[Any]):
        for idx, item in enumerate(policies):
            line_no = self._find_item_line_number(item, 'policies', idx)
            try:
                if not isinstance(item, dict):
                    raise ValueError("policy必须是对象")
                
                required_fields = ['name', 'pattern', 'definition']
                for field in required_fields:
                    if field not in item:
                        raise ValueError(f"缺少必填字段: {field}")

                policy = Policy(**item)
                self.topology.policies.append(policy)
            except Exception as e:
                self.topology.errors.append(ValidationError(
                    line_number=line_no,
                    field="policies",
                    error_type="PolicyParseError",
                    message=f"Policy解析失败: {str(e)}",
                    raw_data=json.dumps(item, ensure_ascii=False)
                ))

    def parse_directory(self, dir_path: str) -> TopologyData:
        dir_path = Path(dir_path)
        if not dir_path.exists() or not dir_path.is_dir():
            self.topology.errors.append(ValidationError(
                error_type="DirectoryNotFound",
                message=f"目录不存在或不是目录: {dir_path}",
                raw_data=str(dir_path)
            ))
            return self.topology

        json_files = sorted(dir_path.glob('*.json'))
        
        if not json_files:
            self.topology.errors.append(ValidationError(
                error_type="NoJSONFiles",
                message=f"目录中没有找到JSON文件: {dir_path}",
                raw_data=str(dir_path)
            ))
            return self.topology

        for json_file in json_files:
            sub_parser = TopologyParser()
            sub_topology = sub_parser.parse_file(str(json_file))
            for err in sub_topology.errors:
                if err.raw_data:
                    err.raw_data = f"{json_file}: {err.raw_data}"
            self.topology.exchanges.extend(sub_topology.exchanges)
            self.topology.queues.extend(sub_topology.queues)
            self.topology.bindings.extend(sub_topology.bindings)
            self.topology.policies.extend(sub_topology.policies)
            self.topology.errors.extend(sub_topology.errors)

        return self.topology
