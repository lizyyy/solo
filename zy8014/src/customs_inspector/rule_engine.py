import re
from typing import Dict, List, Optional, Any, Tuple

from .models import (
    Manifest, ManifestItem, PackingList, PackingItem, DeclarationRule,
    ValidationError, ValidationErrorType, RiskLevel, CorrectionTask
)


class RuleEngine:
    
    def __init__(self, rules: List[DeclarationRule]):
        self.rules = rules
        self.prohibited_items: List[Dict[str, Any]] = []
        self.restricted_items: List[Dict[str, Any]] = []
        self.certificate_rules: List[Dict[str, Any]] = []
        self._categorize_rules()
    
    def _categorize_rules(self):
        for rule in self.rules:
            rule_type = rule.rule_type.lower()
            if rule_type == 'prohibited':
                self.prohibited_items.append({
                    'rule': rule,
                    'hs_patterns': rule.conditions.get('hs_codes', []),
                    'description_keywords': rule.conditions.get('keywords', [])
                })
            elif rule_type == 'restricted':
                self.restricted_items.append({
                    'rule': rule,
                    'hs_patterns': rule.conditions.get('hs_codes', []),
                    'description_keywords': rule.conditions.get('keywords', [])
                })
            elif rule_type == 'certificate':
                self.certificate_rules.append({
                    'rule': rule,
                    'hs_patterns': rule.conditions.get('hs_codes', []),
                    'description_keywords': rule.conditions.get('keywords', []),
                    'required_certs': rule.required_certificates
                })
    
    def validate_manifest_item(self, item: ManifestItem) -> List[ValidationError]:
        errors: List[ValidationError] = []
        
        if not item.hs_code:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_HS_CODE,
                message="HS编码缺失",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.HIGH,
                metadata={'field': 'hs_code'}
            ))
        else:
            if not self._is_valid_hs_code(item.hs_code):
                errors.append(ValidationError(
                    error_type=ValidationErrorType.INVALID_HS_CODE,
                    message=f"HS编码格式无效: {item.hs_code}",
                    ticket_no=item.ticket_no,
                    container_no=item.container_no,
                    risk_level=RiskLevel.HIGH,
                    metadata={'hs_code': item.hs_code}
                ))
        
        if item.weight is None:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_WEIGHT,
                message="重量数据缺失",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.MEDIUM,
                metadata={'field': 'weight'}
            ))
        
        if item.volume is None:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_VOLUME,
                message="体积数据缺失",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.MEDIUM,
                metadata={'field': 'volume'}
            ))
        
        if not item.container_no:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_CONTAINER_NO,
                message="箱号缺失",
                ticket_no=item.ticket_no,
                container_no=None,
                risk_level=RiskLevel.HIGH,
                metadata={'field': 'container_no'}
            ))
        elif not self._is_valid_container_no(item.container_no):
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_CONTAINER_NO,
                message=f"箱号格式可能无效: {item.container_no}",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.LOW,
                metadata={'container_no': item.container_no}
            ))
        
        if not item.description:
            errors.append(ValidationError(
                error_type=ValidationErrorType.INVALID_NAME,
                message="品名描述缺失",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.MEDIUM,
                metadata={'field': 'description'}
            ))
        
        errors.extend(self._check_prohibited_item(item))
        errors.extend(self._check_restricted_item(item))
        
        return errors
    
    def validate_packing_item(self, item: PackingItem) -> List[ValidationError]:
        errors: List[ValidationError] = []
        
        if not item.hs_code:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_HS_CODE,
                message="HS编码缺失",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.HIGH,
                metadata={'source': 'packing_list', 'field': 'hs_code'}
            ))
        
        if item.weight is None:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_WEIGHT,
                message="重量数据缺失",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.MEDIUM,
                metadata={'source': 'packing_list', 'field': 'weight'}
            ))
        
        if item.volume is None:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_VOLUME,
                message="体积数据缺失",
                ticket_no=item.ticket_no,
                container_no=item.container_no,
                risk_level=RiskLevel.MEDIUM,
                metadata={'source': 'packing_list', 'field': 'volume'}
            ))
        
        errors.extend(self._check_prohibited_item(item))
        errors.extend(self._check_restricted_item(item))
        
        return errors
    
    def _check_prohibited_item(self, item) -> List[ValidationError]:
        errors: List[ValidationError] = []
        hs_code = getattr(item, 'hs_code', None)
        description = getattr(item, 'description', '')
        ticket_no = getattr(item, 'ticket_no', '')
        container_no = getattr(item, 'container_no', '')
        
        for prohib in self.prohibited_items:
            rule = prohib['rule']
            if self._matches_patterns(hs_code, description, prohib['hs_patterns'], prohib['description_keywords']):
                errors.append(ValidationError(
                    error_type=ValidationErrorType.PROHIBITED_ITEM,
                    message=f"发现禁运商品: {rule.rule_name} - {description}",
                    ticket_no=ticket_no,
                    container_no=container_no,
                    risk_level=RiskLevel.CRITICAL,
                    metadata={
                        'rule_id': rule.rule_id,
                        'rule_name': rule.rule_name,
                        'hs_code': hs_code,
                        'description': description
                    }
                ))
        
        return errors
    
    def _check_restricted_item(self, item) -> List[ValidationError]:
        errors: List[ValidationError] = []
        hs_code = getattr(item, 'hs_code', None)
        description = getattr(item, 'description', '')
        ticket_no = getattr(item, 'ticket_no', '')
        container_no = getattr(item, 'container_no', '')
        
        for restr in self.restricted_items:
            rule = restr['rule']
            if self._matches_patterns(hs_code, description, restr['hs_patterns'], restr['description_keywords']):
                errors.append(ValidationError(
                    error_type=ValidationErrorType.RESTRICTED_ITEM,
                    message=f"发现限制商品: {rule.rule_name} - {description}",
                    ticket_no=ticket_no,
                    container_no=container_no,
                    risk_level=rule.risk_level,
                    metadata={
                        'rule_id': rule.rule_id,
                        'rule_name': rule.rule_name,
                        'hs_code': hs_code,
                        'description': description,
                        'required_certificates': rule.required_certificates
                    }
                ))
        
        return errors
    
    def check_required_certificates(self, item) -> List[Tuple[str, List[str], str]]:
        results: List[Tuple[str, List[str], str]] = []
        hs_code = getattr(item, 'hs_code', None)
        description = getattr(item, 'description', '')
        
        for cert_rule in self.certificate_rules:
            rule = cert_rule['rule']
            if self._matches_patterns(hs_code, description, cert_rule['hs_patterns'], cert_rule['description_keywords']):
                results.append((
                    rule.rule_name,
                    cert_rule['required_certs'],
                    rule.rule_id
                ))
        
        return results
    
    def generate_correction_task(self, error: ValidationError, task_index: int) -> CorrectionTask:
        task_id = f"TASK-{task_index:04d}"
        
        task_type_map = {
            ValidationErrorType.MISSING_HS_CODE: "补全HS编码",
            ValidationErrorType.INVALID_HS_CODE: "修正HS编码",
            ValidationErrorType.MISSING_WEIGHT: "补全重量数据",
            ValidationErrorType.MISSING_VOLUME: "补全体积数据",
            ValidationErrorType.WEIGHT_VOLUME_MISMATCH: "核对重量体积",
            ValidationErrorType.MISSING_CONTAINER_NO: "补全箱号",
            ValidationErrorType.DUPLICATE_CONTAINER: "核对重复箱号",
            ValidationErrorType.MULTI_TICKET_CONTAINER: "处理多票合箱",
            ValidationErrorType.PROHIBITED_ITEM: "处理禁运商品",
            ValidationErrorType.RESTRICTED_ITEM: "准备限制商品证件",
            ValidationErrorType.DUPLICATE_DECLARATION: "处理重复申报",
            ValidationErrorType.CANCELLED_DECLARATION: "处理撤单报文",
            ValidationErrorType.MISSING_CERTIFICATE: "补全所需证件",
            ValidationErrorType.INVALID_NAME: "修正品名描述",
        }
        
        required_docs = error.metadata.get('required_certificates', [])
        
        priority_map = {
            RiskLevel.CRITICAL: 1,
            RiskLevel.HIGH: 2,
            RiskLevel.MEDIUM: 3,
            RiskLevel.LOW: 4,
        }
        
        return CorrectionTask(
            task_id=task_id,
            ticket_no=error.ticket_no or '',
            container_no=error.container_no,
            item_id=error.item_id,
            task_type=task_type_map.get(error.error_type, "其他问题"),
            description=error.message,
            required_documents=required_docs,
            priority=priority_map.get(error.risk_level, 3),
            risk_level=error.risk_level,
            status="PENDING"
        )
    
    def _matches_patterns(self, hs_code: Optional[str], description: str, 
                          hs_patterns: List[str], keywords: List[str]) -> bool:
        if hs_code and hs_patterns:
            hs_clean = hs_code.replace(' ', '').replace('.', '')
            for pattern in hs_patterns:
                pattern_clean = pattern.replace(' ', '').replace('.', '')
                if pattern_clean.endswith('*'):
                    prefix = pattern_clean[:-1]
                    if hs_clean.startswith(prefix):
                        return True
                elif pattern_clean == hs_clean:
                    return True
        
        if keywords and description:
            desc_lower = description.lower()
            for keyword in keywords:
                if keyword.lower() in desc_lower:
                    return True
        
        return False
    
    def _is_valid_hs_code(self, hs_code: str) -> bool:
        if not hs_code:
            return False
        
        cleaned = re.sub(r'[\s.]', '', hs_code)
        
        if not cleaned.isdigit():
            return False
        
        if len(cleaned) < 4 or len(cleaned) > 12:
            return False
        
        return True
    
    def _is_valid_container_no(self, container_no: str) -> bool:
        if not container_no:
            return False
        
        cleaned = re.sub(r'[\s-]', '', container_no.upper())
        
        if len(cleaned) != 11:
            return False
        
        if not cleaned[:4].isalpha():
            return False
        
        if not cleaned[4:].isdigit():
            return False
        
        return True
