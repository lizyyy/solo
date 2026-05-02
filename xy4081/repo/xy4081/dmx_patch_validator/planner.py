from collections import defaultdict
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass

from .models import (
    Fixture, PatchEntry, PlanResult, PlanAction, 
    ActionType, Severity, ValidationIssue
)
from .validator import Validator


@dataclass
class AddressBlock:
    start: int
    end: int
    occupied: bool = False
    fixture_id: Optional[str] = None


class AddressPlanner:
    MAX_ADDRESS = 512

    def __init__(self):
        pass

    def _find_gaps(self, used_addresses: Set[int], start: int = 1, end: int = 512) -> List[Tuple[int, int]]:
        gaps = []
        current_gap_start = None
        
        for addr in range(start, end + 1):
            if addr not in used_addresses:
                if current_gap_start is None:
                    current_gap_start = addr
            else:
                if current_gap_start is not None:
                    gaps.append((current_gap_start, addr - 1))
                    current_gap_start = None
        
        if current_gap_start is not None:
            gaps.append((current_gap_start, end))
        
        return gaps

    def _get_used_addresses(self, fixtures: List[Fixture], 
                             patch_entries: List[PatchEntry]) -> Dict[int, Set[int]]:
        used: Dict[int, Set[int]] = defaultdict(set)
        
        for f in fixtures:
            for addr in range(f.start_address, f.end_address + 1):
                used[f.universe].add(addr)
        
        for p in patch_entries:
            for addr in range(p.start_address, p.end_address + 1):
                used[p.universe].add(addr)
        
        return used

    def _find_fixture_conflicts(self, fixtures: List[Fixture]) -> Dict[str, List[str]]:
        conflicts: Dict[str, List[str]] = defaultdict(list)
        fixtures_by_universe = defaultdict(list)
        
        for f in fixtures:
            fixtures_by_universe[f.universe].append(f)
        
        for universe, universe_fixtures in fixtures_by_universe.items():
            sorted_fixtures = sorted(universe_fixtures, key=lambda x: x.start_address)
            for i in range(len(sorted_fixtures)):
                for j in range(i + 1, len(sorted_fixtures)):
                    f1, f2 = sorted_fixtures[i], sorted_fixtures[j]
                    if f2.start_address <= f1.end_address:
                        conflicts[f1.id].append(f2.id)
                        conflicts[f2.id].append(f1.id)
        
        return conflicts

    def plan_rearrangement(self, fixtures: List[Fixture],
                            patch_entries: List[PatchEntry],
                            max_universe: int = 1,
                            prioritize_position: bool = True) -> PlanResult:
        actions: List[PlanAction] = []
        warnings: List[str] = []
        
        used_addresses = self._get_used_addresses(fixtures, patch_entries)
        conflicts = self._find_fixture_conflicts(fixtures)
        
        if not conflicts:
            return PlanResult(
                summary="未检测到需要重排的冲突",
                actions=[],
                estimated_address_usage={u: len(addrs) for u, addrs in used_addresses.items()},
                warnings=[]
            )
        
        conflict_fixtures = {fid for fid in conflicts.keys()}
        conflict_fixture_list = [f for f in fixtures if f.id in conflict_fixtures]
        
        if prioritize_position:
            conflict_fixture_list.sort(key=lambda f: (f.position or "", f.start_address))
        
        temp_used: Dict[int, Set[int]] = defaultdict(set)
        for u, addrs in used_addresses.items():
            temp_used[u] = set(addrs)
        
        for fid in conflict_fixtures:
            f = next((x for x in fixtures if x.id == fid), None)
            if not f:
                continue
            
            for addr in range(f.start_address, f.end_address + 1):
                if addr in temp_used[f.universe]:
                    temp_used[f.universe].discard(addr)
        
        action_priority = 1
        relocated_count = 0
        
        for f in conflict_fixture_list:
            channel_count = f.end_address - f.start_address + 1
            placed = False
            
            for universe in range(1, max_universe + 1):
                gaps = self._find_gaps(temp_used.get(universe, set()))
                for gap_start, gap_end in gaps:
                    gap_size = gap_end - gap_start + 1
                    if gap_size >= channel_count:
                        old_start = f.start_address
                        old_universe = f.universe
                        new_start = gap_start
                        new_universe = universe
                        
                        actions.append(PlanAction(
                            action_type=ActionType.MOVE,
                            target_id=f.id,
                            description=f"将灯具 '{f.id}' 从 U{old_universe}@{old_start} 移至 U{new_universe}@{new_start}",
                            from_universe=old_universe,
                            from_address=old_start,
                            to_universe=new_universe,
                            to_address=new_start,
                            priority=action_priority
                        ))
                        action_priority += 1
                        
                        for addr in range(new_start, new_start + channel_count):
                            temp_used[new_universe].add(addr)
                        
                        placed = True
                        relocated_count += 1
                        break
                if placed:
                    break
            
            if not placed:
                warnings.append(
                    f"无法为灯具 '{f.id}' (需要{channel_count}通道) 找到合适的位置，建议增加宇宙数量"
                )
        
        estimated_usage = {u: len(addrs) for u, addrs in temp_used.items()}
        
        summary = f"检测到 {len(conflicts)} 个冲突灯具，规划了 {len(actions)} 个重排动作"
        if warnings:
            summary += f"，{len(warnings)} 个警告"
        
        return PlanResult(
            summary=summary,
            actions=actions,
            estimated_address_usage=estimated_usage,
            warnings=warnings
        )

    def plan_optimize_layout(self, fixtures: List[Fixture],
                              patch_entries: List[PatchEntry],
                              max_universe: int = 1,
                              group_by_position: bool = True) -> PlanResult:
        actions: List[PlanAction] = []
        warnings: List[str] = []
        
        if not fixtures:
            return PlanResult(
                summary="没有灯具需要优化",
                actions=[],
                estimated_address_usage={},
                warnings=[]
            )
        
        if group_by_position:
            positions = sorted(set(f.position or "Unspecified" for f in fixtures))
            sorted_fixtures = sorted(fixtures, key=lambda f: (f.position or "", f.id))
        else:
            sorted_fixtures = sorted(fixtures, key=lambda f: f.id)
        
        current_universe = 1
        current_address = 1
        temp_used: Dict[int, Set[int]] = defaultdict(set)
        action_priority = 1
        
        for f in sorted_fixtures:
            channel_count = f.end_address - f.start_address + 1
            
            placed = False
            while current_universe <= max_universe:
                if current_address + channel_count - 1 <= self.MAX_ADDRESS:
                    old_start = f.start_address
                    old_universe = f.universe
                    new_start = current_address
                    new_universe = current_universe
                    
                    if old_start != new_start or old_universe != new_universe:
                        actions.append(PlanAction(
                            action_type=ActionType.MOVE,
                            target_id=f.id,
                            description=f"优化布局: 将灯具 '{f.id}' 从 U{old_universe}@{old_start} 移至 U{new_universe}@{new_start}",
                            from_universe=old_universe,
                            from_address=old_start,
                            to_universe=new_universe,
                            to_address=new_start,
                            priority=action_priority
                        ))
                        action_priority += 1
                    
                    for addr in range(new_start, new_start + channel_count):
                        temp_used[new_universe].add(addr)
                    
                    current_address = new_start + channel_count
                    placed = True
                    break
                else:
                    current_universe += 1
                    current_address = 1
            
            if not placed:
                warnings.append(
                    f"无法在 {max_universe} 个宇宙内容纳灯具 '{f.id}' (需要{channel_count}通道)"
                )
        
        estimated_usage = {u: len(addrs) for u, addrs in temp_used.items()}
        
        if actions:
            summary = f"规划了 {len(actions)} 个优化动作，按{'位置' if group_by_position else 'ID'}分组排列"
        else:
            summary = "当前布局已是最优，无需调整"
        
        return PlanResult(
            summary=summary,
            actions=actions,
            estimated_address_usage=estimated_usage,
            warnings=warnings
        )
