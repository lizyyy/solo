from datetime import date, timedelta
from typing import List, Dict, Tuple
from collections import defaultdict
from models import MedicineBatch, ExpiryLevel, FreezeStatus, TransferSuggestion, AnalysisResult


class BatchAnalyzer:
    def __init__(self, near_expiry_days: int = 90, critical_expiry_days: int = 30):
        self.near_expiry_days = near_expiry_days
        self.critical_expiry_days = critical_expiry_days
        self.today = date.today()
    
    def analyze(self, batches: List[MedicineBatch], input_file: str) -> AnalysisResult:
        valid_batches = []
        invalid_batches = []
        
        for batch in batches:
            if batch.quantity <= 0:
                invalid_batches.append(batch)
            else:
                valid_batches.append(batch)
        
        for batch in valid_batches:
            self._calculate_expiry_info(batch)
        
        normal_count = sum(1 for b in valid_batches if b.expiry_level == ExpiryLevel.NORMAL)
        near_expiry_count = sum(1 for b in valid_batches if b.expiry_level == ExpiryLevel.NEAR_EXPIRY)
        expired_count = sum(1 for b in valid_batches if b.expiry_level == ExpiryLevel.EXPIRED)
        critical_count = sum(1 for b in valid_batches if b.expiry_level == ExpiryLevel.CRITICAL)
        
        frozen_count = sum(1 for b in valid_batches if b.freeze_status == FreezeStatus.FROZEN)
        pending_freeze_count = sum(1 for b in valid_batches if b.freeze_status == FreezeStatus.PENDING)
        
        problem_batches = self._identify_problem_batches(valid_batches)
        
        transfer_suggestions = self._generate_transfer_suggestions(valid_batches)
        
        return AnalysisResult(
            total_batches=len(batches),
            valid_batches=len(valid_batches),
            invalid_batches=len(invalid_batches),
            normal_count=normal_count,
            near_expiry_count=near_expiry_count,
            expired_count=expired_count,
            critical_count=critical_count,
            frozen_count=frozen_count,
            pending_freeze_count=pending_freeze_count,
            transfer_suggestions=transfer_suggestions,
            problem_batches=problem_batches,
            all_batches=valid_batches + invalid_batches,
            report_generated_at=self.today,
            input_file=input_file
        )
    
    def _calculate_expiry_info(self, batch: MedicineBatch) -> None:
        delta = batch.expiry_date - self.today
        days = delta.days
        batch.expiry_days = days
        
        if days < 0:
            batch.expiry_level = ExpiryLevel.EXPIRED
        elif days <= self.critical_expiry_days:
            batch.expiry_level = ExpiryLevel.CRITICAL
        elif days <= self.near_expiry_days:
            batch.expiry_level = ExpiryLevel.NEAR_EXPIRY
        else:
            batch.expiry_level = ExpiryLevel.NORMAL
    
    def _identify_problem_batches(self, batches: List[MedicineBatch]) -> List[MedicineBatch]:
        problems = []
        for batch in batches:
            is_problem = False
            
            if batch.freeze_status == FreezeStatus.FROZEN:
                is_problem = True
            if batch.expiry_level in [ExpiryLevel.EXPIRED, ExpiryLevel.CRITICAL]:
                is_problem = True
            if batch.issues and len(batch.issues) > 0:
                is_problem = True
            
            if is_problem:
                problems.append(batch)
        
        problems.sort(key=lambda x: (x.expiry_days if x.expiry_days else 999, x.quantity), reverse=True)
        return problems
    
    def _generate_transfer_suggestions(self, batches: List[MedicineBatch]) -> List[TransferSuggestion]:
        suggestions = []
        
        available_transfer: Dict[Tuple[str, str], List[MedicineBatch]] = defaultdict(list)
        store_demand: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        
        for batch in batches:
            if batch.freeze_status != FreezeStatus.FROZEN and batch.quantity > 0:
                key = (batch.medicine_name, batch.batch_no)
                available_transfer[key].append(batch)
                
                if batch.expiry_level in [ExpiryLevel.NEAR_EXPIRY, ExpiryLevel.CRITICAL]:
                    store_demand[batch.store_name][batch.medicine_name] += batch.quantity
        
        for (medicine_name, batch_no), store_batches in available_transfer.items():
            if len(store_batches) <= 1:
                continue
            
            store_batches_sorted = sorted(
                [b for b in store_batches if b.expiry_level in [ExpiryLevel.NEAR_EXPIRY, ExpiryLevel.CRITICAL]],
                key=lambda x: x.expiry_days
            )
            
            if not store_batches_sorted:
                continue
            
            source_batch = store_batches_sorted[0]
            
            other_stores = [b for b in store_batches if b.store_name != source_batch.store_name]
            
            for target_batch in other_stores:
                if target_batch.expiry_level == ExpiryLevel.NORMAL and target_batch.quantity > 0:
                    transfer_qty = min(source_batch.quantity, target_batch.quantity // 2)
                    if transfer_qty > 0:
                        reason = self._get_transfer_reason(source_batch, target_batch)
                        suggestion = TransferSuggestion(
                            source_store=source_batch.store_name,
                            target_store=target_batch.store_name,
                            medicine_name=medicine_name,
                            batch_no=batch_no,
                            quantity=transfer_qty,
                            expiry_date=source_batch.expiry_date,
                            expiry_days=source_batch.expiry_days,
                            reason=reason
                        )
                        suggestions.append(suggestion)
        
        suggestions.sort(key=lambda x: x.expiry_days)
        return suggestions
    
    def _get_transfer_reason(self, source_batch: MedicineBatch, target_batch: MedicineBatch) -> str:
        if source_batch.expiry_level == ExpiryLevel.CRITICAL:
            return f"危急效期({source_batch.expiry_days}天)，需紧急调拨至库存充足门店"
        elif source_batch.expiry_level == ExpiryLevel.NEAR_EXPIRY:
            return f"近效期({source_batch.expiry_days}天)，建议调拨优先销售"
        else:
            return "跨门店库存平衡"
