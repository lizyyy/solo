from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Any

from .models import (
    Manifest, ManifestItem, PackingList, PackingItem,
    ContainerReconciliation, ValidationError, ValidationErrorType, RiskLevel
)


WEIGHT_TOLERANCE_PERCENT = 5.0
VOLUME_TOLERANCE_PERCENT = 5.0


class Reconciler:
    
    def __init__(self, tolerance_percent: float = 5.0):
        self.tolerance_percent = tolerance_percent
        self.errors: List[ValidationError] = []
    
    def reconcile(self, manifest: Manifest, packing_lists: List[PackingList]) -> List[ContainerReconciliation]:
        self.errors = []
        
        container_items = self._group_by_container(manifest, packing_lists)
        
        reconciliations: List[ContainerReconciliation] = []
        
        for container_no, data in container_items.items():
            reconciliation = self._reconcile_container(
                container_no, 
                data['manifest_items'],
                data['packing_items']
            )
            reconciliations.append(reconciliation)
            self.errors.extend(reconciliation.issues)
        
        self._check_duplicate_declarations(manifest)
        self._check_cancelled_declarations(manifest)
        
        return reconciliations
    
    def _group_by_container(self, manifest: Manifest, packing_lists: List[PackingList]) -> Dict[str, Dict[str, List]]:
        container_map: Dict[str, Dict[str, List]] = defaultdict(lambda: {'manifest_items': [], 'packing_items': []})
        
        for item in manifest.items:
            if item.container_no:
                container_map[item.container_no]['manifest_items'].append(item)
            else:
                self.errors.append(ValidationError(
                    error_type=ValidationErrorType.MISSING_CONTAINER_NO,
                    message="舱单项缺少箱号",
                    ticket_no=item.ticket_no,
                    container_no=None,
                    risk_level=RiskLevel.HIGH,
                    metadata={'source': 'manifest'}
                ))
        
        for pl in packing_lists:
            for item in pl.items:
                if item.container_no:
                    container_map[item.container_no]['packing_items'].append(item)
                else:
                    self.errors.append(ValidationError(
                        error_type=ValidationErrorType.MISSING_CONTAINER_NO,
                        message="装箱单项缺少箱号",
                        ticket_no=item.ticket_no,
                        container_no=None,
                        risk_level=RiskLevel.HIGH,
                        metadata={'source': 'packing_list', 'packing_list_ticket': pl.ticket_no}
                    ))
        
        return dict(container_map)
    
    def _reconcile_container(self, container_no: str, 
                               manifest_items: List[ManifestItem],
                               packing_items: List[PackingItem]) -> ContainerReconciliation:
        issues: List[ValidationError] = []
        
        ticket_numbers = set()
        for item in manifest_items:
            ticket_numbers.add(item.ticket_no)
        for item in packing_items:
            ticket_numbers.add(item.ticket_no)
        
        ticket_list = sorted(ticket_numbers)
        is_multi_ticket = len(ticket_list) > 1
        
        if is_multi_ticket:
            issues.append(ValidationError(
                error_type=ValidationErrorType.MULTI_TICKET_CONTAINER,
                message=f"集装箱 {container_no} 存在多票合箱，涉及提单号: {', '.join(ticket_list)}",
                ticket_no=ticket_list[0] if ticket_list else '',
                container_no=container_no,
                risk_level=RiskLevel.MEDIUM,
                metadata={'ticket_numbers': ticket_list, 'container_no': container_no}
            ))
        
        manifest_weight = sum(item.weight for item in manifest_items if item.weight is not None)
        manifest_volume = sum(item.volume for item in manifest_items if item.volume is not None)
        
        packing_weight = sum(item.weight for item in packing_items if item.weight is not None)
        packing_volume = sum(item.volume for item in packing_items if item.volume is not None)
        
        weight_discrepancy = 0.0
        volume_discrepancy = 0.0
        
        if manifest_weight > 0 and packing_weight > 0:
            weight_discrepancy = packing_weight - manifest_weight
            weight_diff_percent = abs(weight_discrepancy) / manifest_weight * 100
            
            if weight_diff_percent > self.tolerance_percent:
                issues.append(ValidationError(
                    error_type=ValidationErrorType.WEIGHT_VOLUME_MISMATCH,
                    message=f"集装箱 {container_no} 重量不一致: 舱单 {manifest_weight:.2f} KG, 装箱单 {packing_weight:.2f} KG, 差异 {weight_discrepancy:+.2f} KG ({weight_diff_percent:.1f}%)",
                    ticket_no=ticket_list[0] if ticket_list else '',
                    container_no=container_no,
                    risk_level=RiskLevel.HIGH if weight_diff_percent > 10 else RiskLevel.MEDIUM,
                    metadata={
                        'manifest_weight': manifest_weight,
                        'packing_weight': packing_weight,
                        'discrepancy': weight_discrepancy,
                        'discrepancy_percent': weight_diff_percent
                    }
                ))
        
        if manifest_volume > 0 and packing_volume > 0:
            volume_discrepancy = packing_volume - manifest_volume
            volume_diff_percent = abs(volume_discrepancy) / manifest_volume * 100
            
            if volume_diff_percent > self.tolerance_percent:
                issues.append(ValidationError(
                    error_type=ValidationErrorType.WEIGHT_VOLUME_MISMATCH,
                    message=f"集装箱 {container_no} 体积不一致: 舱单 {manifest_volume:.3f} CBM, 装箱单 {packing_volume:.3f} CBM, 差异 {volume_discrepancy:+.3f} CBM ({volume_diff_percent:.1f}%)",
                    ticket_no=ticket_list[0] if ticket_list else '',
                    container_no=container_no,
                    risk_level=RiskLevel.HIGH if volume_diff_percent > 10 else RiskLevel.MEDIUM,
                    metadata={
                        'manifest_volume': manifest_volume,
                        'packing_volume': packing_volume,
                        'discrepancy': volume_discrepancy,
                        'discrepancy_percent': volume_diff_percent
                    }
                ))
        
        manifest_tickets = set(item.ticket_no for item in manifest_items)
        packing_tickets = set(item.ticket_no for item in packing_items)
        
        missing_in_packing = manifest_tickets - packing_tickets
        extra_in_packing = packing_tickets - manifest_tickets
        
        if missing_in_packing:
            issues.append(ValidationError(
                error_type=ValidationErrorType.MISSING_CONTAINER_NO,
                message=f"集装箱 {container_no} 舱单存在但装箱单缺少的提单号: {', '.join(missing_in_packing)}",
                ticket_no=list(missing_in_packing)[0] if missing_in_packing else '',
                container_no=container_no,
                risk_level=RiskLevel.HIGH,
                metadata={'missing_tickets': list(missing_in_packing)}
            ))
        
        if extra_in_packing:
            issues.append(ValidationError(
                error_type=ValidationErrorType.DUPLICATE_CONTAINER,
                message=f"集装箱 {container_no} 装箱单存在但舱单缺少的提单号: {', '.join(extra_in_packing)}",
                ticket_no=list(extra_in_packing)[0] if extra_in_packing else '',
                container_no=container_no,
                risk_level=RiskLevel.HIGH,
                metadata={'extra_tickets': list(extra_in_packing)}
            ))
        
        has_duplicate_items = self._check_duplicate_items(manifest_items, packing_items, container_no, issues)
        
        return ContainerReconciliation(
            container_no=container_no,
            ticket_numbers=ticket_list,
            is_multi_ticket=is_multi_ticket,
            weight_discrepancy=weight_discrepancy,
            volume_discrepancy=volume_discrepancy,
            has_duplicate_items=has_duplicate_items,
            issues=issues
        )
    
    def _check_duplicate_items(self, manifest_items: List[ManifestItem],
                                packing_items: List[PackingItem],
                                container_no: str,
                                issues: List[ValidationError]) -> bool:
        has_duplicates = False
        
        manifest_ticket_counts: Dict[str, int] = defaultdict(int)
        for item in manifest_items:
            manifest_ticket_counts[item.ticket_no] += 1
        
        for ticket_no, count in manifest_ticket_counts.items():
            if count > 1:
                has_duplicates = True
                issues.append(ValidationError(
                    error_type=ValidationErrorType.DUPLICATE_CONTAINER,
                    message=f"提单 {ticket_no} 在舱单中出现 {count} 次",
                    ticket_no=ticket_no,
                    container_no=container_no,
                    risk_level=RiskLevel.HIGH,
                    metadata={'count': count, 'source': 'manifest'}
                ))
        
        packing_ticket_counts: Dict[str, int] = defaultdict(int)
        for item in packing_items:
            packing_ticket_counts[item.ticket_no] += 1
        
        for ticket_no, count in packing_ticket_counts.items():
            if count > 1:
                has_duplicates = True
                issues.append(ValidationError(
                    error_type=ValidationErrorType.DUPLICATE_CONTAINER,
                    message=f"提单 {ticket_no} 在装箱单中出现 {count} 次",
                    ticket_no=ticket_no,
                    container_no=container_no,
                    risk_level=RiskLevel.HIGH,
                    metadata={'count': count, 'source': 'packing_list'}
                ))
        
        return has_duplicates
    
    def _check_duplicate_declarations(self, manifest: Manifest):
        ticket_items: Dict[str, List[ManifestItem]] = defaultdict(list)
        for item in manifest.items:
            ticket_items[item.ticket_no].append(item)
        
        for ticket_no, items in ticket_items.items():
            if len(items) > 1:
                container_nos = [item.container_no for item in items]
                self.errors.append(ValidationError(
                    error_type=ValidationErrorType.DUPLICATE_DECLARATION,
                    message=f"检测到重复申报: 提单号 {ticket_no} 在舱单中出现 {len(items)} 次，涉及箱号: {', '.join(container_nos)}",
                    ticket_no=ticket_no,
                    container_no=container_nos[0] if container_nos else None,
                    risk_level=RiskLevel.HIGH,
                    metadata={
                        'ticket_no': ticket_no,
                        'count': len(items),
                        'container_numbers': container_nos
                    }
                ))
    
    def _check_cancelled_declarations(self, manifest: Manifest):
        cancelled_items = [item for item in manifest.items if item.is_cancelled]
        
        for item in cancelled_items:
            self.errors.append(ValidationError(
                error_type=ValidationErrorType.CANCELLED_DECLARATION,
                message=f"检测到撤单报文: 提单号 {item.ticket_no}, 箱号 {item.container_no}",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.CRITICAL,
                metadata={
                    'ticket_no': item.ticket_no,
                    'container_no': item.container_no,
                    'is_cancelled': True
                }
            ))
    
    def get_errors(self) -> List[ValidationError]:
        return self.errors
