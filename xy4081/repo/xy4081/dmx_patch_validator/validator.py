from collections import defaultdict
from typing import List, Dict, Tuple, Optional, Set

from .models import (
    Fixture, PatchEntry, ValidationResult, ValidationIssue,
    Severity, FixtureLibrary
)


class Validator:
    MAX_ADDRESS = 512

    def __init__(self, fixture_libraries: Optional[List[FixtureLibrary]] = None):
        self.fixture_libraries = fixture_libraries or []

    def _find_overlaps(self, items: List, get_universe, get_start, get_end, get_id) -> List[Tuple]:
        overlaps = []
        items_by_universe = defaultdict(list)
        
        for item in items:
            items_by_universe[get_universe(item)].append(item)
        
        for universe, universe_items in items_by_universe.items():
            sorted_items = sorted(universe_items, key=lambda x: get_start(x))
            for i in range(len(sorted_items)):
                for j in range(i + 1, len(sorted_items)):
                    item1 = sorted_items[i]
                    item2 = sorted_items[j]
                    if get_start(item2) <= get_end(item1):
                        overlaps.append((
                            get_id(item1), get_id(item2),
                            universe,
                            max(get_start(item1), get_start(item2)),
                            min(get_end(item1), get_end(item2))
                        ))
                    else:
                        break
        
        return overlaps

    def check_fixture_overlaps(self, fixtures: List[Fixture]) -> List[ValidationIssue]:
        issues = []
        
        def get_universe(f): return f.universe
        def get_start(f): return f.start_address
        def get_end(f): return f.end_address
        def get_id(f): return f.id
        
        overlaps = self._find_overlaps(fixtures, get_universe, get_start, get_end, get_id)
        
        for id1, id2, universe, start, end in overlaps:
            issues.append(ValidationIssue(
                severity=Severity.CRITICAL,
                category="地址重叠",
                message=f"灯具 '{id1}' 和 '{id2}' 在宇宙 {universe} 地址 {start}-{end} 重叠",
                affected_items=[id1, id2],
                suggestion="检查并调整其中一个灯具的起始地址"
            ))
        
        return issues

    def check_patch_overlaps(self, patch_entries: List[PatchEntry]) -> List[ValidationIssue]:
        issues = []
        
        def get_universe(p): return p.universe
        def get_start(p): return p.start_address
        def get_end(p): return p.end_address
        def get_id(p): return p.id
        
        overlaps = self._find_overlaps(patch_entries, get_universe, get_start, get_end, get_id)
        
        for id1, id2, universe, start, end in overlaps:
            issues.append(ValidationIssue(
                severity=Severity.CRITICAL,
                category="地址重叠",
                message=f"Patch条目 '{id1}' 和 '{id2}' 在宇宙 {universe} 地址 {start}-{end} 重叠",
                affected_items=[id1, id2],
                suggestion="检查并调整其中一个Patch条目的起始地址"
            ))
        
        return issues

    def check_universe_capacity(self, fixtures: List[Fixture], 
                                  patch_entries: List[PatchEntry],
                                  max_universe: int = 1) -> List[ValidationIssue]:
        issues = []
        
        all_entries = []
        for f in fixtures:
            all_entries.append({
                'universe': f.universe,
                'start': f.start_address,
                'end': f.end_address,
                'id': f.id,
                'type': 'fixture'
            })
        for p in patch_entries:
            all_entries.append({
                'universe': p.universe,
                'start': p.start_address,
                'end': p.end_address,
                'id': p.id,
                'type': 'patch'
            })
        
        universe_usage: Dict[int, Set[int]] = defaultdict(set)
        for entry in all_entries:
            for addr in range(entry['start'], entry['end'] + 1):
                universe_usage[entry['universe']].add(addr)
        
        for universe in sorted(universe_usage.keys()):
            used = len(universe_usage[universe])
            if universe > max_universe:
                issues.append(ValidationIssue(
                    severity=Severity.WARNING,
                    category="宇宙配置",
                    message=f"宇宙 {universe} 被使用，但配置中只定义了 {max_universe} 个宇宙",
                    affected_items=[f"宇宙{universe}"],
                    suggestion="更新项目配置中的宇宙数量，或检查地址分配"
                ))
            
            if used > self.MAX_ADDRESS:
                issues.append(ValidationIssue(
                    severity=Severity.CRITICAL,
                    category="容量超限",
                    message=f"宇宙 {universe} 使用了 {used} 个通道，超过最大值 {self.MAX_ADDRESS}",
                    affected_items=[f"宇宙{universe}"],
                    suggestion="将部分灯具移至其他宇宙，或使用更少通道的灯具模式"
                ))
            elif used > self.MAX_ADDRESS * 0.9:
                issues.append(ValidationIssue(
                    severity=Severity.WARNING,
                    category="容量预警",
                    message=f"宇宙 {universe} 已使用 {used}/{self.MAX_ADDRESS} 通道 ({used*100//self.MAX_ADDRESS}%)",
                    affected_items=[f"宇宙{universe}"],
                    suggestion="预留足够的通道余量，避免扩展时需要重新Patch"
                ))
        
        return issues

    def check_address_boundaries(self, fixtures: List[Fixture],
                                  patch_entries: List[PatchEntry]) -> List[ValidationIssue]:
        issues = []
        
        for f in fixtures:
            if f.start_address < 1 or f.start_address > self.MAX_ADDRESS:
                issues.append(ValidationIssue(
                    severity=Severity.CRITICAL,
                    category="地址越界",
                    message=f"灯具 '{f.id}' 起始地址 {f.start_address} 超出有效范围 [1, {self.MAX_ADDRESS}]",
                    affected_items=[f.id],
                    suggestion="起始地址必须在 1 到 512 之间"
                ))
            if f.end_address > self.MAX_ADDRESS:
                issues.append(ValidationIssue(
                    severity=Severity.CRITICAL,
                    category="地址越界",
                    message=f"灯具 '{f.id}' 结束地址 {f.end_address} 超出最大值 {self.MAX_ADDRESS}",
                    affected_items=[f.id],
                    suggestion="调整起始地址或使用更少通道的模式"
                ))
        
        for p in patch_entries:
            if p.start_address < 1 or p.start_address > self.MAX_ADDRESS:
                issues.append(ValidationIssue(
                    severity=Severity.CRITICAL,
                    category="地址越界",
                    message=f"Patch条目 '{p.id}' 起始地址 {p.start_address} 超出有效范围",
                    affected_items=[p.id],
                    suggestion="起始地址必须在 1 到 512 之间"
                ))
            if p.end_address > self.MAX_ADDRESS:
                issues.append(ValidationIssue(
                    severity=Severity.CRITICAL,
                    category="地址越界",
                    message=f"Patch条目 '{p.id}' 结束地址 {p.end_address} 超出最大值 {self.MAX_ADDRESS}",
                    affected_items=[p.id],
                    suggestion="调整起始地址或减少通道数"
                ))
        
        return issues

    def check_mode_validity(self, fixtures: List[Fixture]) -> List[ValidationIssue]:
        issues = []
        
        if not self.fixture_libraries:
            return issues
        
        library_map = {}
        for lib in self.fixture_libraries:
            key = (lib.manufacturer.lower(), lib.model.lower())
            library_map[key] = lib
        
        for f in fixtures:
            key = (f.manufacturer.lower(), f.model.lower())
            lib = library_map.get(key)
            
            if lib:
                mode_names = [m.mode_name.lower() for m in lib.modes]
                if f.mode.lower() not in mode_names:
                    available = ", ".join([m.mode_name for m in lib.modes])
                    issues.append(ValidationIssue(
                        severity=Severity.WARNING,
                        category="模式错误",
                        message=f"灯具 '{f.id}' 使用的模式 '{f.mode}' 不在灯具库定义中",
                        affected_items=[f.id],
                        suggestion=f"可用模式: {available}"
                    ))
            else:
                issues.append(ValidationIssue(
                    severity=Severity.INFO,
                    category="灯具未知",
                    message=f"灯具 '{f.id}' ({f.manufacturer} {f.model}) 未在灯具库中",
                    affected_items=[f.id],
                    suggestion="添加灯具库以获得更完善的模式校验"
                ))
        
        return issues

    def check_cross_reference(self, fixtures: List[Fixture],
                               patch_entries: List[PatchEntry]) -> List[ValidationIssue]:
        issues = []
        
        fixture_map = {f.id: f for f in fixtures}
        
        for p in patch_entries:
            if p.fixture_id:
                if p.fixture_id not in fixture_map:
                    issues.append(ValidationIssue(
                        severity=Severity.WARNING,
                        category="引用问题",
                        message=f"Patch条目 '{p.id}' 引用的灯具 '{p.fixture_id}' 不存在于灯具清单",
                        affected_items=[p.id],
                        suggestion="检查灯具ID是否正确，或补充灯具清单"
                    ))
                else:
                    f = fixture_map[p.fixture_id]
                    if p.universe != f.universe or p.start_address != f.start_address:
                        issues.append(ValidationIssue(
                            severity=Severity.WARNING,
                            category="地址不一致",
                            message=f"Patch条目 '{p.id}' 与灯具 '{f.id}' 地址不一致",
                            affected_items=[p.id, f.id],
                            suggestion=f"灯具地址: U{f.universe}@{f.start_address}, Patch地址: U{p.universe}@{p.start_address}"
                        ))
                    
                    if p.position and f.position and p.position != f.position:
                        issues.append(ValidationIssue(
                            severity=Severity.INFO,
                            category="位置不一致",
                            message=f"Patch条目 '{p.id}' 与灯具 '{f.id}' 位置标记不一致",
                            affected_items=[p.id, f.id],
                            suggestion=f"灯具位置: {f.position}, Patch位置: {p.position}"
                        ))
        
        referenced_ids = {p.fixture_id for p in patch_entries if p.fixture_id}
        for f in fixtures:
            if f.id not in referenced_ids:
                issues.append(ValidationIssue(
                    severity=Severity.INFO,
                    category="未引用",
                    message=f"灯具 '{f.id}' 未在Patch表中引用",
                    affected_items=[f.id],
                    suggestion="确认该灯具是否需要Patch，或检查Patch表是否完整"
                ))
        
        return issues

    def validate(self, fixtures: List[Fixture],
                 patch_entries: List[PatchEntry],
                 max_universe: int = 1) -> ValidationResult:
        result = ValidationResult()
        
        for issue in self.check_address_boundaries(fixtures, patch_entries):
            result.add_issue(issue)
        
        for issue in self.check_fixture_overlaps(fixtures):
            result.add_issue(issue)
        
        for issue in self.check_patch_overlaps(patch_entries):
            result.add_issue(issue)
        
        for issue in self.check_universe_capacity(fixtures, patch_entries, max_universe):
            result.add_issue(issue)
        
        for issue in self.check_mode_validity(fixtures):
            result.add_issue(issue)
        
        for issue in self.check_cross_reference(fixtures, patch_entries):
            result.add_issue(issue)
        
        return result
