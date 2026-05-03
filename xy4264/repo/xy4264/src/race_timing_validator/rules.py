"""计时规则引擎模块"""

import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Any

from .models import (
    RaceData,
    Violation,
    ViolationType,
    ViolationLevel,
    SplitRecord,
    Checkpoint,
    CheckpointType,
    Wave,
    Participant,
    ChipBinding,
    CheckpointLog,
)


def _generate_violation_id() -> str:
    """生成违规记录ID"""
    return f"V{uuid.uuid4().hex[:8].upper()}"


def _hours_to_seconds(hours: float) -> float:
    """小时转秒"""
    return hours * 3600


def _kmh_to_ms(kmh: float) -> float:
    """公里/小时转米/秒"""
    return kmh * 1000 / 3600


def check_duplicate_chips(race_data: RaceData) -> List[Violation]:
    """检查重复芯片绑定
    
    规则：
    - 同一芯片ID绑定到多个不同号码布 → 严重违规
    - 同一号码布绑定多个芯片 → 警告（可能是胸贴+脚贴双芯片配置）
    """
    violations: List[Violation] = []
    
    chip_to_bibs: Dict[str, List[str]] = defaultdict(list)
    for chip_id, binding in race_data.chip_bindings.items():
        chip_to_bibs[chip_id].append(binding.bib_number)
    
    for chip_id, bibs in chip_to_bibs.items():
        unique_bibs = list(set(bibs))
        if len(unique_bibs) > 1:
            violation = Violation(
                violation_id=_generate_violation_id(),
                violation_type=ViolationType.DUPLICATE_CHIP,
                level=ViolationLevel.CRITICAL,
                chip_id=chip_id,
                message=f"芯片 {chip_id} 被重复绑定到多个号码布: {', '.join(unique_bibs)}",
                evidence={
                    "chip_id": chip_id,
                    "bound_bibs": unique_bibs,
                    "bindings": [
                        {
                            "bib": b.bib_number,
                            "bind_time": b.bind_time.isoformat() if b.bind_time else None
                        }
                        for b in race_data.chip_bindings.values()
                        if b.chip_id == chip_id
                    ]
                }
            )
            violations.append(violation)
    
    for bib_number, chips in race_data.bib_to_chip.items():
        unique_chips = list(set(chips))
        if len(unique_chips) > 1:
            violation = Violation(
                violation_id=_generate_violation_id(),
                violation_type=ViolationType.DUPLICATE_CHIP,
                level=ViolationLevel.WARNING,
                bib_number=bib_number,
                message=f"号码布 {bib_number} 绑定了多个芯片: {', '.join(unique_chips)}",
                evidence={
                    "bib_number": bib_number,
                    "bound_chips": unique_chips,
                    "note": "这可能是正常的双芯片配置（如胸贴+脚贴），请人工确认"
                }
            )
            violations.append(violation)
    
    return violations


def check_wave_conflicts(race_data: RaceData) -> List[Violation]:
    """检查波次分配冲突
    
    规则：
    - 选手没有分配波次 → 警告
    - 波次人数超过限制 → 警告
    - 波次时间冲突（如果有时间间隔要求）→ 警告
    """
    violations: List[Violation] = []
    
    wave_participants: Dict[str, List[str]] = defaultdict(list)
    for bib_number, participant in race_data.participants.items():
        if participant.wave_id:
            wave_participants[participant.wave_id].append(bib_number)
        else:
            violation = Violation(
                violation_id=_generate_violation_id(),
                violation_type=ViolationType.WAVE_CONFLICT,
                level=ViolationLevel.WARNING,
                bib_number=bib_number,
                message=f"选手 {bib_number} ({participant.name}) 未分配起跑波次",
                evidence={
                    "bib_number": bib_number,
                    "name": participant.name,
                    "category": participant.category
                }
            )
            violations.append(violation)
    
    for wave_id, wave in race_data.waves.items():
        participants_in_wave = wave_participants.get(wave_id, [])
        count = len(participants_in_wave)
        
        if wave.max_participants and count > wave.max_participants:
            violation = Violation(
                violation_id=_generate_violation_id(),
                violation_type=ViolationType.WAVE_CONFLICT,
                level=ViolationLevel.WARNING,
                wave_id=wave_id,
                message=f"波次 {wave_id} ({wave.wave_name.value}) 人数 {count} 超过限制 {wave.max_participants}",
                evidence={
                    "wave_id": wave_id,
                    "wave_name": wave.wave_name.value,
                    "current_count": count,
                    "max_count": wave.max_participants,
                    "participants": participants_in_wave
                }
            )
            violations.append(violation)
    
    return violations


def check_unregistered_chips(race_data: RaceData) -> List[Violation]:
    """检查未注册芯片
    
    规则：
    - 设备日志中出现的芯片ID不在绑定表中 → 严重违规
    """
    violations: List[Violation] = []
    
    registered_chips = set(race_data.chip_bindings.keys())
    logs_by_chip: Dict[str, List[CheckpointLog]] = defaultdict(list)
    
    for log in race_data.checkpoint_logs:
        logs_by_chip[log.chip_id].append(log)
    
    for chip_id, logs in logs_by_chip.items():
        if chip_id not in registered_chips:
            checkpoints = sorted(set(l.checkpoint_id for l in logs))
            first_read = min(l.read_time for l in logs)
            last_read = max(l.read_time for l in logs)
            
            violation = Violation(
                violation_id=_generate_violation_id(),
                violation_type=ViolationType.UNREGISTERED_CHIP,
                level=ViolationLevel.CRITICAL,
                chip_id=chip_id,
                message=f"未注册芯片 {chip_id} 在检查点被读取: {', '.join(checkpoints)}",
                evidence={
                    "chip_id": chip_id,
                    "checkpoints_visited": checkpoints,
                    "first_read": first_read.isoformat(),
                    "last_read": last_read.isoformat(),
                    "log_count": len(logs)
                }
            )
            violations.append(violation)
    
    return violations


def build_split_records(race_data: RaceData) -> Dict[str, List[SplitRecord]]:
    """构建选手-芯片-波次-检查点的计时链
    
    这是 link 命令的核心功能，将设备日志关联到选手、波次和检查点
    """
    participant_splits: Dict[str, List[SplitRecord]] = defaultdict(list)
    
    sorted_checkpoints = race_data.get_sorted_checkpoints()
    checkpoint_map = {cp.checkpoint_id: cp for cp in sorted_checkpoints}
    
    logs_by_chip: Dict[str, List[CheckpointLog]] = defaultdict(list)
    for log in race_data.checkpoint_logs:
        logs_by_chip[log.chip_id].append(log)
    
    for chip_id, logs in logs_by_chip.items():
        binding = race_data.get_chip_binding(chip_id)
        if not binding:
            continue
        
        participant = race_data.get_participant_by_bib(binding.bib_number)
        if not participant:
            continue
        
        wave = None
        if participant.wave_id:
            wave = race_data.get_wave(participant.wave_id)
        
        for log in logs:
            checkpoint = checkpoint_map.get(log.checkpoint_id)
            if not checkpoint:
                continue
            
            split = SplitRecord(
                participant=participant,
                chip_id=chip_id,
                checkpoint=checkpoint,
                wave=wave,
                log_time=log.read_time,
                split_time=None,
                segment_time=None,
            )
            participant_splits[participant.bib_number].append(split)
    
    for bib_number, splits in participant_splits.items():
        sorted_splits = sorted(splits, key=lambda s: s.checkpoint.order)
        
        participant = sorted_splits[0].participant if sorted_splits else None
        wave = sorted_splits[0].wave if sorted_splits else None
        
        start_time = None
        if wave:
            start_time = wave.start_time
        elif sorted_splits:
            start_checkpoint = next(
                (s for s in sorted_splits if s.checkpoint.cp_type == CheckpointType.START),
                None
            )
            if start_checkpoint:
                start_time = start_checkpoint.log_time
        
        if start_time:
            for i, split in enumerate(sorted_splits):
                split_time = split.log_time - start_time
                segment_time = None
                
                if i > 0:
                    prev_split = sorted_splits[i - 1]
                    segment_time = split.log_time - prev_split.log_time
                
                updated_split = SplitRecord(
                    participant=split.participant,
                    chip_id=split.chip_id,
                    checkpoint=split.checkpoint,
                    wave=split.wave,
                    log_time=split.log_time,
                    split_time=split_time,
                    segment_time=segment_time,
                )
                sorted_splits[i] = updated_split
        
        participant_splits[bib_number] = sorted_splits
    
    return participant_splits


def check_missing_splits(
    race_data: RaceData,
    participant_splits: Dict[str, List[SplitRecord]]
) -> List[Violation]:
    """检查缺失计时点
    
    规则：
    - 完赛选手（有终点记录）缺少中间检查点 → 严重违规
    - 完赛选手缺少起点记录 → 严重违规
    - 缺少记录但也没有终点 → 警告（可能是退赛但未上报）
    """
    violations: List[Violation] = []
    
    required_checkpoints = race_data.get_sorted_checkpoints()
    if not required_checkpoints:
        return violations
    
    start_checkpoint = next(
        (cp for cp in required_checkpoints if cp.cp_type == CheckpointType.START),
        None
    )
    finish_checkpoint = next(
        (cp for cp in required_checkpoints if cp.cp_type == CheckpointType.FINISH),
        None
    )
    
    for bib_number, splits in participant_splits.items():
        visited_cp_ids = set(s.checkpoint.checkpoint_id for s in splits)
        required_cp_ids = set(cp.checkpoint_id for cp in required_checkpoints)
        
        missing_cps = [
            cp for cp in required_checkpoints
            if cp.checkpoint_id not in visited_cp_ids
        ]
        
        if not missing_cps:
            continue
        
        has_finish = finish_checkpoint and finish_checkpoint.checkpoint_id in visited_cp_ids
        has_start = start_checkpoint and start_checkpoint.checkpoint_id in visited_cp_ids
        
        if has_finish:
            missing_names = [cp.name for cp in missing_cps]
            
            if not has_start:
                violation = Violation(
                    violation_id=_generate_violation_id(),
                    violation_type=ViolationType.MISSING_SPLIT,
                    level=ViolationLevel.CRITICAL,
                    bib_number=bib_number,
                    message=f"选手 {bib_number} 完赛但缺少起点记录",
                    evidence={
                        "bib_number": bib_number,
                        "has_finish": True,
                        "missing_checkpoints": [cp.name for cp in missing_cps if cp.cp_type == CheckpointType.START],
                        "visited_checkpoints": list(visited_cp_ids)
                    }
                )
                violations.append(violation)
            else:
                violation = Violation(
                    violation_id=_generate_violation_id(),
                    violation_type=ViolationType.MISSING_SPLIT,
                    level=ViolationLevel.CRITICAL,
                    bib_number=bib_number,
                    message=f"选手 {bib_number} 完赛但缺少检查点: {', '.join(missing_names)}",
                    evidence={
                        "bib_number": bib_number,
                        "has_finish": True,
                        "missing_checkpoints": missing_names,
                        "visited_checkpoints": list(visited_cp_ids)
                    }
                )
                violations.append(violation)
        else:
            is_dnf = race_data.is_dnf(bib_number)
            
            if not is_dnf and visited_cp_ids:
                missing_names = [cp.name for cp in missing_cps]
                visited_names = [
                    cp.name for cp in required_checkpoints
                    if cp.checkpoint_id in visited_cp_ids
                ]
                
                violation = Violation(
                    violation_id=_generate_violation_id(),
                    violation_type=ViolationType.MISSING_SPLIT,
                    level=ViolationLevel.WARNING,
                    bib_number=bib_number,
                    message=f"选手 {bib_number} 仅通过 {len(visited_names)} 个检查点，可能退赛但未上报",
                    evidence={
                        "bib_number": bib_number,
                        "has_finish": False,
                        "is_dnf_recorded": is_dnf,
                        "visited_checkpoints": visited_names,
                        "missing_checkpoints": missing_names
                    }
                )
                violations.append(violation)
    
    return violations


def check_abnormal_speed(
    race_data: RaceData,
    participant_splits: Dict[str, List[SplitRecord]],
    max_speed_kmh: float = 25.0,
    min_speed_kmh: float = 2.0,
) -> List[Violation]:
    """检查异常速度
    
    规则：
    - 相邻检查点之间的速度超过阈值（默认25km/h，约7m/s，精英选手的极限）→ 严重违规
    - 速度过慢可能是停留过久，但不视为违规
    - 检查点之间的距离为0时跳过检查
    """
    violations: List[Violation] = []
    
    checkpoints = race_data.get_sorted_checkpoints()
    cp_map = {cp.checkpoint_id: cp for cp in checkpoints}
    
    for bib_number, splits in participant_splits.items():
        for i in range(1, len(splits)):
            prev_split = splits[i - 1]
            curr_split = splits[i]
            
            prev_cp = cp_map.get(prev_split.checkpoint.checkpoint_id)
            curr_cp = cp_map.get(curr_split.checkpoint.checkpoint_id)
            
            if not prev_cp or not curr_cp:
                continue
            
            distance_km = curr_cp.distance_from_start - prev_cp.distance_from_start
            
            if distance_km <= 0:
                continue
            
            if not curr_split.segment_time:
                continue
            
            time_hours = curr_split.segment_time.total_seconds() / 3600
            if time_hours <= 0:
                continue
            
            speed_kmh = distance_km / time_hours
            
            if speed_kmh > max_speed_kmh:
                violation = Violation(
                    violation_id=_generate_violation_id(),
                    violation_type=ViolationType.ABNORMAL_SPEED,
                    level=ViolationLevel.CRITICAL,
                    bib_number=bib_number,
                    message=f"选手 {bib_number} 在 {prev_cp.name}→{curr_cp.name} 区间速度异常: {speed_kmh:.1f} km/h",
                    evidence={
                        "bib_number": bib_number,
                        "from_checkpoint": prev_cp.name,
                        "to_checkpoint": curr_cp.name,
                        "distance_km": distance_km,
                        "segment_time": str(curr_split.segment_time),
                        "speed_kmh": round(speed_kmh, 2),
                        "max_allowed_kmh": max_speed_kmh,
                        "prev_time": prev_split.log_time.isoformat(),
                        "curr_time": curr_split.log_time.isoformat()
                    }
                )
                violations.append(violation)
    
    return violations


def check_dnf_finish(
    race_data: RaceData,
    participant_splits: Dict[str, List[SplitRecord]]
) -> List[Violation]:
    """检查退赛后仍完赛
    
    规则：
    - 选手在退赛名单中，但有终点检查点记录 → 严重违规
    """
    violations: List[Violation] = []
    
    finish_checkpoint = next(
        (cp for cp in race_data.checkpoints.values() if cp.cp_type == CheckpointType.FINISH),
        None
    )
    
    if not finish_checkpoint:
        return violations
    
    for bib_number, splits in participant_splits.items():
        if not race_data.is_dnf(bib_number):
            continue
        
        has_finish = any(
            s.checkpoint.checkpoint_id == finish_checkpoint.checkpoint_id
            for s in splits
        )
        
        if has_finish:
            dnf_record = race_data.get_dnf_record(bib_number)
            finish_split = next(
                s for s in splits
                if s.checkpoint.checkpoint_id == finish_checkpoint.checkpoint_id
            )
            
            violation = Violation(
                violation_id=_generate_violation_id(),
                violation_type=ViolationType.DNF_FINISH,
                level=ViolationLevel.CRITICAL,
                bib_number=bib_number,
                message=f"选手 {bib_number} 已标记退赛但有终点记录",
                evidence={
                    "bib_number": bib_number,
                    "dnf_time": dnf_record.dnf_time.isoformat() if dnf_record and dnf_record.dnf_time else None,
                    "dnf_last_checkpoint": dnf_record.last_checkpoint if dnf_record else None,
                    "dnf_reason": dnf_record.reason if dnf_record else None,
                    "finish_time": finish_split.log_time.isoformat(),
                    "finish_checkpoint": finish_checkpoint.name
                }
            )
            violations.append(violation)
    
    return violations


def check_early_start(
    race_data: RaceData,
    participant_splits: Dict[str, List[SplitRecord]],
    grace_seconds: int = 30
) -> List[Violation]:
    """检查抢跑/早出发
    
    规则：
    - 选手在分配的波次发枪时间之前通过起点 → 警告/严重
    - 默认有30秒的宽限期
    """
    violations: List[Violation] = []
    
    start_checkpoint = next(
        (cp for cp in race_data.checkpoints.values() if cp.cp_type == CheckpointType.START),
        None
    )
    
    if not start_checkpoint:
        return violations
    
    for bib_number, splits in participant_splits.items():
        start_splits = [
            s for s in splits
            if s.checkpoint.checkpoint_id == start_checkpoint.checkpoint_id
        ]
        
        if not start_splits:
            continue
        
        participant = start_splits[0].participant
        wave = start_splits[0].wave
        
        if not wave:
            continue
        
        actual_start = min(s.log_time for s in start_splits)
        official_start = wave.start_time
        grace_period = timedelta(seconds=grace_seconds)
        
        if actual_start < official_start - grace_period:
            early_seconds = (official_start - actual_start).total_seconds()
            
            violation = Violation(
                violation_id=_generate_violation_id(),
                violation_type=ViolationType.EARLY_START,
                level=ViolationLevel.CRITICAL if early_seconds > 60 else ViolationLevel.WARNING,
                bib_number=bib_number,
                message=f"选手 {bib_number} 抢跑 {early_seconds:.0f} 秒 (波次 {wave.wave_id})",
                evidence={
                    "bib_number": bib_number,
                    "wave_id": wave.wave_id,
                    "wave_name": wave.wave_name.value,
                    "official_start_time": official_start.isoformat(),
                    "actual_start_time": actual_start.isoformat(),
                    "early_seconds": early_seconds,
                    "grace_seconds": grace_seconds
                }
            )
            violations.append(violation)
    
    return violations


def check_wrong_wave(
    race_data: RaceData,
    participant_splits: Dict[str, List[SplitRecord]],
    wave_gap_minutes: int = 5
) -> List[Violation]:
    """检查波次发错（混入其他波次）
    
    规则：
    - 选手的实际出发时间与分配波次的时间相差超过阈值
    - 但与其他波次的时间更接近 → 可能是站错出发区
    """
    violations: List[Violation] = []
    
    start_checkpoint = next(
        (cp for cp in race_data.checkpoints.values() if cp.cp_type == CheckpointType.START),
        None
    )
    
    if not start_checkpoint or not race_data.waves:
        return violations
    
    wave_times = {
        wave_id: wave.start_time
        for wave_id, wave in race_data.waves.items()
    }
    
    for bib_number, splits in participant_splits.items():
        start_splits = [
            s for s in splits
            if s.checkpoint.checkpoint_id == start_checkpoint.checkpoint_id
        ]
        
        if not start_splits:
            continue
        
        wave = start_splits[0].wave
        actual_start = min(s.log_time for s in start_splits)
        
        if not wave:
            continue
        
        assigned_time = wave.start_time
        assigned_diff = abs((actual_start - assigned_time).total_seconds() / 60)
        
        closest_wave = wave.wave_id
        closest_diff = assigned_diff
        
        for wave_id, wave_time in wave_times.items():
            if wave_id == wave.wave_id:
                continue
            diff = abs((actual_start - wave_time).total_seconds() / 60)
            if diff < closest_diff:
                closest_diff = diff
                closest_wave = wave_id
        
        if assigned_diff > wave_gap_minutes and closest_diff < assigned_diff:
            violation = Violation(
                violation_id=_generate_violation_id(),
                violation_type=ViolationType.WRONG_WAVE,
                level=ViolationLevel.WARNING,
                bib_number=bib_number,
                wave_id=wave.wave_id,
                message=f"选手 {bib_number} 可能站错波次区: 分配波次 {wave.wave_id}，但实际出发时间更接近 {closest_wave}",
                evidence={
                    "bib_number": bib_number,
                    "assigned_wave": wave.wave_id,
                    "assigned_wave_time": assigned_time.isoformat(),
                    "actual_start_time": actual_start.isoformat(),
                    "diff_from_assigned_min": round(assigned_diff, 2),
                    "closest_wave": closest_wave,
                    "diff_from_closest_min": round(closest_diff, 2),
                    "threshold_min": wave_gap_minutes
                }
            )
            violations.append(violation)
    
    return violations


def run_all_checks(
    race_data: RaceData,
    participant_splits: Optional[Dict[str, List[SplitRecord]]] = None,
    config: Optional[Dict[str, Any]] = None
) -> List[Violation]:
    """运行所有校验规则
    
    Args:
        race_data: 赛事数据
        participant_splits: 已构建的分段记录（可选，不提供则自动构建）
        config: 配置参数
            - max_speed_kmh: 最大允许速度(km/h)
            - min_speed_kmh: 最小允许速度(km/h)
            - grace_seconds: 抢跑宽限时间(秒)
            - wave_gap_minutes: 波次间隔判定阈值(分钟)
    
    Returns:
        所有违规记录列表
    """
    config = config or {}
    
    if participant_splits is None:
        participant_splits = build_split_records(race_data)
    
    violations: List[Violation] = []
    
    violations.extend(check_duplicate_chips(race_data))
    violations.extend(check_wave_conflicts(race_data))
    violations.extend(check_unregistered_chips(race_data))
    violations.extend(check_missing_splits(race_data, participant_splits))
    violations.extend(check_abnormal_speed(
        race_data,
        participant_splits,
        max_speed_kmh=config.get("max_speed_kmh", 25.0),
        min_speed_kmh=config.get("min_speed_kmh", 2.0),
    ))
    violations.extend(check_dnf_finish(race_data, participant_splits))
    violations.extend(check_early_start(
        race_data,
        participant_splits,
        grace_seconds=config.get("grace_seconds", 30),
    ))
    violations.extend(check_wrong_wave(
        race_data,
        participant_splits,
        wave_gap_minutes=config.get("wave_gap_minutes", 5),
    ))
    
    return violations
