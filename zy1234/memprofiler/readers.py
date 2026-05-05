"""
数据读取模块
负责读取各种格式的内存相关数据
"""

import os
import re
import json
import pickle
import tracemalloc
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass

from memprofiler.models import ObjectInfo, ReferenceRelation, SnapshotInfo
from memprofiler.exceptions import (
    InvalidSnapshotError,
    InvalidJsonError,
    InvalidGCLogError,
    InvalidScriptError,
    DataFormatError,
    FileNotFoundError,
)
from memprofiler.utils import (
    safe_json_loads,
    validate_json_structure,
    extract_memory_patterns,
    parse_gc_log_line,
    extract_code_snippets,
    format_size,
)


@dataclass
class ScriptAnalysisResult:
    """脚本分析结果"""
    file_path: str
    memory_patterns: Dict[str, List[str]]
    code_snippets: List[Dict[str, Any]]
    has_del_method: bool
    has_weakref: bool
    has_gc_related: bool
    raw_content: str


@dataclass
class GCLogAnalysisResult:
    """GC日志分析结果"""
    file_path: str
    uncollectable_objects: List[Dict[str, Any]]
    cycles: List[Dict[str, Any]]
    del_method_objects: List[Dict[str, Any]]
    total_entries: int


@dataclass
class RefJsonAnalysisResult:
    """引用关系JSON分析结果"""
    file_path: str
    objects: List[ObjectInfo]
    references: List[ReferenceRelation]
    metadata: Dict[str, Any]


class BaseReader:
    """基础读取器"""
    
    def __init__(self, file_path: str):
        self.file_path = file_path
        self._validate_file()
    
    def _validate_file(self):
        """验证文件是否存在"""
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(self.file_path, self.__class__.__name__)
        
        if not os.path.isfile(self.file_path):
            raise DataFormatError(
                f"路径不是文件: {self.file_path}",
                file_path=self.file_path
            )


class ScriptReader(BaseReader):
    """脚本片段读取器"""
    
    MEMORY_KEYWORDS = [
        r"__del__",
        r"weakref",
        r"gc\.",
        r"sys\.getrefcount",
        r"memory.*leak",
        r"循环引用",
        r"内存泄漏",
    ]
    
    def read(self) -> ScriptAnalysisResult:
        """读取并分析脚本"""
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            try:
                with open(self.file_path, "r", encoding="latin-1") as f:
                    content = f.read()
            except Exception as e:
                raise InvalidScriptError(
                    f"无法读取脚本文件: {e}",
                    file_path=self.file_path,
                    suggestion="检查文件编码是否为UTF-8"
                )
        
        patterns = extract_memory_patterns(content)
        
        snippets = extract_code_snippets(
            self.file_path,
            self.MEMORY_KEYWORDS,
            context_lines=3
        )
        
        has_del = any(k in patterns["del_method"] for k in ["__del__"])
        has_weakref = len(patterns["weakref"]) > 0
        has_gc = len(patterns["gc_related"]) > 0
        
        return ScriptAnalysisResult(
            file_path=self.file_path,
            memory_patterns=patterns,
            code_snippets=snippets,
            has_del_method=has_del,
            has_weakref=has_weakref,
            has_gc_related=has_gc,
            raw_content=content
        )


class SnapshotReader(BaseReader):
    """tracemalloc快照读取器"""
    
    def read(self) -> SnapshotInfo:
        """读取快照文件"""
        ext = os.path.splitext(self.file_path)[1].lower()
        
        if ext == ".snap":
            return self._read_binary_snapshot()
        elif ext == ".txt":
            return self._read_text_snapshot()
        else:
            raise InvalidSnapshotError(
                f"不支持的快照格式: {ext}",
                file_path=self.file_path,
                suggestion="支持的格式: .snap (二进制), .txt (文本摘要)"
            )
    
    def _read_binary_snapshot(self) -> SnapshotInfo:
        """读取二进制格式的快照"""
        try:
            snapshot = tracemalloc.Snapshot.load(self.file_path)
        except Exception as e:
            raise InvalidSnapshotError(
                f"无法加载快照: {e}",
                file_path=self.file_path,
                suggestion="确保这是有效的 tracemalloc 快照文件"
            )
        
        stats = snapshot.statistics("lineno")
        total_size = sum(stat.size for stat in stats)
        total_objects = sum(stat.count for stat in stats)
        
        top_types = []
        type_stats = {}
        for stat in stats:
            if stat.traceback:
                frame = stat.traceback[0]
                filename = os.path.basename(frame.filename)
                key = f"{filename}:{frame.lineno}"
            else:
                key = "<unknown>"
            
            if key not in type_stats:
                type_stats[key] = {"size": 0, "count": 0}
            type_stats[key]["size"] += stat.size
            type_stats[key]["count"] += stat.count
        
        sorted_types = sorted(
            type_stats.items(),
            key=lambda x: x[1]["size"],
            reverse=True
        )[:10]
        
        top_types = [
            {
                "location": loc,
                "size": data["size"],
                "size_formatted": format_size(data["size"]),
                "count": data["count"]
            }
            for loc, data in sorted_types
        ]
        
        return SnapshotInfo(
            snapshot_id=os.path.basename(self.file_path),
            name=os.path.basename(self.file_path),
            timestamp=datetime.fromtimestamp(os.path.getmtime(self.file_path)),
            total_objects=total_objects,
            total_size=total_size,
            top_types=top_types,
            source_file=self.file_path
        )
    
    def _read_text_snapshot(self) -> SnapshotInfo:
        """读取文本格式的快照摘要"""
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception as e:
            raise InvalidSnapshotError(
                f"无法读取文本快照: {e}",
                file_path=self.file_path
            )
        
        total_size = 0
        total_objects = 0
        top_types = []
        
        size_pattern = r"(\d+)\s*(B|KB|MB|GB)?"
        count_pattern = r"(\d+)\s+blocks?"
        
        for line in lines:
            size_match = re.search(size_pattern, line, re.IGNORECASE)
            count_match = re.search(count_pattern, line, re.IGNORECASE)
            
            if size_match:
                try:
                    size = int(size_match.group(1))
                    unit = size_match.group(2) or "B"
                    multiplier = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}
                    total_size += size * multiplier.get(unit.upper(), 1)
                except:
                    pass
            
            if count_match:
                try:
                    total_objects += int(count_match.group(1))
                except:
                    pass
        
        if total_size == 0 and total_objects == 0:
            raise InvalidSnapshotError(
                "无法从文本快照中提取有效信息",
                file_path=self.file_path,
                suggestion="文本快照应包含大小和数量信息，如 '100 KB in 50 blocks'"
            )
        
        return SnapshotInfo(
            snapshot_id=os.path.basename(self.file_path),
            name=os.path.basename(self.file_path),
            timestamp=datetime.fromtimestamp(os.path.getmtime(self.file_path)),
            total_objects=total_objects,
            total_size=total_size,
            top_types=top_types,
            source_file=self.file_path
        )
    
    def compare_with(self, other: "SnapshotReader") -> Dict[str, Any]:
        """与另一个快照比较"""
        snap1 = self.read()
        snap2 = other.read()
        
        size_diff = snap2.total_size - snap1.total_size
        count_diff = snap2.total_objects - snap1.total_objects
        
        return {
            "before": {
                "size": snap1.total_size,
                "size_formatted": format_size(snap1.total_size),
                "objects": snap1.total_objects
            },
            "after": {
                "size": snap2.total_size,
                "size_formatted": format_size(snap2.total_size),
                "objects": snap2.total_objects
            },
            "diff": {
                "size": size_diff,
                "size_formatted": format_size(abs(size_diff)),
                "size_change": "增长" if size_diff > 0 else "减少" if size_diff < 0 else "不变",
                "objects": count_diff,
                "objects_change": "增长" if count_diff > 0 else "减少" if count_diff < 0 else "不变"
            }
        }


class GCLogReader(BaseReader):
    """GC日志读取器"""
    
    REQUIRED_PATTERNS = [
        r"uncollectable",
        r"cycle.*detected",
        r"__del__",
        r"gc:",
    ]
    
    def read(self) -> GCLogAnalysisResult:
        """读取并分析GC日志"""
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except UnicodeDecodeError:
            try:
                with open(self.file_path, "r", encoding="latin-1") as f:
                    lines = f.readlines()
            except Exception as e:
                raise InvalidGCLogError(
                    f"无法读取GC日志: {e}",
                    file_path=self.file_path
                )
        
        uncollectable = []
        cycles = []
        del_objects = []
        total_entries = 0
        
        for i, line in enumerate(lines):
            parsed = parse_gc_log_line(line)
            if not parsed:
                continue
            
            total_entries += 1
            
            if parsed.get("type") == "uncollectable":
                uncollectable.append({
                    "line_number": i + 1,
                    "obj_type": parsed.get("obj_type"),
                    "address": parsed.get("address"),
                    "line_content": line.strip()
                })
            
            if "cycle_objects" in parsed:
                cycles.append({
                    "line_number": i + 1,
                    "object_count": parsed["cycle_objects"],
                    "line_content": line.strip()
                })
            
            if parsed.get("has_del"):
                del_objects.append({
                    "line_number": i + 1,
                    "line_content": line.strip()
                })
        
        if total_entries == 0:
            has_gc_pattern = any(
                re.search(p, "".join(lines), re.IGNORECASE)
                for p in self.REQUIRED_PATTERNS
            )
            
            if not has_gc_pattern:
                raise InvalidGCLogError(
                    "日志文件中未检测到GC相关模式",
                    file_path=self.file_path,
                    suggestion="请确保使用 gc.set_debug(gc.DEBUG_LEAK) 启用了GC调试日志"
                )
        
        return GCLogAnalysisResult(
            file_path=self.file_path,
            uncollectable_objects=uncollectable,
            cycles=cycles,
            del_method_objects=del_objects,
            total_entries=total_entries
        )


class RefJsonReader(BaseReader):
    """引用关系JSON读取器"""
    
    REQUIRED_FIELDS = ["objects"]
    OBJECT_REQUIRED_FIELDS = ["id", "type"]
    
    def read(self) -> RefJsonAnalysisResult:
        """读取并解析引用关系JSON"""
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            raise InvalidJsonError(
                f"无法读取JSON文件: {e}",
                file_path=self.file_path
            )
        
        data, errors = safe_json_loads(content, self.file_path)
        
        if data is None:
            raise InvalidJsonError(
                "\n".join(errors),
                file_path=self.file_path
            )
        
        struct_errors = validate_json_structure(
            data, self.REQUIRED_FIELDS, self.file_path
        )
        
        if struct_errors:
            raise InvalidJsonError(
                "\n".join(struct_errors),
                file_path=self.file_path,
                suggestion="引用关系JSON应包含 'objects' 字段"
            )
        
        objects = []
        references = []
        metadata = data.get("metadata", {})
        
        raw_objects = data.get("objects", [])
        if not isinstance(raw_objects, list):
            raise InvalidJsonError(
                "'objects' 字段必须是数组",
                file_path=self.file_path
            )
        
        for i, obj in enumerate(raw_objects):
            if not isinstance(obj, dict):
                raise InvalidJsonError(
                    f"第 {i+1} 个对象不是有效的对象格式",
                    file_path=self.file_path,
                    line_number=i + 1
                )
            
            obj_errors = validate_json_structure(
                obj, self.OBJECT_REQUIRED_FIELDS, self.file_path
            )
            
            if obj_errors:
                raise InvalidJsonError(
                    f"第 {i+1} 个对象格式错误: " + "; ".join(obj_errors),
                    file_path=self.file_path,
                    line_number=i + 1
                )
            
            obj_info = ObjectInfo(
                obj_id=str(obj.get("id")),
                obj_type=str(obj.get("type")),
                size=int(obj.get("size", 0)),
                ref_count=int(obj.get("ref_count", obj.get("refcount", 0))),
                address=str(obj.get("address", "")),
                module=str(obj.get("module", "")),
                attributes=obj.get("attributes", {})
            )
            objects.append(obj_info)
            
            refs = obj.get("references", obj.get("refs", []))
            for ref in refs:
                if isinstance(ref, dict):
                    ref_rel = ReferenceRelation(
                        from_obj_id=obj_info.obj_id,
                        to_obj_id=str(ref.get("to", ref.get("id", ""))),
                        ref_type=str(ref.get("type", "strong")),
                        attribute_name=str(ref.get("attribute", ref.get("attr", ""))),
                        container_index=int(ref.get("index", -1))
                    )
                    references.append(ref_rel)
                elif isinstance(ref, (str, int)):
                    ref_rel = ReferenceRelation(
                        from_obj_id=obj_info.obj_id,
                        to_obj_id=str(ref),
                        ref_type="strong"
                    )
                    references.append(ref_rel)
        
        raw_refs = data.get("references", [])
        for ref in raw_refs:
            if isinstance(ref, dict):
                ref_rel = ReferenceRelation(
                    from_obj_id=str(ref.get("from", ref.get("source", ""))),
                    to_obj_id=str(ref.get("to", ref.get("target", ""))),
                    ref_type=str(ref.get("type", "strong")),
                    attribute_name=str(ref.get("attribute", "")),
                    container_index=int(ref.get("index", -1))
                )
                references.append(ref_rel)
        
        return RefJsonAnalysisResult(
            file_path=self.file_path,
            objects=objects,
            references=references,
            metadata=metadata
        )
