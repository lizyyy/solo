from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
from collections import defaultdict
from ..parsers.entries import Entry
from ..parsers.timings import TimingPoint
from ..parsers.rules import RaceRules
from ..parsers.appeals import Appeal
from ..rules.engine import normalize_mat_id, calculate_segment_time, check_cutoff, format_timedelta, parse_time_str


@dataclass
class Violation:
    type: str
    severity: str
    description: str
    details: Dict = field(default_factory=dict)


@dataclass
class RunnerResult:
    bib: str
    name: str
    category: str
    chip_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    net_time: Optional[timedelta] = None
    segment_times: Dict[str, timedelta] = field(default_factory=dict)
    mat_times: Dict[str, datetime] = field(default_factory=dict)
    violations: List[Violation] = field(default_factory=list)
    is_dnf: bool = False
    is_dq: bool = False
    is_manual: bool = False


@dataclass
class ArbitrationResult:
    runners: Dict[str, RunnerResult] = field(default_factory=dict)
    unassigned_chips: List[TimingPoint] = field(default_factory=list)
    duplicate_chips: Dict[str, List[TimingPoint]] = field(default_factory=dict)


class Arbitrator:
    def __init__(self, rules: RaceRules):
        self.rules = rules
    
    def process(self, entries: Dict[str, Entry], timings: List[TimingPoint], appeals: List[Appeal]) -> ArbitrationResult:
        result = ArbitrationResult()
        
        chip_to_bib = {e.chip_id: e.bib for e in entries.values()}
        bib_to_chip = {e.bib: e.chip_id for e in entries.values()}
        
        chip_timings = defaultdict(list)
        for tp in timings:
            normalized_mat = normalize_mat_id(tp.mat_id, self.rules)
            chip_timings[tp.chip_id].append(TimingPoint(
                chip_id=tp.chip_id,
                mat_id=normalized_mat,
                timestamp=tp.timestamp,
                bib=tp.bib
            ))
        
        for chip_id, tps in chip_timings.items():
            if chip_id not in chip_to_bib:
                result.unassigned_chips.extend(tps)
            else:
                mat_counts = defaultdict(list)
                for tp in tps:
                    mat_counts[tp.mat_id].append(tp)
                for mat_id, mat_tps in mat_counts.items():
                    if len(mat_tps) > 1:
                        if chip_id not in result.duplicate_chips:
                            result.duplicate_chips[chip_id] = []
                        result.duplicate_chips[chip_id].extend(mat_tps[1:])
        
        for bib, entry in entries.items():
            runner = RunnerResult(
                bib=bib,
                name=entry.name,
                category=entry.category,
                chip_id=entry.chip_id
            )
            result.runners[bib] = runner
        
        for bib, runner in result.runners.items():
            tps = chip_timings.get(runner.chip_id, [])
            mat_first = {}
            for tp in tps:
                if tp.mat_id not in mat_first:
                    mat_first[tp.mat_id] = tp.timestamp
            runner.mat_times = mat_first
            
            start_norm = normalize_mat_id(self.rules.start_mat, self.rules)
            end_norm = normalize_mat_id(self.rules.end_mat, self.rules)
            
            if start_norm in runner.mat_times:
                runner.start_time = runner.mat_times[start_norm]
            
            if end_norm in runner.mat_times:
                runner.end_time = runner.mat_times[end_norm]
            
            if runner.start_time and runner.end_time:
                runner.net_time = calculate_segment_time(runner.start_time, runner.end_time, self.rules)
            else:
                runner.is_dnf = True
            
            for seg in sorted(self.rules.segments, key=lambda x: x.order):
                from_norm = normalize_mat_id(seg.from_mat, self.rules)
                to_norm = normalize_mat_id(seg.to_mat, self.rules)
                if from_norm in runner.mat_times and to_norm in runner.mat_times:
                    seg_time = calculate_segment_time(runner.mat_times[from_norm], runner.mat_times[to_norm], self.rules)
                    if seg_time:
                        runner.segment_times[seg.id] = seg_time
            
            self._check_violations(runner, tps, chip_timings, bib_to_chip)
        
        self._apply_appeals(result, appeals)
        
        return result
    
    def _check_violations(self, runner: RunnerResult, tps: List[TimingPoint], chip_timings: Dict, bib_to_chip: Dict):
        start_norm = normalize_mat_id(self.rules.start_mat, self.rules)
        end_norm = normalize_mat_id(self.rules.end_mat, self.rules)
        
        if start_norm not in runner.mat_times:
            runner.violations.append(Violation(
                type="missing_start",
                severity="warning",
                description=f"Missing start mat timing at {start_norm}",
                details={"mat": start_norm}
            ))
        
        if end_norm not in runner.mat_times:
            runner.violations.append(Violation(
                type="missing_end",
                severity="warning",
                description=f"Missing end mat timing at {end_norm}",
                details={"mat": end_norm}
            ))
        
        for seg in self.rules.segments:
            from_norm = normalize_mat_id(seg.from_mat, self.rules)
            to_norm = normalize_mat_id(seg.to_mat, self.rules)
            if from_norm in runner.mat_times and to_norm not in runner.mat_times:
                runner.violations.append(Violation(
                    type="missing_segment",
                    severity="warning",
                    description=f"Missing mat timing at {to_norm} for segment {seg.name}",
                    details={"segment": seg.id, "mat": to_norm}
                ))
        
        mat_counts = defaultdict(int)
        for tp in tps:
            mat_counts[tp.mat_id] += 1
        for mat_id, count in mat_counts.items():
            if count > 1:
                runner.violations.append(Violation(
                    type="duplicate_pass",
                    severity="info",
                    description=f"Passed mat {mat_id} {count} times",
                    details={"mat": mat_id, "count": count}
                ))
        
        for cutoff in self.rules.cutoffs:
            mat_norm = normalize_mat_id(cutoff.mat, self.rules)
            if mat_norm in runner.mat_times and runner.start_time:
                if check_cutoff(runner.mat_times[mat_norm], runner.start_time, cutoff.time_limit, self.rules):
                    runner.violations.append(Violation(
                        type="cutoff_violation",
                        severity="error",
                        description=f"Cutoff violation at {mat_norm}: exceeded {cutoff.time_limit}",
                        details={"mat": mat_norm, "cutoff": cutoff.time_limit, "segment": cutoff.segment_id}
                    ))
        
        for other_chip, other_tps in chip_timings.items():
            if other_chip == runner.chip_id:
                continue
            for tp in other_tps:
                if tp.bib and tp.bib == runner.bib:
                    runner.violations.append(Violation(
                        type="chip_mismatch",
                        severity="warning",
                        description=f"Possible chip mismatch: bib {runner.bib} associated with chip {other_chip}",
                        details={"other_chip": other_chip}
                    ))
    
    def _apply_appeals(self, result: ArbitrationResult, appeals: List[Appeal]):
        for appeal in appeals:
            if appeal.bib not in result.runners:
                continue
            runner = result.runners[appeal.bib]
            runner.is_manual = True
            
            if appeal.action == "add" and appeal.timestamp:
                mat_norm = normalize_mat_id(appeal.mat_id, self.rules)
                runner.mat_times[mat_norm] = appeal.timestamp
                
                if mat_norm == normalize_mat_id(self.rules.start_mat, self.rules):
                    runner.start_time = appeal.timestamp
                elif mat_norm == normalize_mat_id(self.rules.end_mat, self.rules):
                    runner.end_time = appeal.timestamp
                
                if runner.start_time and runner.end_time:
                    runner.net_time = calculate_segment_time(runner.start_time, runner.end_time, self.rules)
                    if runner.net_time:
                        runner.is_dnf = False
                
                runner.violations.append(Violation(
                    type="manual_addition",
                    severity="info",
                    description=f"Manual addition: {appeal.note}",
                    details={"mat": appeal.mat_id, "timestamp": appeal.timestamp.isoformat() if appeal.timestamp else None}
                ))
