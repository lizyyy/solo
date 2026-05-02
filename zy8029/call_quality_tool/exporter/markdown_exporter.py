from typing import List, Dict, Any


class MarkdownExporter:
    @staticmethod
    def export(results: List[Dict[str, Any]], agent_stats: List[Dict[str, Any]], output_path: str):
        md_lines = []
        md_lines.append('# 客服录音质检报告')
        md_lines.append('')
        md_lines.append('## 概览')
        md_lines.append(f"- 通话总数: {len(results)}")
        md_lines.append(f"- 坐席总数: {len(agent_stats)}")
        
        total_violations = sum(r['violation_count'] for r in results)
        md_lines.append(f"- 违规总数: {total_violations}")
        md_lines.append('')
        
        md_lines.append('## 坐席表现')
        md_lines.append('')
        md_lines.append('| 坐席ID | 坐席姓名 | 通话数 | 违规数 | 平均违规数/通话 | 平均通话时长(秒) |')
        md_lines.append('| --- | --- | --- | --- | --- | --- |')
        
        for agent in sorted(agent_stats, key=lambda x: x['total_violations'], reverse=True):
            md_lines.append(f"| {agent['agent_id']} | {agent['agent_name']} | {agent['call_count']} | {agent['total_violations']} | {agent['avg_violations_per_call']:.2f} | {agent['avg_call_duration']:.1f} |")
        
        md_lines.append('')
        md_lines.append('## 违规详情')
        md_lines.append('')
        
        for result in results:
            if result['violations']:
                md_lines.append(f"### 通话 {result['call_id']}")
                md_lines.append(f"- 坐席: {result['agent_name']} ({result['agent_id']})")
                md_lines.append(f"- 通话时长: {result['call_duration']:.1f}秒")
                md_lines.append(f"- 违规数: {result['violation_count']}")
                md_lines.append('')
                md_lines.append('| 类型 | 描述 | 时间戳 |')
                md_lines.append('| --- | --- | --- |')
                
                for violation in result['violations']:
                    md_lines.append(f"| {violation['type']} | {violation['description']} | {violation['timestamp']:.1f} |")
                md_lines.append('')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(md_lines))