import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from tree_patrol.models import (
    TreeStatus,
    TreeRecord,
    TreeAssessment,
    ReviewRecord
)
from tree_patrol.query import QueryInterface


class Exporter:
    def __init__(self, query_interface: QueryInterface = None):
        self.query = query_interface or QueryInterface()

    def export_markdown_handover(
        self,
        output_path: str = None,
        assessment_date: datetime = None
    ) -> str:
        if assessment_date is None:
            assessment_date = datetime.now()
        
        date_str = assessment_date.strftime("%Y-%m-%d")
        
        summary = self.query.get_daily_summary(assessment_date)
        all_assessments = self.query.get_all_assessments(assessment_date)
        high_risk = self.query.get_trees_with_high_risk(assessment_date)
        
        trees_by_status = {}
        for assessment in all_assessments:
            status = assessment.status.value
            if status not in trees_by_status:
                trees_by_status[status] = []
            tree = self.query.get_tree_by_id(assessment.tree_id)
            trees_by_status[status].append({
                'tree': tree,
                'assessment': assessment
            })
        
        markdown = f"""# 古树巡护放行交接单

**生成日期**: {date_str}
**生成时间**: {datetime.now().strftime("%H:%M:%S")}

---

## 今日概览

| 统计项 | 数量 |
|--------|------|
| 古树总数 | {summary['assessment_summary']['total_trees']} |
| 可开放 | {summary['assessment_summary']['status_counts'].get('开放', 0)} |
| 需复查 | {summary['assessment_summary']['status_counts'].get('需复查', 0)} |
| 需加固 | {summary['assessment_summary']['status_counts'].get('需加固', 0)} |
| 需封闭 | {summary['assessment_summary']['status_counts'].get('封闭', 0)} |
| 历史复核记录 | {summary['review_statistics']['total_reviews']} |

---

## 高风险古树（需立即处理）

"""
        
        if high_risk:
            for item in high_risk:
                tree = item['tree']
                assessment = item['assessment']
                markdown += f"""### {tree.name} ({tree.id})

- **位置**: {tree.location}
- **树龄**: {tree.age}年
- **树种**: {tree.species}
- **当前状态**: **{assessment.status.value}**

**评估原因**:
"""
                for reason in assessment.reasons:
                    markdown += f"- {reason}\n"
                
                markdown += "\n"
        else:
            markdown += "今日无高风险古树。\n\n"
        
        markdown += "---\n\n"
        
        status_order = ['开放', '需复查', '需加固', '封闭']
        for status in status_order:
            if status in trees_by_status:
                trees = trees_by_status[status]
                markdown += f"## {status}的古树\n\n"
                markdown += "| 编号 | 名称 | 位置 | 树龄 | 评估原因 |\n"
                markdown += "|------|------|------|------|----------|\n"
                
                for item in trees:
                    tree = item['tree']
                    assessment = item['assessment']
                    reasons = "；".join(assessment.reasons[:2])
                    if len(assessment.reasons) > 2:
                        reasons += "..."
                    
                    markdown += f"| {tree.id} | {tree.name} | {tree.location} | {tree.age}年 | {reasons} |\n"
                
                markdown += "\n"
        
        markdown += """---

## 交接说明

1. **高风险古树**: 请优先处理标记为"需加固"和"封闭"的古树
2. **需复查古树**: 请安排巡护员在今日内完成复查
3. **天气预警**: 请关注今日天气预警信息，做好防护准备
4. **复核记录**: 所有人工复核结果已保存至数据库

---

**交接人**: _______________
**交接时间**: _______________

**接交人**: _______________
**接交时间**: _______________
"""
        
        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(markdown)
        
        return markdown

    def export_json_details(
        self,
        output_path: str = None,
        tree_id: str = None,
        assessment_date: datetime = None
    ) -> Dict[str, Any]:
        result = {
            'exported_at': datetime.now().isoformat(),
            'assessment_date': assessment_date.isoformat() if assessment_date else None,
            'data': {}
        }
        
        if tree_id:
            detail = self.query.get_tree_detail(tree_id, assessment_date)
            if detail:
                result['data'] = {
                    'tree': self._model_to_dict(detail['tree']),
                    'assessment': self._model_to_dict(detail['assessment']) if detail['assessment'] else None,
                    'patrols': [self._model_to_dict(p) for p in detail['patrols']],
                    'complaints': [self._model_to_dict(c) for c in detail['complaints']],
                    'pruning_orders': [self._model_to_dict(po) for po in detail['pruning_orders']],
                    'alerts': [self._model_to_dict(a) for a in detail['alerts']],
                    'review_history': [self._model_to_dict(r) for r in detail['review_history']]
                }
        else:
            data = self.query._load_data()
            assessments = self.query.get_all_assessments(assessment_date)
            
            result['data'] = {
                'trees': [self._model_to_dict(t) for t in data['trees']],
                'assessments': [self._model_to_dict(a) for a in assessments],
                'patrols': [self._model_to_dict(p) for p in data['patrols']],
                'complaints': [self._model_to_dict(c) for c in data['complaints']],
                'pruning_orders': [self._model_to_dict(po) for po in data['pruning_orders']],
                'alerts': [self._model_to_dict(a) for a in data['alerts']]
            }
        
        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2, default=str)
        
        return result

    def export_review_history(
        self,
        output_path: str = None,
        tree_id: str = None
    ) -> Dict[str, Any]:
        result = {
            'exported_at': datetime.now().isoformat(),
            'review_records': []
        }
        
        if tree_id:
            reviews = self.query.get_review_history(tree_id)
        else:
            reviews = self.query.db_manager.get_all_reviews()
        
        result['review_records'] = [self._model_to_dict(r) for r in reviews]
        
        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2, default=str)
        
        return result

    def _model_to_dict(self, model) -> Dict[str, Any]:
        if hasattr(model, 'model_dump'):
            data = model.model_dump()
            for key, value in data.items():
                if isinstance(value, datetime):
                    data[key] = value.isoformat()
                elif isinstance(value, TreeStatus):
                    data[key] = value.value
            return data
        elif hasattr(model, '__dict__'):
            data = dict(model.__dict__)
            for key, value in data.items():
                if isinstance(value, datetime):
                    data[key] = value.isoformat()
                elif isinstance(value, TreeStatus):
                    data[key] = value.value
            return data
        else:
            return str(model)
