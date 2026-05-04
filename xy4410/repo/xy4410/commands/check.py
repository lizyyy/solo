#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check命令 - 检查生产风险
"""

from pathlib import Path
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict

from core.storage import DataStore
from core.models import (
    Issue, IssueType, IssueSeverity,
    BOM, PickPlaceData, OvenProfile, 
    SolderPasteBatch, StencilBatch, AOI_Report,
    ReworkRecord, ProductionBatch, generate_id
)


def normalize_package(package: str) -> str:
    if not package:
        return ""
    pkg = package.strip().upper()
    pkg = pkg.replace('-', '')
    pkg = pkg.replace('_', '')
    pkg = pkg.replace(' ', '')
    return pkg


def packages_match(pkg1: str, pkg2: str, tolerance: bool = True) -> bool:
    if not pkg1 or not pkg2:
        return False
    
    norm1 = normalize_package(pkg1)
    norm2 = normalize_package(pkg2)
    
    if norm1 == norm2:
        return True
    
    if tolerance:
        simple_map = {
            '0402': ['0402', 'SM0402', 'RES0402', 'CAP0402'],
            '0603': ['0603', 'SM0603', 'RES0603', 'CAP0603'],
            '0805': ['0805', 'SM0805', 'RES0805', 'CAP0805'],
            '1206': ['1206', 'SM1206', 'RES1206', 'CAP1206'],
            'SOP8': ['SOP8', 'SOIC8', 'SO8'],
            'SOP16': ['SOP16', 'SOIC16', 'SO16'],
            'QFP32': ['QFP32', 'LQFP32'],
            'QFP48': ['QFP48', 'LQFP48'],
            'QFN16': ['QFN16', 'MLF16'],
            'QFN24': ['QFN24', 'MLF24'],
            'QFN32': ['QFN32', 'MLF32'],
        }
        
        for key, variants in simple_map.items():
            if norm1 in variants and norm2 in variants:
                return True
    
    return False


def check_package_mismatch(bom: BOM, pick_place: PickPlaceData) -> List[Issue]:
    issues: List[Issue] = []
    
    bom_refs = bom.get_all_references()
    pp_refs = pick_place.get_all_references()
    
    for ref in bom_refs & pp_refs:
        bom_part = bom.get_part_by_reference(ref)
        pp_item = pick_place.get_item_by_reference(ref)
        
        if bom_part and pp_item:
            bom_pkg = bom_part.package
            pp_pkg = pp_item.package
            
            if bom_pkg and pp_pkg:
                if not packages_match(bom_pkg, pp_pkg):
                    issue = Issue(
                        issue_id=generate_id("ISSUE"),
                        issue_type=IssueType.PACKAGE_MISMATCH,
                        severity=IssueSeverity.CRITICAL,
                        board_number=bom.board_number,
                        reference=ref,
                        message=f"位号 {ref} 封装不匹配: BOM={bom_pkg}, 贴片坐标={pp_pkg}",
                        details={
                            "reference": ref,
                            "bom_package": bom_pkg,
                            "pick_place_package": pp_pkg,
                            "bom_part_number": bom_part.part_number,
                            "pp_part_number": pp_item.part_number,
                            "board_number": bom.board_number,
                            "board_revision": bom.board_revision
                        }
                    )
                    issues.append(issue)
    
    bom_only = bom_refs - pp_refs
    if bom_only:
        for ref in sorted(bom_only):
            bom_part = bom.get_part_by_reference(ref)
            issue = Issue(
                issue_id=generate_id("ISSUE"),
                issue_type=IssueType.REFERENCE_MISMATCH,
                severity=IssueSeverity.WARNING,
                board_number=bom.board_number,
                reference=ref,
                message=f"位号 {ref} 存在于BOM中，但不存在于贴片坐标中",
                details={
                    "reference": ref,
                    "location": "BOM_ONLY",
                    "bom_part_number": bom_part.part_number if bom_part else "",
                    "bom_description": bom_part.description if bom_part else "",
                    "board_number": bom.board_number
                }
            )
            issues.append(issue)
    
    pp_only = pp_refs - bom_refs
    if pp_only:
        for ref in sorted(pp_only):
            pp_item = pick_place.get_item_by_reference(ref)
            issue = Issue(
                issue_id=generate_id("ISSUE"),
                issue_type=IssueType.REFERENCE_MISMATCH,
                severity=IssueSeverity.WARNING,
                board_number=pick_place.board_number,
                reference=ref,
                message=f"位号 {ref} 存在于贴片坐标中，但不存在于BOM中",
                details={
                    "reference": ref,
                    "location": "PICK_PLACE_ONLY",
                    "pp_part_number": pp_item.part_number if pp_item else "",
                    "pp_value": pp_item.value if pp_item else "",
                    "board_number": pick_place.board_number
                }
            )
            issues.append(issue)
    
    return issues


def check_solder_paste_expired(paste: SolderPasteBatch, check_date: Optional[date] = None) -> List[Issue]:
    issues: List[Issue] = []
    
    if check_date is None:
        check_date = date.today()
    
    if paste.is_expired(check_date):
        issue = Issue(
            issue_id=generate_id("ISSUE"),
            issue_type=IssueType.SOLDER_PASTE_EXPIRED,
            severity=IssueSeverity.CRITICAL,
            message=f"锡膏批次 {paste.lot_number} 已过期",
            details={
                "batch_id": paste.batch_id,
                "lot_number": paste.lot_number,
                "solder_paste_type": paste.solder_paste_type,
                "manufacturer": paste.manufacturer,
                "expiry_date": paste.expiry_date.isoformat(),
                "check_date": check_date.isoformat(),
                "status": paste.status
            }
        )
        issues.append(issue)
    
    thaw_remaining = paste.get_thaw_remaining_hours()
    if paste.thaw_complete_time and thaw_remaining <= 0:
        issue = Issue(
            issue_id=generate_id("ISSUE"),
            issue_type=IssueType.SOLDER_PASTE_THAW_TIMEOUT,
            severity=IssueSeverity.CRITICAL,
            message=f"锡膏批次 {paste.lot_number} 回温后已超时，无法使用",
            details={
                "batch_id": paste.batch_id,
                "lot_number": paste.lot_number,
                "thaw_complete_time": paste.thaw_complete_time.isoformat() if paste.thaw_complete_time else None,
                "max_room_temp_hours": paste.max_room_temp_hours,
                "thaw_remaining_hours": thaw_remaining,
                "status": paste.status
            }
        )
        issues.append(issue)
    elif paste.thaw_complete_time and thaw_remaining < 4.0:
        issue = Issue(
            issue_id=generate_id("ISSUE"),
            issue_type=IssueType.SOLDER_PASTE_THAW_TIMEOUT,
            severity=IssueSeverity.WARNING,
            message=f"锡膏批次 {paste.lot_number} 剩余可用时间不足 {thaw_remaining:.1f} 小时",
            details={
                "batch_id": paste.batch_id,
                "lot_number": paste.lot_number,
                "thaw_complete_time": paste.thaw_complete_time.isoformat() if paste.thaw_complete_time else None,
                "max_room_temp_hours": paste.max_room_temp_hours,
                "thaw_remaining_hours": thaw_remaining,
                "status": paste.status
            }
        )
        issues.append(issue)
    
    return issues


def check_oven_profile(profile: OvenProfile, target_profile: Optional[OvenProfile] = None,
                       config: Optional[Dict[str, Any]] = None) -> List[Issue]:
    issues: List[Issue] = []
    
    if config is None:
        config = {}
    
    soak_start = target_profile.target_soak_start if target_profile else config.get('default_soak_start', 150.0)
    soak_end = target_profile.target_soak_end if target_profile else config.get('default_soak_end', 180.0)
    soak_min_time = target_profile.target_soak_min_time if target_profile else config.get('default_soak_min_time', 60.0)
    soak_max_time = target_profile.target_soak_max_time if target_profile else config.get('default_soak_max_time', 120.0)
    
    solder_type = profile.solder_paste_type or (target_profile.solder_paste_type if target_profile else "")
    
    if "无铅" in solder_type or "lead_free" in solder_type.lower():
        peak_min = target_profile.target_peak_min if target_profile and target_profile.target_peak_min > 0 else config.get('default_peak_min_lead_free', 235.0)
        peak_max = target_profile.target_peak_max if target_profile and target_profile.target_peak_max > 0 else config.get('default_peak_max_lead_free', 260.0)
    else:
        peak_min = target_profile.target_peak_min if target_profile and target_profile.target_peak_min > 0 else config.get('default_peak_min_lead', 183.0)
        peak_max = target_profile.target_peak_max if target_profile and target_profile.target_peak_max > 0 else config.get('default_peak_max_lead', 220.0)
    
    actual_peak = profile.get_peak_temperature()
    actual_soak_time = profile.get_soak_time(soak_start, soak_end)
    
    if actual_peak < peak_min:
        issue = Issue(
            issue_id=generate_id("ISSUE"),
            issue_type=IssueType.OVEN_PEAK_TEMP_LOW,
            severity=IssueSeverity.CRITICAL,
            message=f"炉温曲线峰值偏低: 实际 {actual_peak:.1f}°C，最低要求 {peak_min}°C",
            details={
                "profile_id": profile.profile_id,
                "profile_name": profile.name,
                "solder_paste_type": solder_type,
                "actual_peak": actual_peak,
                "required_peak_min": peak_min,
                "required_peak_max": peak_max
            }
        )
        issues.append(issue)
    elif actual_peak > peak_max:
        issue = Issue(
            issue_id=generate_id("ISSUE"),
            issue_type=IssueType.OVEN_PEAK_TEMP_HIGH,
            severity=IssueSeverity.CRITICAL,
            message=f"炉温曲线峰值偏高: 实际 {actual_peak:.1f}°C，最高要求 {peak_max}°C",
            details={
                "profile_id": profile.profile_id,
                "profile_name": profile.name,
                "solder_paste_type": solder_type,
                "actual_peak": actual_peak,
                "required_peak_min": peak_min,
                "required_peak_max": peak_max
            }
        )
        issues.append(issue)
    
    if actual_soak_time < soak_min_time:
        issue = Issue(
            issue_id=generate_id("ISSUE"),
            issue_type=IssueType.OVEN_SOAK_TIME_SHORT,
            severity=IssueSeverity.WARNING,
            message=f"浸泡区时间不足: 实际 {actual_soak_time:.0f}秒，最低要求 {soak_min_time}秒",
            details={
                "profile_id": profile.profile_id,
                "profile_name": profile.name,
                "soak_start_temp": soak_start,
                "soak_end_temp": soak_end,
                "actual_soak_time": actual_soak_time,
                "required_soak_min": soak_min_time,
                "required_soak_max": soak_max_time
            }
        )
        issues.append(issue)
    elif actual_soak_time > soak_max_time:
        issue = Issue(
            issue_id=generate_id("ISSUE"),
            issue_type=IssueType.OVEN_SOAK_TIME_LONG,
            severity=IssueSeverity.WARNING,
            message=f"浸泡区时间过长: 实际 {actual_soak_time:.0f}秒，最高要求 {soak_max_time}秒",
            details={
                "profile_id": profile.profile_id,
                "profile_name": profile.name,
                "soak_start_temp": soak_start,
                "soak_end_temp": soak_end,
                "actual_soak_time": actual_soak_time,
                "required_soak_min": soak_min_time,
                "required_soak_max": soak_max_time
            }
        )
        issues.append(issue)
    
    return issues


def check_duplicate_rework(aoi_reports: List[AOI_Report], reworks: List[ReworkRecord],
                           max_reworks: int = 2) -> List[Issue]:
    issues: List[Issue] = []
    
    serial_rework_counts: Dict[str, int] = defaultdict(int)
    
    for rework in reworks:
        if rework.serial_number:
            serial_rework_counts[rework.serial_number] += 1
    
    for serial, count in serial_rework_counts.items():
        if count >= max_reworks:
            issue = Issue(
                issue_id=generate_id("ISSUE"),
                issue_type=IssueType.DUPLICATE_REWORK,
                severity=IssueSeverity.CRITICAL,
                message=f"序列号 {serial} 已返修 {count} 次，超过最大允许次数 {max_reworks} 次",
                details={
                    "serial_number": serial,
                    "rework_count": count,
                    "max_allowed": max_reworks,
                    "rework_records": [
                        {
                            "rework_id": r.rework_id,
                            "rework_time": r.rework_time.isoformat() if r.rework_time else None,
                            "rework_type": r.rework_type,
                            "rework_result": r.rework_result
                        }
                        for r in reworks if r.serial_number == serial
                    ]
                }
            )
            issues.append(issue)
    
    return issues


def check_all(store: DataStore, check_date: Optional[date] = None,
              board_number: Optional[str] = None,
              batch_id: Optional[str] = None) -> List[Issue]:
    all_issues: List[Issue] = []
    
    if check_date is None:
        check_date = date.today()
    
    config = store.get_config()
    max_reworks = config.get('max_reworks_allowed', 2)
    
    boms = store.get_all_boms()
    pick_places = store.get_all_pick_places()
    
    for bom in boms:
        if board_number and bom.board_number != board_number:
            continue
        
        pp = store.get_pick_place_by_board(bom.board_number, bom.board_revision)
        if pp:
            all_issues.extend(check_package_mismatch(bom, pp))
    
    pastes = store.get_active_solder_pastes()
    for paste in pastes:
        all_issues.extend(check_solder_paste_expired(paste, check_date))
    
    profiles = store.get_all_oven_profiles()
    target_profile = None
    
    if batch_id:
        batch = store.get_production_batch(batch_id)
        if batch:
            if batch.oven_profile_id:
                target_profile = store.get_oven_profile(batch.oven_profile_id)
            if batch.actual_oven_profile_id:
                actual_profile = store.get_oven_profile(batch.actual_oven_profile_id)
                if actual_profile:
                    all_issues.extend(check_oven_profile(actual_profile, target_profile, config))
    else:
        for profile in profiles:
            if len(profile.points) > 0:
                all_issues.extend(check_oven_profile(profile, target_profile, config))
    
    reworks = store.get_all_reworks()
    aoi_reports = store.get_all_aoi_reports()
    all_issues.extend(check_duplicate_rework(aoi_reports, reworks, max_reworks))
    
    return all_issues


def check_command(work_dir: Path, date_str: Optional[str] = None, 
                  board_number: Optional[str] = None,
                  batch_id: Optional[str] = None,
                  verbose: bool = False):
    store = DataStore(work_dir)
    
    check_date = None
    if date_str:
        try:
            from commands.import_ import parse_date
            check_date = parse_date(date_str)
        except:
            raise ValueError(f"无效的日期格式: {date_str}")
    
    if check_date is None:
        check_date = date.today()
    
    print(f"正在检查生产风险...")
    print(f"  检查日期: {check_date.isoformat()}")
    if board_number:
        print(f"  限定板号: {board_number}")
    if batch_id:
        print(f"  限定批次: {batch_id}")
    print()
    
    issues = check_all(store, check_date, board_number, batch_id)
    
    for issue in issues:
        store.save_issue(issue)
    
    critical_issues = [i for i in issues if i.severity == IssueSeverity.CRITICAL]
    warning_issues = [i for i in issues if i.severity == IssueSeverity.WARNING]
    info_issues = [i for i in issues if i.severity == IssueSeverity.INFO]
    
    print(f"检查完成！共发现 {len(issues)} 个问题:")
    print(f"  严重问题: {len(critical_issues)} 个")
    print(f"  警告问题: {len(warning_issues)} 个")
    print(f"  信息问题: {len(info_issues)} 个")
    print()
    
    if issues:
        print("=" * 70)
        print("问题详情:")
        print("=" * 70)
        print()
        
        for i, issue in enumerate(issues, 1):
            status = "[已确认]" if issue.confirmed else "[未确认]"
            print(f"[{i}] {issue.issue_type.value} ({issue.severity.value}) {status}")
            print(f"    问题ID: {issue.issue_id}")
            print(f"    描述: {issue.message}")
            
            if issue.board_number:
                print(f"    板号: {issue.board_number}")
            if issue.reference:
                print(f"    位号: {issue.reference}")
            
            if verbose:
                print(f"    详细信息: {issue.details}")
            
            if issue.confirmed and issue.confirm_remark:
                print(f"    确认备注: {issue.confirm_remark}")
            
            print()
    
    if not issues:
        print("恭喜！未发现任何问题，可以安全放行。")
    else:
        print("提示:")
        print(f"  - 使用 'smt-workshop review <问题ID> -r \"备注内容\"' 来确认问题并添加备注")
        print(f"  - 使用 'smt-workshop export --all' 导出报告")
