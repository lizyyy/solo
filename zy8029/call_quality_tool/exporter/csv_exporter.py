import csv
from typing import List, Dict, Any


class CSVExporter:
    @staticmethod
    def export(results: List[Dict[str, Any]], output_path: str):
        all_violations = []
        
        for result in results:
            for violation in result['violations']:
                all_violations.append({
                    'call_id': result['call_id'],
                    'agent_id': result['agent_id'],
                    'agent_name': result['agent_name'],
                    'call_duration': result['call_duration'],
                    **violation
                })
        
        if not all_violations:
            with open(output_path, 'w', encoding='utf-8-sig') as f:
                f.write('无违规记录')
            return
        
        headers = ['call_id', 'agent_id', 'agent_name', 'call_duration', 'type', 'description', 'timestamp']
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(all_violations)