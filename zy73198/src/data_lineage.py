"""数据溯源系统 - 坏数据可追溯到原始对象"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from .parameter_manager import ParameterManager
from .chart_explainer import ChartExplanation, BoundaryIssue


@dataclass
class LineageNode:
    """溯源节点 - 记录数据的每一次流转"""
    node_id: str
    node_type: str
    name: str
    value: Any
    version_id: str
    version_name: str
    source_type: str
    source_id: str
    source_name: str
    raw_data: Dict[str, Any]
    created_at: datetime
    created_by: str
    parent_node_ids: List[str] = field(default_factory=list)
    transformation: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "node_type": self.node_type,
            "name": self.name,
            "value": self.value,
            "version_id": self.version_id,
            "version_name": self.version_name,
            "source_type": self.source_type,
            "source_id": self.source_id,
            "source_name": self.source_name,
            "raw_data": self.raw_data,
            "created_at": self.created_at.isoformat(),
            "created_by": self.created_by,
            "parent_node_ids": self.parent_node_ids,
            "transformation": self.transformation,
        }


@dataclass
class DataIssueReport:
    """数据问题报告 - 用于坏数据追溯"""
    report_id: str
    issue_type: str
    severity: str
    param_name: str
    current_value: Any
    description: str
    lineage: List[LineageNode]
    first_occurrence: Optional[LineageNode]
    suggestions: List[str]
    generated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "issue_type": self.issue_type,
            "severity": self.severity,
            "param_name": self.param_name,
            "current_value": self.current_value,
            "description": self.description,
            "lineage": [n.to_dict() for n in self.lineage],
            "first_occurrence": self.first_occurrence.to_dict() if self.first_occurrence else None,
            "suggestions": self.suggestions,
            "generated_at": self.generated_at.isoformat(),
        }


class DataLineageTracker:
    """数据溯源追踪器"""
    
    def __init__(self, parameter_manager: ParameterManager):
        self.parameter_manager = parameter_manager
        self._nodes: Dict[str, LineageNode] = {}
    
    def build_lineage_for_param(self, param_name: str) -> List[LineageNode]:
        """为参数构建完整的溯源链"""
        history = self.parameter_manager.trace_parameter_origin(param_name)
        lineage: List[LineageNode] = []
        
        for i, entry in enumerate(history):
            node = LineageNode(
                node_id=str(uuid4()),
                node_type="parameter",
                name=param_name,
                value=entry["value"],
                version_id=entry["version_id"],
                version_name=entry["version_name"],
                source_type=entry["source_type"],
                source_id=entry["source_id"],
                source_name=entry["source_name"],
                raw_data=entry["raw_data"],
                created_at=datetime.fromisoformat(entry["created_at"]),
                created_by=entry["created_by"],
                parent_node_ids=[lineage[-1].node_id] if i > 0 else [],
                transformation=f"从版本 {history[i-1]['version_name']} 变更而来" if i > 0 else "首次导入",
            )
            self._nodes[node.node_id] = node
            lineage.append(node)
        
        return lineage
    
    def build_lineage_for_explanation(self, explanation: ChartExplanation) -> Dict[str, List[LineageNode]]:
        """为解释中的所有计算步骤构建溯源链"""
        lineages = {}
        
        for param_name in explanation.parameter_changes:
            if isinstance(param_name, dict):
                pn = param_name.get("param_name")
                if pn:
                    lineages[pn] = self.build_lineage_for_param(pn)
        
        for step in explanation.calculation_steps:
            for input_name in step.inputs:
                if input_name not in lineages:
                    history = self.parameter_manager.trace_parameter_origin(input_name)
                    if history:
                        lineages[input_name] = self.build_lineage_for_param(input_name)
        
        return lineages
    
    def investigate_issue(
        self,
        issue: BoundaryIssue,
    ) -> DataIssueReport:
        """
        调查一个边界问题，生成完整的追溯报告
        坏数据影响结果时，接手的人能顺着提示回到参数表的原始对象
        """
        if not issue.param_name:
            return DataIssueReport(
                report_id=str(uuid4()),
                issue_type=issue.issue_type,
                severity=issue.severity,
                param_name="未知",
                current_value=issue.param_value,
                description=issue.message,
                lineage=[],
                first_occurrence=None,
                suggestions=[issue.suggestion],
            )
        
        lineage = self.build_lineage_for_param(issue.param_name)
        
        first_occurrence = lineage[0] if lineage else None
        
        suggestions = [issue.suggestion]
        if lineage:
            suggestions.extend([
                f"查看 {first_occurrence.source_name} (ID: {first_occurrence.source_id}) 中的原始数据",
                f"联系首次录入人 {first_occurrence.created_by} 确认数据准确性",
                f"检查版本时间线中第 {len(lineage)} 次变更是否引入问题",
            ])
        
        return DataIssueReport(
            report_id=str(uuid4()),
            issue_type=issue.issue_type,
            severity=issue.severity,
            param_name=issue.param_name,
            current_value=issue.param_value,
            description=issue.message,
            lineage=lineage,
            first_occurrence=first_occurrence,
            suggestions=suggestions,
        )
    
    def get_lineage_graph(self, param_name: str) -> Dict[str, Any]:
        """获取溯源图数据，用于可视化"""
        lineage = self.build_lineage_for_param(param_name)
        
        nodes = []
        edges = []
        
        for node in lineage:
            nodes.append({
                "id": node.node_id,
                "label": f"{node.name} = {node.value}",
                "version": node.version_name,
                "source": node.source_name,
                "created_at": node.created_at.strftime("%Y-%m-%d %H:%M"),
                "created_by": node.created_by,
            })
            
            for parent_id in node.parent_node_ids:
                edges.append({
                    "from": parent_id,
                    "to": node.node_id,
                    "label": node.transformation,
                })
        
        return {
            "param_name": param_name,
            "nodes": nodes,
            "edges": edges,
            "total_versions": len(lineage),
        }
    
    def export_lineage_to_json(self, param_name: str, filepath: str) -> None:
        """导出溯源链为JSON文件"""
        lineage = self.build_lineage_for_param(param_name)
        data = {
            "param_name": param_name,
            "lineage": [n.to_dict() for n in lineage],
            "exported_at": datetime.now().isoformat(),
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
