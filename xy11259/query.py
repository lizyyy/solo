from typing import List, Dict, Any
from tabulate import tabulate
from models import HiddenDanger

class QueryEngine:
    def __init__(self, db):
        self.db = db
    
    def query_hazards(self, **filters) -> List[HiddenDanger]:
        return self.db.query_hazards(**filters)
    
    def get_summary(self) -> Dict[str, Any]:
        return self.db.get_stats()
    
    def format_results(self, hazards: List[HiddenDanger]) -> str:
        if not hazards:
            return "无数据"
        
        headers = ['编号', '隐患描述', '位置', '责任人', '状态', '异常类型', '发现日期']
        rows = []
        
        for h in hazards:
            desc = h.description[:30] + '...' if len(h.description) > 30 else h.description
            rows.append([
                h.hazard_id,
                desc,
                h.location or '-',
                h.person_in_charge or '-',
                h.status or '-',
                h.exception_type or '-',
                h.discovered_date or '-'
            ])
        
        return tabulate(rows, headers=headers, tablefmt='simple')
