from datetime import datetime
from typing import List, Dict, Any, Optional
import os

from models import PreflightCheck, PreflightStatus, PaperStock


class PaperChecker:
    def __init__(self, paper_stocks: List[PaperStock] = None):
        self.paper_stocks = paper_stocks or []
    
    def check_paper(self, work_order) -> PreflightCheck:
        check_name = "Paper Inventory Check"
        check_type = "paper"
        
        paper_type = getattr(work_order, 'paper_type', None)
        paper_width = getattr(work_order, 'paper_width', None)
        paper_height = getattr(work_order, 'paper_height', None)
        quantity = getattr(work_order, 'quantity', 0)
        
        if not paper_type:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.WARNING,
                message="未指定纸张类型，无法进行纸张检查",
                details={"note": "工单中未指定纸张类型"},
                severity="normal"
            )
        
        matching_stocks = self._find_matching_stocks(
            paper_type, paper_width, paper_height
        )
        
        if not matching_stocks:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.FAILED,
                message=f"未找到匹配的纸张库存: {paper_type}",
                details={
                    "required_paper": paper_type,
                    "required_width": paper_width,
                    "required_height": paper_height,
                    "available_stocks": [s.paper_type for s in self.paper_stocks]
                },
                severity="critical"
            )
        
        total_available = sum(s.quantity for s in matching_stocks)
        required_quantity = quantity if quantity else 1
        
        if total_available < required_quantity:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.FAILED,
                message=f"纸张库存不足: 需要 {required_quantity} 张，可用 {total_available} 张",
                details={
                    "required_paper": paper_type,
                    "required_quantity": required_quantity,
                    "available_quantity": total_available,
                    "deficit": required_quantity - total_available,
                    "matching_stocks": [
                        {"id": s.id, "quantity": s.quantity, "location": s.location}
                        for s in matching_stocks
                    ]
                },
                severity="high"
            )
        
        any_low_stock = any(s.is_low for s in matching_stocks)
        
        if any_low_stock:
            return PreflightCheck(
                check_name=check_name,
                check_type=check_type,
                status=PreflightStatus.WARNING,
                message=f"纸张库存满足需求，但部分库存已低于警戒线",
                details={
                    "required_paper": paper_type,
                    "required_quantity": required_quantity,
                    "available_quantity": total_available,
                    "low_stock_warning": True,
                    "low_stocks": [
                        {"id": s.id, "quantity": s.quantity, "threshold": s.minimum_threshold}
                        for s in matching_stocks if s.is_low
                    ]
                },
                severity="normal"
            )
        
        return PreflightCheck(
            check_name=check_name,
            check_type=check_type,
            status=PreflightStatus.PASSED,
            message=f"纸张库存充足: 可用 {total_available} 张",
            details={
                "required_paper": paper_type,
                "required_quantity": required_quantity,
                "available_quantity": total_available,
                "matching_stocks": [
                    {"id": s.id, "quantity": s.quantity}
                    for s in matching_stocks
                ]
            },
            severity="normal"
        )
    
    def _find_matching_stocks(
        self,
        paper_type: str,
        paper_width: Optional[float] = None,
        paper_height: Optional[float] = None
    ) -> List[PaperStock]:
        matching = []
        
        for stock in self.paper_stocks:
            type_match = stock.paper_type.lower() == paper_type.lower()
            
            if not type_match:
                continue
            
            if paper_width is not None and paper_height is not None:
                if stock.paper_width is None or stock.paper_height is None:
                    continue
                
                tolerance = 0.1
                size_match = (
                    (abs(stock.paper_width - paper_width) < tolerance and 
                     abs(stock.paper_height - paper_height) < tolerance) or
                    (abs(stock.paper_width - paper_height) < tolerance and 
                     abs(stock.paper_height - paper_width) < tolerance)
                )
                
                if not size_match:
                    continue
            
            matching.append(stock)
        
        return matching
