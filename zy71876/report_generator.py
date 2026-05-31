from typing import Dict, List
from models import Workspace, RecordStatus, AllocationRecord, Constraint
from allocation_engine import AllocationEngine


class ReportGenerator:
    def __init__(self, workspace: Workspace, engine: AllocationEngine):
        self.workspace = workspace
        self.engine = engine

    def generate_model_description(self, output_path: str) -> str:
        sections = []
        
        sections.append("=" * 60)
        sections.append("救援物资分配模型说明")
        sections.append("=" * 60)
        sections.append("")
        
        sections.append("【一、处理口径说明】")
        sections.append("-" * 40)
        sections.append(self._get_processing_policy())
        sections.append("")
        
        sections.append("【二、约束规则应用情况】")
        sections.append("-" * 40)
        sections.append(self._get_constraint_coverage())
        sections.append("")
        
        sections.append("【三、分配记录分类统计】")
        sections.append("-" * 40)
        sections.append(self._get_status_summary())
        sections.append("")
        
        sections.append("【四、已确认分配记录】")
        sections.append("-" * 40)
        sections.append(self._get_records_by_status(RecordStatus.CONFIRMED))
        sections.append("")
        
        sections.append("【五、待补充分配记录】")
        sections.append("-" * 40)
        sections.append(self._get_records_by_status(RecordStatus.PENDING))
        sections.append("")
        
        sections.append("【六、人工修改记录】")
        sections.append("-" * 40)
        sections.append(self._get_records_by_status(RecordStatus.MANUAL_MODIFIED))
        sections.append("")
        
        sections.append("【七、复核检查清单】")
        sections.append("-" * 40)
        sections.append(self._get_review_checklist())
        
        content = "\n".join(sections)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return content

    def _get_processing_policy(self) -> str:
        lines = [
            "1. 优先级原则：按需求点优先级从高到低分配",
            "2. 人口权重：考虑需求点覆盖人口作为分配系数",
            "3. 库存限制：单次分配不超过当前可用库存",
            "4. 自动判断：每条分配记录均记录判断理由和下一步建议",
            "5. 人工调整：人工修改记录标记并保留原始数据",
            "6. 口径一致：导入/导出/筛选使用统一字段定义"
        ]
        return "\n".join(lines)

    def _get_constraint_coverage(self) -> str:
        coverage = self.engine.get_constraint_coverage()
        lines = []
        
        for c_id, is_covered in coverage.items():
            c = self.workspace.constraints.get(c_id)
            if c:
                status = "✓ 已覆盖" if is_covered else "✗ 未覆盖"
                lines.append(f"[{status}] {c.name}：{c.description}")
        
        if not lines:
            lines.append("（无约束规则）")
        
        return "\n".join(lines)

    def _get_status_summary(self) -> str:
        counts = self._count_by_status()
        total = sum(counts.values())
        
        lines = [
            f"总记录数：{total}",
            f"已确认：{counts.get(RecordStatus.CONFIRMED, 0)}",
            f"待补充：{counts.get(RecordStatus.PENDING, 0)}",
            f"人工修改：{counts.get(RecordStatus.MANUAL_MODIFIED, 0)}"
        ]
        return "\n".join(lines)

    def _count_by_status(self) -> Dict[RecordStatus, int]:
        counts = {}
        for alloc in self.workspace.allocations.values():
            counts[alloc.status] = counts.get(alloc.status, 0) + 1
        return counts

    def _get_records_by_status(self, status: RecordStatus) -> str:
        records = [
            alloc for alloc in self.workspace.allocations.values()
            if alloc.status == status
        ]
        
        if not records:
            return "（无）"
        
        lines = []
        for r in records:
            lines.append(
                f"记录ID：{r.id} | {r.material_name} -> {r.demand_point_name} | "
                f"数量：{r.allocated_quantity}{r.unit}"
            )
            lines.append(f"  判断理由：{r.judgment_reason}")
            lines.append(f"  下一步：{r.next_step}")
            lines.append("")
        
        return "\n".join(lines)

    def _get_review_checklist(self) -> str:
        lines = [
            "□ 约束规则是否全部覆盖",
            "□ 待补充记录是否有合理理由",
            "□ 人工修改记录是否都有修改说明",
            "□ 分配总量是否不超过库存总量",
            "□ 高优先级需求点是否已满足",
            "□ 导出前是否已保存最新工作区"
        ]
        return "\n".join(lines)

    def check_constraint_coverage(self) -> Dict[str, List[Constraint]]:
        coverage = self.engine.get_constraint_coverage()
        
        covered = []
        uncovered = []
        
        for c_id, is_covered in coverage.items():
            c = self.workspace.constraints.get(c_id)
            if c:
                if is_covered:
                    covered.append(c)
                else:
                    uncovered.append(c)
        
        return {'covered': covered, 'uncovered': uncovered}
