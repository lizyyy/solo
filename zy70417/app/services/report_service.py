from typing import Dict, Any, List
from datetime import datetime
from app.models.models import Batch, CheckResult, EdgeNode
from io import StringIO


class ReportService:
    def generate_json_report(self, batch: Batch) -> Dict[str, Any]:
        blocked_results = [r for r in batch.results if r.is_blocked]
        blocked_details = []

        for result in blocked_results:
            node = next((n for n in batch.nodes if n.id == result.node_id), None)
            if node:
                blocked_details.append({
                    'node_id': node.node_id,
                    'node_name': node.node_name,
                    'rule_code': result.rule_code,
                    'rule_name': result.rule_name,
                    'risk_type': result.risk_type,
                    'block_reason': result.block_reason,
                    'details': result.details
                })

        return {
            'batch_no': batch.batch_no,
            'operator': batch.operator,
            'total_count': batch.total_count,
            'risk_count': batch.risk_count,
            'blocked_details': blocked_details,
            'rule_snapshot': batch.rule_version_snapshot,
            'generated_at': datetime.now().isoformat()
        }

    def generate_markdown_report(self, batch: Batch) -> str:
        blocked_results = [r for r in batch.results if r.is_blocked]

        md = StringIO()
        md.write(f"# 并发冲突检测报告 - {batch.batch_no}\n\n")
        md.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        md.write(f"**操作者**: {batch.operator}\n\n")
        md.write(f"**总节点数**: {batch.total_count}\n\n")
        md.write(f"**风险节点数**: {batch.risk_count}\n\n")

        md.write("---\n\n")
        md.write("## 拦截详情\n\n")

        if not blocked_results:
            md.write("> ✅ 无节点被拦截，所有节点通过检测\n\n")
        else:
            for idx, result in enumerate(blocked_results, 1):
                node = next((n for n in batch.nodes if n.id == result.node_id), None)
                if node:
                    md.write(f"### {idx}. 节点: {node.node_name} ({node.node_id})\n\n")
                    md.write(f"- **拦截规则**: [{result.rule_code}] {result.rule_name}\n")
                    md.write(f"- **风险类型**: {result.risk_type}\n")
                    md.write(f"- **拦截原因**: {result.block_reason}\n\n")

                    md.write("#### 规则评估明细\n\n")
                    if result.details and 'evaluations' in result.details:
                        for eval_item in result.details['evaluations']:
                            status = "❌ 触发" if eval_item.get('evaluation_result') else "✅ 通过"
                            md.write(f"- {status} `{eval_item.get('field')}` {eval_item.get('operator')} `{eval_item.get('expected_value')}`\n")
                            md.write(f"  - 实际值: `{eval_item.get('actual_value')}`\n\n")

        md.write("---\n\n")
        md.write("## 规则版本快照\n\n")

        if batch.rule_version_snapshot and 'rules' in batch.rule_version_snapshot:
            for rule in batch.rule_version_snapshot['rules']:
                md.write(f"- [{rule['code']}] {rule['name']} (v{rule['version']})\n")
                md.write(f"  - {rule['description']}\n\n")

        return md.getvalue()

    def generate_download_content(self, batch: Batch, format: str = 'json'):
        if format == 'markdown':
            return self.generate_markdown_report(batch), 'text/markdown', f'{batch.batch_no}_report.md'
        else:
            import json
            return json.dumps(self.generate_json_report(batch), ensure_ascii=False, indent=2), 'application/json', f'{batch.batch_no}_report.json'


report_service = ReportService()
