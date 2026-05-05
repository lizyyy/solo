"""
分析引擎模块
整合各种数据源，进行内存问题分析
"""

import uuid
from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime
from dataclasses import dataclass, field
from collections import defaultdict

from memprofiler.models import (
    ObjectInfo,
    ReferenceRelation,
    CycleReference,
    LeakSuspect,
    AnalysisResult,
    SnapshotInfo,
    LeakSeverity,
    IssueType,
)
from memprofiler.readers import (
    ScriptAnalysisResult,
    GCLogAnalysisResult,
    RefJsonAnalysisResult,
)
from memprofiler.config import Config
from memprofiler.utils import format_size


@dataclass
class AnalysisContext:
    """分析上下文"""
    config: Config
    script_results: List[ScriptAnalysisResult] = field(default_factory=list)
    gc_log_results: List[GCLogAnalysisResult] = field(default_factory=list)
    ref_json_results: List[RefJsonAnalysisResult] = field(default_factory=list)
    snapshots: List[SnapshotInfo] = field(default_factory=list)


class CycleDetector:
    """循环引用检测器"""
    
    def __init__(self, objects: List[ObjectInfo], references: List[ReferenceRelation]):
        self.objects = {obj.obj_id: obj for obj in objects}
        self.references = references
        
        self.adjacency = defaultdict(list)
        for ref in references:
            if ref.ref_type == "strong":
                self.adjacency[ref.from_obj_id].append(ref.to_obj_id)
    
    def detect_cycles(self) -> List[CycleReference]:
        """检测循环引用"""
        cycles = []
        visited = set()
        recursion_stack = set()
        path = []
        
        def dfs(node_id: str, parent: str):
            if node_id in recursion_stack:
                idx = path.index(node_id)
                cycle_nodes = path[idx:]
                
                if len(cycle_nodes) >= 2:
                    cycle = self._build_cycle(cycle_nodes)
                    if cycle:
                        cycles.append(cycle)
                return
            
            if node_id in visited:
                return
            
            visited.add(node_id)
            recursion_stack.add(node_id)
            path.append(node_id)
            
            for neighbor in self.adjacency.get(node_id, []):
                if neighbor != parent:
                    dfs(neighbor, node_id)
            
            path.pop()
            recursion_stack.remove(node_id)
        
        for obj_id in self.objects:
            if obj_id not in visited:
                dfs(obj_id, None)
        
        return cycles
    
    def _build_cycle(self, node_ids: List[str]) -> Optional[CycleReference]:
        """构建循环引用对象"""
        total_size = 0
        has_del = False
        
        for node_id in node_ids:
            obj = self.objects.get(node_id)
            if obj:
                total_size += obj.size
                if "has_del" in obj.attributes or "__del__" in str(obj.attributes):
                    has_del = True
        
        return CycleReference(
            cycle_id=str(uuid.uuid4()),
            objects=node_ids,
            size=total_size,
            has_del=has_del,
            is_uncollectable=has_del,
            evidence=f"检测到 {len(node_ids)} 个对象形成循环引用链"
        )


class ReferenceChainTracker:
    """引用链追踪器"""
    
    def __init__(self, objects: List[ObjectInfo], references: List[ReferenceRelation]):
        self.objects = {obj.obj_id: obj for obj in objects}
        self.references = references
        
        self.incoming = defaultdict(list)
        self.outgoing = defaultdict(list)
        
        for ref in references:
            self.outgoing[ref.from_obj_id].append(ref)
            self.incoming[ref.to_obj_id].append(ref)
    
    def find_retention_chain(self, target_id: str, max_depth: int = 10) -> List[str]:
        """查找保留链（从根对象到目标对象的引用链）"""
        visited = set()
        queue = [(target_id, [target_id])]
        
        while queue:
            current, path = queue.pop(0)
            
            if len(path) > max_depth:
                continue
            
            if current in visited:
                continue
            visited.add(current)
            
            incoming_refs = self.incoming.get(current, [])
            strong_incoming = [r for r in incoming_refs if r.ref_type == "strong"]
            
            if not strong_incoming:
                if len(path) > 1:
                    return path[::-1]
                continue
            
            for ref in strong_incoming:
                new_path = path + [ref.from_obj_id]
                queue.append((ref.from_obj_id, new_path))
        
        return [target_id]


class MemoryAnalyzer:
    """内存分析引擎"""
    
    def __init__(self, context: AnalysisContext):
        self.context = context
        self.all_objects: List[ObjectInfo] = []
        self.all_references: List[ReferenceRelation] = []
        
        for ref_result in context.ref_json_results:
            self.all_objects.extend(ref_result.objects)
            self.all_references.extend(ref_result.references)
    
    def analyze(self) -> AnalysisResult:
        """执行完整分析"""
        analysis_id = str(uuid.uuid4())
        result = AnalysisResult(
            analysis_id=analysis_id,
            timestamp=datetime.now(),
            status="running",
            summary={},
        )
        
        try:
            suspects: List[LeakSuspect] = []
            cycles: List[CycleReference] = []
            
            if self.all_objects and self.all_references:
                cycle_detector = CycleDetector(self.all_objects, self.all_references)
                detected_cycles = cycle_detector.detect_cycles()
                cycles.extend(detected_cycles)
                
                for cycle in detected_cycles:
                    suspect = self._create_cycle_suspect(cycle)
                    if suspect:
                        suspects.append(suspect)
                
                chain_tracker = ReferenceChainTracker(self.all_objects, self.all_references)
                
                for obj in self.all_objects:
                    obj_suspects = self._analyze_object(obj, chain_tracker)
                    suspects.extend(obj_suspects)
            
            for gc_result in self.context.gc_log_results:
                gc_suspects = self._analyze_gc_log(gc_result)
                suspects.extend(gc_suspects)
            
            for script_result in self.context.script_results:
                script_suspects = self._analyze_script(script_result)
                suspects.extend(script_suspects)
            
            unique_suspects = self._deduplicate_suspects(suspects)
            sorted_suspects = sorted(
                unique_suspects,
                key=lambda s: (
                    self._severity_priority(s.severity),
                    -s.size
                )
            )
            
            summary = self._build_summary(sorted_suspects, cycles)
            
            result.suspects = sorted_suspects
            result.cycles = cycles
            result.objects = self.all_objects
            result.references = self.all_references
            result.snapshots = self.context.snapshots
            result.summary = summary
            result.status = "completed"
            
        except Exception as e:
            result.status = "failed"
            result.error_message = str(e)
        
        return result
    
    def _severity_priority(self, severity: LeakSeverity) -> int:
        """严重程度优先级"""
        priorities = {
            LeakSeverity.CRITICAL: 0,
            LeakSeverity.HIGH: 1,
            LeakSeverity.MEDIUM: 2,
            LeakSeverity.LOW: 3,
            LeakSeverity.INFO: 4,
        }
        return priorities.get(severity, 4)
    
    def _create_cycle_suspect(self, cycle: CycleReference) -> Optional[LeakSuspect]:
        """从循环引用创建嫌疑对象"""
        if not cycle.objects:
            return None
        
        severity = LeakSeverity.HIGH
        if cycle.has_del:
            severity = LeakSeverity.CRITICAL
        
        evidence = [
            f"检测到循环引用，涉及 {len(cycle.objects)} 个对象",
            f"总大小: {format_size(cycle.size)}",
        ]
        
        if cycle.has_del:
            evidence.append("警告: 循环引用中包含 __del__ 方法，对象将不可回收！")
        
        suggestions = [
            "检查对象间的引用关系，考虑打破循环",
            "使用 weakref 替代强引用来打破循环",
        ]
        
        if cycle.has_del:
            suggestions.extend([
                "避免在循环引用的对象中使用 __del__ 方法",
                "考虑使用 contextlib.closing 或显式的 close() 方法",
            ])
        
        return LeakSuspect(
            suspect_id=str(uuid.uuid4()),
            obj_id=cycle.objects[0] if cycle.objects else "",
            obj_type="CycleReference",
            issue_type=IssueType.CYCLE_REFERENCE if not cycle.has_del else IssueType.UNCOLLECTABLE,
            severity=severity,
            size=cycle.size,
            evidence=evidence,
            suggestions=suggestions,
            reference_chain=cycle.objects,
        )
    
    def _analyze_object(self, obj: ObjectInfo, 
                        chain_tracker: ReferenceChainTracker) -> List[LeakSuspect]:
        """分析单个对象"""
        suspects = []
        
        if obj.ref_count > 1000:
            evidence = [
                f"对象 {obj.obj_type} (ID: {obj.obj_id}) 引用计数异常高",
                f"当前引用计数: {obj.ref_count}",
            ]
            
            suggestions = [
                "检查是否存在过度引用",
                "考虑使用弱引用减少引用计数",
            ]
            
            suspects.append(LeakSuspect(
                suspect_id=str(uuid.uuid4()),
                obj_id=obj.obj_id,
                obj_type=obj.obj_type,
                issue_type=IssueType.REF_COUNT_LEAK,
                severity=LeakSeverity.MEDIUM,
                size=obj.size,
                evidence=evidence,
                suggestions=suggestions,
                reference_chain=chain_tracker.find_retention_chain(obj.obj_id),
            ))
        
        min_large_size = self.context.config.analysis.get("min_size_bytes", 1024 * 100)
        if obj.size >= min_large_size:
            retention_chain = chain_tracker.find_retention_chain(obj.obj_id)
            
            evidence = [
                f"检测到大对象: {obj.obj_type}",
                f"大小: {format_size(obj.size)}",
                f"引用计数: {obj.ref_count}",
            ]
            
            if len(retention_chain) > 1:
                evidence.append(f"保留链长度: {len(retention_chain)}")
            
            suggestions = [
                "检查大对象是否有必要长期保留",
                "考虑使用惰性加载或按需创建",
                f"检查保留链: {' -> '.join(retention_chain[:5])}{'...' if len(retention_chain) > 5 else ''}",
            ]
            
            severity = LeakSeverity.MEDIUM
            if obj.size >= 1024 * 1024:
                severity = LeakSeverity.HIGH
            
            suspects.append(LeakSuspect(
                suspect_id=str(uuid.uuid4()),
                obj_id=obj.obj_id,
                obj_type=obj.obj_type,
                issue_type=IssueType.LARGE_OBJECT,
                severity=severity,
                size=obj.size,
                evidence=evidence,
                suggestions=suggestions,
                reference_chain=retention_chain,
            ))
        
        cache_types = ["dict", "list", "set", "OrderedDict", "defaultdict"]
        if obj.obj_type.lower() in [t.lower() for t in cache_types]:
            if obj.size >= 1024 * 50:
                evidence = [
                    f"检测到潜在的缓存容器残留: {obj.obj_type}",
                    f"大小: {format_size(obj.size)}",
                    f"引用计数: {obj.ref_count}",
                ]
                
                suggestions = [
                    "检查容器是否作为缓存使用",
                    "考虑设置缓存过期策略",
                    "使用 WeakKeyDictionary/WeakValueDictionary 替代普通容器",
                ]
                
                suspects.append(LeakSuspect(
                    suspect_id=str(uuid.uuid4()),
                    obj_id=obj.obj_id,
                    obj_type=obj.obj_type,
                    issue_type=IssueType.CACHE_RESIDUE,
                    severity=LeakSeverity.LOW,
                    size=obj.size,
                    evidence=evidence,
                    suggestions=suggestions,
                    reference_chain=chain_tracker.find_retention_chain(obj.obj_id),
                ))
        
        return suspects
    
    def _analyze_gc_log(self, gc_result: GCLogAnalysisResult) -> List[LeakSuspect]:
        """分析GC日志"""
        suspects = []
        
        for uncollectable in gc_result.uncollectable_objects:
            evidence = [
                "检测到不可回收对象",
                f"对象类型: {uncollectable.get('obj_type', 'unknown')}",
                f"地址: {uncollectable.get('address', 'unknown')}",
                f"日志行: {uncollectable.get('line_content', '')}",
            ]
            
            suggestions = [
                "这通常是由于循环引用中存在 __del__ 方法导致的",
                "检查相关对象的 __del__ 方法实现",
                "考虑使用上下文管理器替代 __del__",
            ]
            
            suspects.append(LeakSuspect(
                suspect_id=str(uuid.uuid4()),
                obj_id=uncollectable.get('address', ''),
                obj_type=uncollectable.get('obj_type', 'Uncollectable'),
                issue_type=IssueType.UNCOLLECTABLE,
                severity=LeakSeverity.CRITICAL,
                size=0,
                evidence=evidence,
                suggestions=suggestions,
                reference_chain=[],
            ))
        
        for del_obj in gc_result.del_method_objects:
            evidence = [
                "检测到包含 __del__ 方法的对象",
                f"日志行: {del_obj.get('line_content', '')}",
            ]
            
            suggestions = [
                "__del__ 方法可能导致循环引用无法回收",
                "考虑使用显式的清理方法如 close()",
                "使用 contextlib.closing 进行资源管理",
            ]
            
            suspects.append(LeakSuspect(
                suspect_id=str(uuid.uuid4()),
                obj_id="",
                obj_type="ObjectWithDel",
                issue_type=IssueType.DEL_METHOD,
                severity=LeakSeverity.HIGH,
                size=0,
                evidence=evidence,
                suggestions=suggestions,
                reference_chain=[],
            ))
        
        return suspects
    
    def _analyze_script(self, script_result: ScriptAnalysisResult) -> List[LeakSuspect]:
        """分析脚本片段"""
        suspects = []
        
        if script_result.has_del_method:
            for snippet in script_result.code_snippets:
                if "__del__" in snippet.get("keyword", "") or "__del__" in snippet.get("snippet", ""):
                    evidence = [
                        "代码中检测到 __del__ 方法定义",
                        f"文件: {script_result.file_path}",
                        f"行号: {snippet.get('line_number', 'unknown')}",
                        f"代码片段:\n{snippet.get('snippet', '')}",
                    ]
                    
                    suggestions = [
                        "__del__ 方法在存在循环引用时会阻止对象回收",
                        "考虑使用 try/finally 或上下文管理器",
                        "使用显式的 close() 方法进行资源清理",
                    ]
                    
                    suspects.append(LeakSuspect(
                        suspect_id=str(uuid.uuid4()),
                        obj_id="",
                        obj_type="ScriptPattern",
                        issue_type=IssueType.DEL_METHOD,
                        severity=LeakSeverity.MEDIUM,
                        size=0,
                        evidence=evidence,
                        suggestions=suggestions,
                        reference_chain=[],
                    ))
        
        if script_result.has_weakref:
            for snippet in script_result.code_snippets:
                if "weakref" in snippet.get("keyword", "").lower():
                    evidence = [
                        "代码中使用了弱引用",
                        f"文件: {script_result.file_path}",
                        f"行号: {snippet.get('line_number', 'unknown')}",
                    ]
                    
                    suggestions = [
                        "弱引用不会增加引用计数，是打破循环引用的好方法",
                        "注意检查弱引用目标是否已被释放 (使用 WeakKeyDictionary 的 key() 检查)",
                        "考虑使用 WeakValueDictionary 或 WeakKeyDictionary",
                    ]
                    
                    suspects.append(LeakSuspect(
                        suspect_id=str(uuid.uuid4()),
                        obj_id="",
                        obj_type="ScriptPattern",
                        issue_type=IssueType.WEAKREF_INVALID,
                        severity=LeakSeverity.INFO,
                        size=0,
                        evidence=evidence,
                        suggestions=suggestions,
                        reference_chain=[],
                    ))
        
        return suspects
    
    def _deduplicate_suspects(self, suspects: List[LeakSuspect]) -> List[LeakSuspect]:
        """去重嫌疑对象"""
        seen = set()
        unique = []
        
        for suspect in suspects:
            key = (suspect.obj_id, suspect.issue_type.value)
            if key not in seen:
                seen.add(key)
                unique.append(suspect)
        
        return unique
    
    def _build_summary(self, suspects: List[LeakSuspect], 
                       cycles: List[CycleReference]) -> Dict[str, Any]:
        """构建分析摘要"""
        severity_counts = defaultdict(int)
        issue_type_counts = defaultdict(int)
        total_suspect_size = 0
        
        for suspect in suspects:
            severity_counts[suspect.severity.value] += 1
            issue_type_counts[suspect.issue_type.value] += 1
            total_suspect_size += suspect.size
        
        critical_count = severity_counts.get("critical", 0)
        high_count = severity_counts.get("high", 0)
        medium_count = severity_counts.get("medium", 0)
        low_count = severity_counts.get("low", 0)
        info_count = severity_counts.get("info", 0)
        
        risk_level = "低"
        if critical_count > 0:
            risk_level = "严重"
        elif high_count > 0:
            risk_level = "高"
        elif medium_count > 0:
            risk_level = "中"
        
        return {
            "total_suspects": len(suspects),
            "total_cycles": len(cycles),
            "severity_breakdown": {
                "critical": critical_count,
                "high": high_count,
                "medium": medium_count,
                "low": low_count,
                "info": info_count,
            },
            "issue_type_breakdown": dict(issue_type_counts),
            "total_suspect_size": total_suspect_size,
            "total_suspect_size_formatted": format_size(total_suspect_size),
            "risk_level": risk_level,
            "total_objects_analyzed": len(self.all_objects),
            "total_references_analyzed": len(self.all_references),
        }
