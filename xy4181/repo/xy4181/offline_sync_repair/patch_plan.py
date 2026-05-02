"""修补计划生成模块"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from .rules_engine import CheckReport, CheckResult, CheckSeverity, CheckCategory
from .tile_index import TileIndexManager, TileInfo, ParcelInfo
from .log_parser import TerminalStatus


class PatchActionType(Enum):
    """修补操作类型"""
    ADD_TILE = "add_tile"
    UPDATE_PARCEL = "update_parcel"
    REMOVE_DUPLICATE_TASK = "remove_duplicate_task"
    ADD_ROLLBACK_PACKAGE = "add_rollback_package"
    SYNC_TERMINAL = "sync_terminal"
    RESOLVE_ERROR = "resolve_error"


class PatchPriority(Enum):
    """修补优先级"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class PatchAction:
    """单个修补操作"""
    action_id: str
    action_type: PatchActionType
    priority: PatchPriority
    target_terminal: Optional[str] = None
    description: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    affected_items: List[str] = field(default_factory=list)
    estimated_size_bytes: int = 0
    source_path: Optional[Path] = None
    target_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action_id": self.action_id,
            "action_type": self.action_type.value,
            "priority": self.priority.value,
            "target_terminal": self.target_terminal,
            "description": self.description,
            "details": self.details,
            "affected_items": self.affected_items,
            "estimated_size_bytes": self.estimated_size_bytes,
            "source_path": str(self.source_path) if self.source_path else None,
            "target_path": self.target_path
        }


@dataclass
class TerminalPatchPlan:
    """单个终端的修补计划"""
    terminal_id: str
    actions: List[PatchAction] = field(default_factory=list)
    estimated_total_size: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0

    def add_action(self, action: PatchAction) -> None:
        self.actions.append(action)
        self.estimated_total_size += action.estimated_size_bytes
        if action.priority == PatchPriority.CRITICAL:
            self.critical_count += 1
        elif action.priority == PatchPriority.HIGH:
            self.high_count += 1
        elif action.priority == PatchPriority.MEDIUM:
            self.medium_count += 1
        else:
            self.low_count += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "terminal_id": self.terminal_id,
            "actions": [a.to_dict() for a in self.actions],
            "estimated_total_size": self.estimated_total_size,
            "critical_count": self.critical_count,
            "high_count": self.high_count,
            "medium_count": self.medium_count,
            "low_count": self.low_count
        }


@dataclass
class PatchPlan:
    """完整修补计划"""
    plan_id: str
    generated_at: datetime
    description: str
    terminal_plans: Dict[str, TerminalPatchPlan] = field(default_factory=dict)
    global_actions: List[PatchAction] = field(default_factory=list)
    source_check_report: Optional[Dict[str, Any]] = None
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plan_id": self.plan_id,
            "generated_at": self.generated_at.isoformat(),
            "description": self.description,
            "terminal_plans": {tid: tp.to_dict() for tid, tp in self.terminal_plans.items()},
            "global_actions": [a.to_dict() for a in self.global_actions],
            "source_check_report": self.source_check_report,
            "summary": self.summary
        }


class PatchPlanner:
    """修补计划生成器"""

    def __init__(self, tile_manager: TileIndexManager, check_report: CheckReport):
        self.tile_manager = tile_manager
        self.check_report = check_report
        self.action_counter = 0

    def generate_plan(self, description: str = "自动生成的修补计划") -> PatchPlan:
        """生成完整修补计划"""
        plan_id = f"patch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        plan = PatchPlan(
            plan_id=plan_id,
            generated_at=datetime.now(),
            description=description,
            source_check_report=self.check_report.to_dict()
        )

        for result in self.check_report.results:
            if result.severity == CheckSeverity.INFO:
                continue
            
            actions = self._result_to_actions(result)
            for action in actions:
                if action.target_terminal:
                    if action.target_terminal not in plan.terminal_plans:
                        plan.terminal_plans[action.target_terminal] = TerminalPatchPlan(
                            terminal_id=action.target_terminal
                        )
                    plan.terminal_plans[action.target_terminal].add_action(action)
                else:
                    plan.global_actions.append(action)

        plan.summary = self._build_summary(plan)
        
        return plan

    def _result_to_actions(self, result: CheckResult) -> List[PatchAction]:
        """将检查结果转换为修补操作"""
        actions: List[PatchAction] = []
        
        priority = self._severity_to_priority(result.severity)
        
        if result.category == CheckCategory.TILE_COVERAGE:
            actions.extend(self._handle_tile_coverage(result, priority))
        
        elif result.category == CheckCategory.VERSION:
            actions.extend(self._handle_version(result, priority))
        
        elif result.category == CheckCategory.TASK:
            actions.extend(self._handle_task(result, priority))
        
        elif result.category == CheckCategory.TERMINAL:
            actions.extend(self._handle_terminal(result, priority))
        
        elif result.category == CheckCategory.ROLLBACK:
            actions.extend(self._handle_rollback(result, priority))
        
        return actions

    def _severity_to_priority(self, severity: CheckSeverity) -> PatchPriority:
        """将严重程度转换为优先级"""
        mapping = {
            CheckSeverity.CRITICAL: PatchPriority.CRITICAL,
            CheckSeverity.ERROR: PatchPriority.HIGH,
            CheckSeverity.WARNING: PatchPriority.MEDIUM,
            CheckSeverity.INFO: PatchPriority.LOW,
        }
        return mapping.get(severity, PatchPriority.MEDIUM)

    def _handle_tile_coverage(self, result: CheckResult, priority: PatchPriority) -> List[PatchAction]:
        """处理瓦片覆盖问题"""
        actions: List[PatchAction] = []
        
        details = result.details
        missing_tiles = details.get("missing_tile_sample", [])
        
        if not missing_tiles:
            return actions
        
        self.action_counter += 1
        action = PatchAction(
            action_id=f"tile_add_{self.action_counter:04d}",
            action_type=PatchActionType.ADD_TILE,
            priority=priority,
            target_terminal=result.affected_items[0] if result.affected_items and len(result.affected_items) == 1 else None,
            description=f"补充缺失瓦片: 地块 {details.get('parcel_name', 'unknown')}",
            details={
                "parcel_id": details.get("parcel_id"),
                "parcel_name": details.get("parcel_name"),
                "version": details.get("version"),
                "total_missing": details.get("missing_tiles", 0)
            },
            affected_items=result.affected_items,
            estimated_size_bytes=len(missing_tiles) * 50 * 1024  # 估计每个瓦片 50KB
        )
        actions.append(action)
        
        return actions

    def _handle_version(self, result: CheckResult, priority: PatchPriority) -> List[PatchAction]:
        """处理版本问题"""
        actions: List[PatchAction] = []
        
        details = result.details
        parcel_id = details.get("parcel_id")
        
        # 检查是否是终端版本过时
        if "terminal_id" in details:
            terminal_id = details["terminal_id"]
            latest_version = details.get("source_version")
            
            self.action_counter += 1
            action = PatchAction(
                action_id=f"parcel_update_{self.action_counter:04d}",
                action_type=PatchActionType.UPDATE_PARCEL,
                priority=priority,
                target_terminal=terminal_id,
                description=f"更新地块版本: {parcel_id} -> {latest_version}",
                details={
                    "parcel_id": parcel_id,
                    "current_version": details.get("terminal_version"),
                    "target_version": latest_version
                },
                affected_items=[terminal_id],
                estimated_size_bytes=100 * 1024  # 估计 GeoJSON 100KB
            )
            actions.append(action)
        else:
            # 多个版本共存的情况
            self.action_counter += 1
            action = PatchAction(
                action_id=f"parcel_version_check_{self.action_counter:04d}",
                action_type=PatchActionType.SYNC_TERMINAL,
                priority=priority,
                description=f"确认地块版本一致性: {parcel_id}",
                details={
                    "parcel_id": parcel_id,
                    "latest_version": details.get("latest_version"),
                    "all_versions": details.get("all_versions", [])
                },
                affected_items=result.affected_items
            )
            actions.append(action)
        
        return actions

    def _handle_task(self, result: CheckResult, priority: PatchPriority) -> List[PatchAction]:
        """处理任务问题"""
        actions: List[PatchAction] = []
        
        details = result.details
        
        if "receive_count" in details:
            # 重复任务
            terminal_id = details.get("terminal_id")
            task_id = details.get("task_id")
            
            self.action_counter += 1
            action = PatchAction(
                action_id=f"task_dedup_{self.action_counter:04d}",
                action_type=PatchActionType.REMOVE_DUPLICATE_TASK,
                priority=priority,
                target_terminal=terminal_id,
                description=f"移除重复任务: {task_id}",
                details={
                    "task_id": task_id,
                    "receive_count": details.get("receive_count")
                },
                affected_items=[terminal_id] if terminal_id else result.affected_items
            )
            actions.append(action)
        
        elif "missing_parcels" in details:
            # 任务引用不存在的地块
            task_id = details.get("task_id")
            task_name = details.get("task_name")
            
            self.action_counter += 1
            action = PatchAction(
                action_id=f"task_fix_{self.action_counter:04d}",
                action_type=PatchActionType.RESOLVE_ERROR,
                priority=PatchPriority.CRITICAL,
                description=f"修复任务引用问题: {task_name}",
                details={
                    "task_id": task_id,
                    "task_name": task_name,
                    "missing_parcels": details.get("missing_parcels", [])
                },
                affected_items=result.affected_items
            )
            actions.append(action)
        
        return actions

    def _handle_terminal(self, result: CheckResult, priority: PatchPriority) -> List[PatchAction]:
        """处理终端状态问题"""
        actions: List[PatchAction] = []
        
        details = result.details
        terminal_id = details.get("terminal_id")
        
        if "error_count" in details:
            # 终端有错误
            self.action_counter += 1
            action = PatchAction(
                action_id=f"terminal_error_{self.action_counter:04d}",
                action_type=PatchActionType.RESOLVE_ERROR,
                priority=priority,
                target_terminal=terminal_id,
                description=f"排查终端错误: {details.get('error_count', 0)} 个错误",
                details={
                    "error_count": details.get("error_count"),
                    "errors": details.get("errors", [])
                },
                affected_items=[terminal_id] if terminal_id else result.affected_items
            )
            actions.append(action)
        
        elif "missing_tiles_count" in details:
            # 终端报告缺失瓦片
            self.action_counter += 1
            action = PatchAction(
                action_id=f"terminal_tiles_{self.action_counter:04d}",
                action_type=PatchActionType.ADD_TILE,
                priority=priority,
                target_terminal=terminal_id,
                description=f"补充终端缺失瓦片",
                details={
                    "missing_count": details.get("missing_tiles_count"),
                    "sample_tiles": details.get("missing_tiles_sample", [])
                },
                affected_items=result.affected_items
            )
            actions.append(action)
        
        elif "failed_tasks" in details:
            # 终端有失败任务
            self.action_counter += 1
            action = PatchAction(
                action_id=f"terminal_tasks_{self.action_counter:04d}",
                action_type=PatchActionType.RESOLVE_ERROR,
                priority=priority,
                target_terminal=terminal_id,
                description=f"处理失败任务",
                details={
                    "failed_tasks": details.get("failed_tasks", [])
                },
                affected_items=result.affected_items
            )
            actions.append(action)
        
        elif result.title and "离线" in result.title:
            # 终端离线
            self.action_counter += 1
            action = PatchAction(
                action_id=f"terminal_offline_{self.action_counter:04d}",
                action_type=PatchActionType.SYNC_TERMINAL,
                priority=PatchPriority.MEDIUM,
                target_terminal=terminal_id,
                description=f"检查终端连接状态",
                details={
                    "last_seen": details.get("last_seen")
                },
                affected_items=[terminal_id] if terminal_id else result.affected_items
            )
            actions.append(action)
        
        return actions

    def _handle_rollback(self, result: CheckResult, priority: PatchPriority) -> List[PatchAction]:
        """处理回滚问题"""
        actions: List[PatchAction] = []
        
        details = result.details
        
        if "package_count" not in details:
            # 没有回滚包
            self.action_counter += 1
            action = PatchAction(
                action_id=f"rollback_create_{self.action_counter:04d}",
                action_type=PatchActionType.ADD_ROLLBACK_PACKAGE,
                priority=priority,
                description="创建必要的回滚包",
                details={
                    "message": "当前目录中没有发现回滚包"
                },
                affected_items=result.affected_items
            )
            actions.append(action)
        
        elif "has_rollback_capability" in result.message or "回滚能力" in result.title:
            # 终端回滚能力未知
            terminal_id = details.get("terminal_id")
            self.action_counter += 1
            action = PatchAction(
                action_id=f"rollback_check_{self.action_counter:04d}",
                action_type=PatchActionType.SYNC_TERMINAL,
                priority=priority,
                target_terminal=terminal_id,
                description=f"确认终端回滚能力",
                details={
                    "terminal_id": terminal_id
                },
                affected_items=[terminal_id] if terminal_id else result.affected_items
            )
            actions.append(action)
        
        return actions

    def _build_summary(self, plan: PatchPlan) -> Dict[str, Any]:
        """构建计划摘要"""
        summary = {
            "total_terminals": len(plan.terminal_plans),
            "total_actions": 0,
            "by_priority": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0
            },
            "by_type": {},
            "estimated_total_size": 0,
            "terminals": []
        }

        type_counts: Dict[str, int] = {}

        for terminal_id, tp in plan.terminal_plans.items():
            summary["total_actions"] += len(tp.actions)
            summary["by_priority"]["critical"] += tp.critical_count
            summary["by_priority"]["high"] += tp.high_count
            summary["by_priority"]["medium"] += tp.medium_count
            summary["by_priority"]["low"] += tp.low_count
            summary["estimated_total_size"] += tp.estimated_total_size

            for action in tp.actions:
                action_type = action.action_type.value
                type_counts[action_type] = type_counts.get(action_type, 0) + 1

            summary["terminals"].append({
                "terminal_id": terminal_id,
                "action_count": len(tp.actions),
                "critical": tp.critical_count,
                "high": tp.high_count,
                "medium": tp.medium_count,
                "low": tp.low_count,
                "estimated_size": tp.estimated_total_size
            })

        for action in plan.global_actions:
            summary["total_actions"] += 1
            action_type = action.action_type.value
            type_counts[action_type] = type_counts.get(action_type, 0) + 1
            
            if action.priority == PatchPriority.CRITICAL:
                summary["by_priority"]["critical"] += 1
            elif action.priority == PatchPriority.HIGH:
                summary["by_priority"]["high"] += 1
            elif action.priority == PatchPriority.MEDIUM:
                summary["by_priority"]["medium"] += 1
            else:
                summary["by_priority"]["low"] += 1

        summary["by_type"] = type_counts

        return summary
