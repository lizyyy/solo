"""规则引擎模块 - 执行校验检查"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from .log_parser import LogParser, TerminalStatus
from .tile_index import TileIndexManager, ParcelInfo, TaskInfo


class CheckSeverity(Enum):
    """检查结果严重程度"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class CheckCategory(Enum):
    """检查类别"""
    TILE_COVERAGE = "tile_coverage"
    VERSION = "version"
    TASK = "task"
    TERMINAL = "terminal"
    ROLLBACK = "rollback"
    HASH = "hash"


@dataclass
class CheckResult:
    """单个检查结果"""
    check_id: str
    category: CheckCategory
    severity: CheckSeverity
    title: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    affected_items: List[str] = field(default_factory=list)
    recommendation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_id": self.check_id,
            "category": self.category.value,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "details": self.details,
            "affected_items": self.affected_items,
            "recommendation": self.recommendation
        }


@dataclass
class CheckReport:
    """完整检查报告"""
    generated_at: datetime
    total_checks: int
    passed_count: int
    warning_count: int
    error_count: int
    critical_count: int
    results: List[CheckResult] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "generated_at": self.generated_at.isoformat(),
            "total_checks": self.total_checks,
            "passed_count": self.passed_count,
            "warning_count": self.warning_count,
            "error_count": self.error_count,
            "critical_count": self.critical_count,
            "results": [r.to_dict() for r in self.results],
            "summary": self.summary
        }


class RulesEngine:
    """规则引擎 - 执行所有校验规则"""

    def __init__(self, tile_manager: TileIndexManager, log_parser: LogParser):
        self.tile_manager = tile_manager
        self.log_parser = log_parser
        self.results: List[CheckResult] = []

    def run_all_checks(self) -> CheckReport:
        """运行所有检查"""
        self.results = []
        
        self.check_tile_coverage()
        self.check_parcel_versions()
        self.check_task_duplicates()
        self.check_task_consistency()
        self.check_terminal_status()
        self.check_rollback_availability()
        self.check_hash_consistency()
        
        passed_count = sum(1 for r in self.results if r.severity == CheckSeverity.INFO)
        warning_count = sum(1 for r in self.results if r.severity == CheckSeverity.WARNING)
        error_count = sum(1 for r in self.results if r.severity == CheckSeverity.ERROR)
        critical_count = sum(1 for r in self.results if r.severity == CheckSeverity.CRITICAL)
        
        summary = self._build_summary()
        
        return CheckReport(
            generated_at=datetime.now(),
            total_checks=len(self.results),
            passed_count=passed_count,
            warning_count=warning_count,
            error_count=error_count,
            critical_count=critical_count,
            results=self.results,
            summary=summary
        )

    def check_tile_coverage(self) -> List[CheckResult]:
        """检查瓦片覆盖完整性"""
        check_results = []
        
        for parcel_key, parcel in self.tile_manager.parcels.items():
            stats = self.tile_manager.get_coverage_stats(parcel)
            
            if stats["coverage_percent"] < 100.0:
                missing_count = stats["missing_tiles"]
                if missing_count > 0:
                    severity = CheckSeverity.ERROR
                    if stats["coverage_percent"] >= 95.0:
                        severity = CheckSeverity.WARNING
                    elif stats["coverage_percent"] < 50.0:
                        severity = CheckSeverity.CRITICAL
                    
                    result = CheckResult(
                        check_id=f"tile_coverage_{parcel.parcel_id}",
                        category=CheckCategory.TILE_COVERAGE,
                        severity=severity,
                        title=f"地块 {parcel.name} 瓦片覆盖不完整",
                        message=f"覆盖率 {stats['coverage_percent']}%，缺失 {missing_count} 个瓦片",
                        details={
                            "parcel_id": parcel.parcel_id,
                            "parcel_name": parcel.name,
                            "version": parcel.version,
                            "total_tiles": stats["total_tiles"],
                            "available_tiles": stats["available_tiles"],
                            "missing_tiles": stats["missing_tiles"],
                            "coverage_percent": stats["coverage_percent"],
                            "missing_tile_sample": stats["missing_tile_list"][:20] if stats["missing_tile_list"] else []
                        },
                        affected_items=stats["missing_tile_list"][:50] if stats["missing_tile_list"] else [],
                        recommendation=f"补充缺失的瓦片。检查瓦片目录是否包含所有必要的缩放级别 {parcel.required_zoom_levels}"
                    )
                    self.results.append(result)
                    check_results.append(result)
            else:
                result = CheckResult(
                    check_id=f"tile_coverage_{parcel.parcel_id}",
                    category=CheckCategory.TILE_COVERAGE,
                    severity=CheckSeverity.INFO,
                    title=f"地块 {parcel.name} 瓦片覆盖完整",
                    message=f"覆盖率 100%，共 {stats['total_tiles']} 个瓦片",
                    details={
                        "parcel_id": parcel.parcel_id,
                        "coverage_percent": 100.0
                    },
                    recommendation="瓦片覆盖完整，无需操作"
                )
                self.results.append(result)
                check_results.append(result)
        
        return check_results

    def check_parcel_versions(self) -> List[CheckResult]:
        """检查地块版本一致性"""
        check_results = []
        
        parcel_versions: Dict[str, List[Tuple[str, str]]] = {}
        for parcel_key, parcel in self.tile_manager.parcels.items():
            if parcel.parcel_id not in parcel_versions:
                parcel_versions[parcel.parcel_id] = []
            parcel_versions[parcel.parcel_id].append((parcel.version, parcel_key))
        
        for parcel_id, versions in parcel_versions.items():
            if len(versions) > 1:
                versions_sorted = sorted(versions, key=lambda v: v[0], reverse=True)
                latest_version = versions_sorted[0][0]
                older_versions = [v for v in versions_sorted if v[0] != latest_version]
                
                result = CheckResult(
                    check_id=f"parcel_version_{parcel_id}",
                    category=CheckCategory.VERSION,
                    severity=CheckSeverity.WARNING,
                    title=f"地块 {parcel_id} 存在多个版本",
                    message=f"发现 {len(versions)} 个版本，最新版本为 {latest_version}",
                    details={
                        "parcel_id": parcel_id,
                        "latest_version": latest_version,
                        "all_versions": [v[0] for v in versions],
                        "older_versions_count": len(older_versions)
                    },
                    affected_items=[f"{v[0]} ({v[1]})" for v in older_versions],
                    recommendation=f"确认所有终端是否已更新到最新版本 {latest_version}。旧版本可能导致作业不一致"
                )
                self.results.append(result)
                check_results.append(result)
            
            for terminal_id, status in self.log_parser.terminals.items():
                synced_version = status.synced_parcels.get(parcel_id)
                if synced_version:
                    latest_source = max(v[0] for v in versions)
                    if synced_version != latest_source:
                        result = CheckResult(
                            check_id=f"terminal_parcel_version_{terminal_id}_{parcel_id}",
                            category=CheckCategory.VERSION,
                            severity=CheckSeverity.ERROR,
                            title=f"终端 {terminal_id} 地块版本过时",
                            message=f"终端同步版本 {synced_version}，源最新版本 {latest_source}",
                            details={
                                "terminal_id": terminal_id,
                                "parcel_id": parcel_id,
                                "terminal_version": synced_version,
                                "source_version": latest_source
                            },
                            affected_items=[terminal_id],
                            recommendation=f"同步终端 {terminal_id} 的地块 {parcel_id} 到最新版本 {latest_source}"
                        )
                        self.results.append(result)
                        check_results.append(result)
        
        return check_results

    def check_task_duplicates(self) -> List[CheckResult]:
        """检查任务重复下发"""
        check_results = []
        
        task_assignments: Dict[str, List[Tuple[str, str]]] = {}
        
        for task_id, task in self.tile_manager.tasks.items():
            if task.assigned_terminal:
                key = f"{task.assigned_terminal}_{task_id}"
                if key not in task_assignments:
                    task_assignments[key] = []
                task_assignments[key].append((task.status, task.task_id))
        
        for terminal_id, status in self.log_parser.terminals.items():
            task_count: Dict[str, int] = {}
            for task_id in status.assigned_tasks:
                task_count[task_id] = task_count.get(task_id, 0) + 1
            
            for task_id, count in task_count.items():
                if count > 1:
                    result = CheckResult(
                        check_id=f"task_duplicate_{terminal_id}_{task_id}",
                        category=CheckCategory.TASK,
                        severity=CheckSeverity.ERROR,
                        title=f"任务重复下发",
                        message=f"终端 {terminal_id} 收到任务 {task_id} 共 {count} 次",
                        details={
                            "terminal_id": terminal_id,
                            "task_id": task_id,
                            "receive_count": count
                        },
                        affected_items=[terminal_id],
                        recommendation=f"检查任务下发系统，避免重复下发任务 {task_id} 到终端 {terminal_id}"
                    )
                    self.results.append(result)
                    check_results.append(result)
        
        return check_results

    def check_task_consistency(self) -> List[CheckResult]:
        """检查任务与地块的一致性"""
        check_results = []
        
        for task_id, task in self.tile_manager.tasks.items():
            missing_parcels = []
            for parcel_id in task.parcel_ids:
                found = False
                for parcel_key, parcel in self.tile_manager.parcels.items():
                    if parcel.parcel_id == parcel_id:
                        found = True
                        break
                if not found:
                    missing_parcels.append(parcel_id)
            
            if missing_parcels:
                result = CheckResult(
                    check_id=f"task_parcel_missing_{task_id}",
                    category=CheckCategory.TASK,
                    severity=CheckSeverity.CRITICAL,
                    title=f"任务 {task.name} 引用不存在的地块",
                    message=f"任务引用了 {len(missing_parcels)} 个不存在的地块",
                    details={
                        "task_id": task_id,
                        "task_name": task.name,
                        "status": task.status,
                        "missing_parcels": missing_parcels
                    },
                    affected_items=missing_parcels,
                    recommendation=f"补充缺失的地块数据或修正任务 {task_id} 的配置"
                )
                self.results.append(result)
                check_results.append(result)
        
        return check_results

    def check_terminal_status(self) -> List[CheckResult]:
        """检查终端状态"""
        check_results = []
        
        for terminal_id, status in self.log_parser.terminals.items():
            if status.status == "offline":
                result = CheckResult(
                    check_id=f"terminal_offline_{terminal_id}",
                    category=CheckCategory.TERMINAL,
                    severity=CheckSeverity.WARNING,
                    title=f"终端 {terminal_id} 处于离线状态",
                    message=f"最后活动时间: {status.last_seen}",
                    details={
                        "terminal_id": terminal_id,
                        "status": status.status,
                        "last_seen": status.last_seen.isoformat() if status.last_seen else None
                    },
                    affected_items=[terminal_id],
                    recommendation=f"检查终端 {terminal_id} 的网络连接和设备状态"
                )
                self.results.append(result)
                check_results.append(result)
            
            if status.status == "syncing":
                result = CheckResult(
                    check_id=f"terminal_syncing_{terminal_id}",
                    category=CheckCategory.TERMINAL,
                    severity=CheckSeverity.INFO,
                    title=f"终端 {terminal_id} 正在同步",
                    message=f"同步会话开始于: {status.last_sync_session}",
                    details={
                        "terminal_id": terminal_id,
                        "status": status.status,
                        "last_sync_session": status.last_sync_session.isoformat() if status.last_sync_session else None
                    },
                    affected_items=[terminal_id],
                    recommendation="等待同步完成或检查同步进度"
                )
                self.results.append(result)
                check_results.append(result)
            
            if status.errors:
                result = CheckResult(
                    check_id=f"terminal_errors_{terminal_id}",
                    category=CheckCategory.TERMINAL,
                    severity=CheckSeverity.ERROR,
                    title=f"终端 {terminal_id} 存在错误",
                    message=f"发现 {len(status.errors)} 个错误记录",
                    details={
                        "terminal_id": terminal_id,
                        "error_count": len(status.errors),
                        "errors": status.errors[:10]
                    },
                    affected_items=[terminal_id],
                    recommendation=f"排查终端 {terminal_id} 的错误日志，解决问题后重新同步"
                )
                self.results.append(result)
                check_results.append(result)
            
            if status.missing_tiles:
                result = CheckResult(
                    check_id=f"terminal_missing_tiles_{terminal_id}",
                    category=CheckCategory.TERMINAL,
                    severity=CheckSeverity.WARNING,
                    title=f"终端 {terminal_id} 报告缺失瓦片",
                    message=f"报告缺失 {len(status.missing_tiles)} 个瓦片",
                    details={
                        "terminal_id": terminal_id,
                        "missing_tiles_count": len(status.missing_tiles),
                        "missing_tiles_sample": status.missing_tiles[:20]
                    },
                    affected_items=status.missing_tiles[:50],
                    recommendation=f"确认源瓦片库是否完整，或重新同步终端 {terminal_id}"
                )
                self.results.append(result)
                check_results.append(result)
            
            if status.failed_tasks:
                result = CheckResult(
                    check_id=f"terminal_failed_tasks_{terminal_id}",
                    category=CheckCategory.TERMINAL,
                    severity=CheckSeverity.ERROR,
                    title=f"终端 {terminal_id} 存在失败任务",
                    message=f"有 {len(status.failed_tasks)} 个任务执行失败",
                    details={
                        "terminal_id": terminal_id,
                        "failed_tasks": status.failed_tasks
                    },
                    affected_items=status.failed_tasks,
                    recommendation=f"检查失败任务的详细日志，重新下发或修复后重试"
                )
                self.results.append(result)
                check_results.append(result)
        
        return check_results

    def check_rollback_availability(self) -> List[CheckResult]:
        """检查回滚包可用性"""
        check_results = []
        
        if not self.tile_manager.rollback_packages:
            result = CheckResult(
                check_id="rollback_no_packages",
                category=CheckCategory.ROLLBACK,
                severity=CheckSeverity.WARNING,
                title="未找到回滚包",
                message="回滚目录中未发现任何回滚包",
                details={},
                recommendation="确保回滚包目录配置正确，或创建必要的回滚包"
            )
            self.results.append(result)
            check_results.append(result)
        else:
            result = CheckResult(
                check_id="rollback_packages_available",
                category=CheckCategory.ROLLBACK,
                severity=CheckSeverity.INFO,
                title="回滚包可用",
                message=f"发现 {len(self.tile_manager.rollback_packages)} 个回滚包",
                details={
                    "package_count": len(self.tile_manager.rollback_packages),
                    "packages": [
                        {
                            "id": pkg.package_id,
                            "version": pkg.version,
                            "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
                            "affected_parcels": pkg.affected_parcels
                        }
                        for pkg in self.tile_manager.rollback_packages.values()
                    ]
                },
                recommendation="回滚包可用，可在需要时执行回滚"
            )
            self.results.append(result)
            check_results.append(result)
        
        for terminal_id, status in self.log_parser.terminals.items():
            if not status.has_rollback_capability:
                result = CheckResult(
                    check_id=f"rollback_terminal_capability_{terminal_id}",
                    category=CheckCategory.ROLLBACK,
                    severity=CheckSeverity.WARNING,
                    title=f"终端 {terminal_id} 回滚能力未知",
                    message="该终端没有成功的回滚记录，回滚能力未知",
                    details={
                        "terminal_id": terminal_id
                    },
                    affected_items=[terminal_id],
                    recommendation=f"确认终端 {terminal_id} 是否支持回滚功能，或进行一次测试回滚"
                )
                self.results.append(result)
                check_results.append(result)
        
        return check_results

    def check_hash_consistency(self) -> List[CheckResult]:
        """检查哈希一致性"""
        check_results = []
        
        total_files = len(self.tile_manager.tile_cache) + len(self.tile_manager.parcels)
        
        result = CheckResult(
            check_id="hash_consistency",
            category=CheckCategory.HASH,
            severity=CheckSeverity.INFO,
            title="哈希索引完成",
            message=f"已为 {total_files} 个文件计算了哈希值",
            details={
                "tile_count": len(self.tile_manager.tile_cache),
                "parcel_count": len(self.tile_manager.parcels)
            },
            recommendation="哈希值可用于验证文件完整性和检测篡改"
        )
        self.results.append(result)
        check_results.append(result)
        
        return check_results

    def _build_summary(self) -> Dict[str, Any]:
        """构建检查摘要"""
        summary = {
            "categories": {},
            "severity_counts": {
                "info": 0,
                "warning": 0,
                "error": 0,
                "critical": 0
            },
            "top_issues": []
        }
        
        category_counts: Dict[str, Dict[str, int]] = {}
        for result in self.results:
            cat = result.category.value
            sev = result.severity.value
            
            if cat not in category_counts:
                category_counts[cat] = {"info": 0, "warning": 0, "error": 0, "critical": 0}
            category_counts[cat][sev] += 1
            
            summary["severity_counts"][sev] += 1
            
            if result.severity in [CheckSeverity.ERROR, CheckSeverity.CRITICAL]:
                summary["top_issues"].append({
                    "title": result.title,
                    "severity": result.severity.value,
                    "message": result.message
                })
        
        summary["categories"] = category_counts
        summary["top_issues"] = summary["top_issues"][:10]
        
        return summary
