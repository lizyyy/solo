from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Violation:
    rule_id: str
    severity: Severity
    message: str
    request_id: Optional[str] = None
    chemical_id: Optional[str] = None
    location_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


class Normalizer:
    """
    同义危险类别归一化处理器
    解决"酸类"、"强酸性物质"、"腐蚀性酸"等不同表述的归一化问题
    """
    
    def __init__(self, normalization_rules: Dict[str, List[str]]):
        """
        初始化归一化器
        :param normalization_rules: 格式如 {"强酸": ["酸类", "强酸性物质", "腐蚀性酸"], ...}
        """
        self.normalization_rules = normalization_rules
        
        # 构建反向映射：别名 -> 标准名称
        self.alias_to_standard: Dict[str, str] = {}
        for standard, aliases in normalization_rules.items():
            # 标准名称本身也是一种别名
            self.alias_to_standard[standard.lower()] = standard
            for alias in aliases:
                self.alias_to_standard[alias.lower()] = standard
    
    def normalize(self, category: str) -> str:
        """
        将危险类别归一化为标准名称
        :param category: 输入的危险类别（可能是别名）
        :return: 标准名称，如果没有匹配则返回原名称（标准化大小写）
        """
        normalized = category.strip().lower()
        return self.alias_to_standard.get(normalized, category.strip())
    
    def normalize_list(self, categories: List[str]) -> List[str]:
        """
        归一化一个类别列表，自动去重
        """
        normalized = [self.normalize(cat) for cat in categories]
        # 去重但保持顺序
        seen = set()
        result = []
        for cat in normalized:
            if cat not in seen:
                seen.add(cat)
                result.append(cat)
        return result
    
    def are_equivalent(self, cat1: str, cat2: str) -> bool:
        """
        检查两个类别是否等价（归一化后相同）
        """
        return self.normalize(cat1) == self.normalize(cat2)
    
    def has_overlap(self, list1: List[str], list2: List[str]) -> bool:
        """
        检查两个类别列表是否有重叠（考虑归一化）
        """
        norm1 = set(self.normalize_list(list1))
        norm2 = set(self.normalize_list(list2))
        return bool(norm1 & norm2)


def check_storage_capacity(
    request: Dict[str, Any],
    storage: Dict[str, Dict[str, Any]],
    chemicals: Dict[str, Dict[str, Any]],
    normalizer: Normalizer
) -> Optional[Violation]:
    """
    检查库位容量是否足够
    坑：同一库位剩余容量不足 - 需要计算申请体积与剩余容量的关系
    """
    loc_id = request.get('requested_location')
    if not loc_id or loc_id not in storage:
        return None
    
    location = storage[loc_id]
    requested_volume = request['volume']
    remaining = location['remaining_capacity']
    
    # 检查容量是否足够
    if requested_volume > remaining:
        return Violation(
            rule_id="CAPACITY-001",
            severity=Severity.HIGH,
            message=f"库位 {loc_id} 容量不足",
            request_id=request['request_id'],
            chemical_id=request['chemical_id'],
            location_id=loc_id,
            details={
                "requested_volume": requested_volume,
                "remaining_capacity": remaining,
                "deficit": requested_volume - remaining
            }
        )
    
    return None


def check_dangerous_category_mixing(
    request: Dict[str, Any],
    storage: Dict[str, Dict[str, Any]],
    chemicals: Dict[str, Dict[str, Any]],
    compatibility: Dict[str, Dict[str, Any]],
    normalizer: Normalizer
) -> List[Violation]:
    """
    检查危险类别禁混规则
    坑：同义危险类别归一化 - 需要先归一化再比较
    """
    violations = []
    loc_id = request.get('requested_location')
    
    if not loc_id or loc_id not in storage:
        return violations
    
    location = storage[loc_id]
    chem_id = request['chemical_id']
    
    if chem_id not in chemicals:
        return violations
    
    chemical = chemicals[chem_id]
    incoming_categories = normalizer.normalize_list(chemical['dangerous_categories'])
    incompatible_pairs = compatibility.get('incompatible_pairs', {})
    
    # 1. 检查库位的禁止类别
    forbidden_cats = normalizer.normalize_list(location.get('forbidden_categories', []))
    for cat in incoming_categories:
        if normalizer.has_overlap([cat], forbidden_cats):
            violations.append(Violation(
                rule_id="MIXING-001",
                severity=Severity.CRITICAL,
                message=f"化学品 {chem_id} 的危险类别 '{cat}' 是库位 {loc_id} 的禁止类别",
                request_id=request['request_id'],
                chemical_id=chem_id,
                location_id=loc_id,
                details={
                    "incoming_category": cat,
                    "forbidden_categories": forbidden_cats
                }
            ))
    
    # 2. 检查库位的允许类别（如果有设置）
    allowed_cats = normalizer.normalize_list(location.get('allowed_categories', []))
    if allowed_cats:  # 只有设置了允许类别时才检查
        has_allowed = False
        for cat in incoming_categories:
            if normalizer.has_overlap([cat], allowed_cats):
                has_allowed = True
                break
        
        if not has_allowed:
            violations.append(Violation(
                rule_id="MIXING-002",
                severity=Severity.HIGH,
                message=f"化学品 {chem_id} 的危险类别不在库位 {loc_id} 的允许列表中",
                request_id=request['request_id'],
                chemical_id=chem_id,
                location_id=loc_id,
                details={
                    "incoming_categories": incoming_categories,
                    "allowed_categories": allowed_cats
                }
            ))
    
    # 3. 检查与库位中现有化学品的不相容性
    for existing_chem in location['current_chemicals']:
        existing_chem_id = existing_chem['chemical_id']
        if existing_chem_id not in chemicals:
            continue
        
        existing_chemical = chemicals[existing_chem_id]
        existing_categories = normalizer.normalize_list(existing_chemical['dangerous_categories'])
        
        # 检查每一对类别是否不相容
        for inc_cat in incoming_categories:
            inc_norm = normalizer.normalize(inc_cat)
            for exist_cat in existing_categories:
                exist_norm = normalizer.normalize(exist_cat)
                
                # 检查是否在不相容对中
                if inc_norm in incompatible_pairs and exist_norm in incompatible_pairs[inc_norm]:
                    severity_str = incompatible_pairs[inc_norm][exist_norm]
                    severity = Severity(severity_str) if severity_str in [s.value for s in Severity] else Severity.HIGH
                    
                    violations.append(Violation(
                        rule_id="MIXING-003",
                        severity=severity,
                        message=f"化学品 {chem_id}({inc_cat}) 与库位 {loc_id} 中现有化学品 {existing_chem_id}({exist_cat}) 不相容",
                        request_id=request['request_id'],
                        chemical_id=chem_id,
                        location_id=loc_id,
                        details={
                            "incoming_category": inc_cat,
                            "existing_category": exist_cat,
                            "existing_chemical": existing_chem_id,
                            "severity": severity_str
                        }
                    ))
    
    return violations


def check_missing_labels(
    request: Dict[str, Any],
    chemicals: Dict[str, Dict[str, Any]],
    normalizer: Normalizer
) -> Optional[Violation]:
    """
    检查化学品标签缺失
    包括危险类别缺失等问题
    """
    chem_id = request['chemical_id']
    
    if chem_id not in chemicals:
        return Violation(
            rule_id="LABEL-001",
            severity=Severity.HIGH,
            message=f"化学品 {chem_id} 不存在于化学品目录中",
            request_id=request['request_id'],
            chemical_id=chem_id,
            details={}
        )
    
    chemical = chemicals[chem_id]
    dangerous_categories = chemical.get('dangerous_categories', [])
    
    if not dangerous_categories:
        return Violation(
            rule_id="LABEL-002",
            severity=Severity.CRITICAL,
            message=f"化学品 {chem_id}({chemical['name']}) 缺少危险类别标签",
            request_id=request['request_id'],
            chemical_id=chem_id,
            details={
                "chemical_name": chemical['name']
            }
        )
    
    # 检查是否有无效的类别（空字符串等）
    valid_cats = [cat for cat in dangerous_categories if cat and cat.strip()]
    if len(valid_cats) != len(dangerous_categories):
        return Violation(
            rule_id="LABEL-003",
            severity=Severity.MEDIUM,
            message=f"化学品 {chem_id} 的危险类别包含无效值",
            request_id=request['request_id'],
            chemical_id=chem_id,
            details={
                "original_categories": dangerous_categories,
                "valid_categories": valid_cats
            }
        )
    
    return None


def check_inbound_conflicts(
    all_requests: List[Dict[str, Any]],
    storage: Dict[str, Dict[str, Any]],
    chemicals: Dict[str, Dict[str, Any]],
    normalizer: Normalizer
) -> List[Violation]:
    """
    检查入库申请之间的冲突
    包括：
    1. 同一库位被多个申请使用，总容量超过限制
    2. 同一化学品被多次申请入库
    """
    violations = []
    
    # 按库位分组统计申请
    location_requests: Dict[str, List[Dict[str, Any]]] = {}
    for req in all_requests:
        loc_id = req.get('requested_location')
        if loc_id:
            if loc_id not in location_requests:
                location_requests[loc_id] = []
            location_requests[loc_id].append(req)
    
    # 1. 检查同一库位的总申请容量
    for loc_id, reqs in location_requests.items():
        if loc_id not in storage:
            continue
        
        location = storage[loc_id]
        total_requested = sum(req['volume'] for req in reqs)
        remaining = location['remaining_capacity']
        
        # 坑：同一库位剩余容量不足 - 需要考虑多个申请的总和
        if total_requested > remaining:
            violations.append(Violation(
                rule_id="CONFLICT-001",
                severity=Severity.HIGH,
                message=f"库位 {loc_id} 多个入库申请的总容量({total_requested})超过剩余容量({remaining})",
                location_id=loc_id,
                details={
                    "total_requested_volume": total_requested,
                    "remaining_capacity": remaining,
                    "conflicting_requests": [req['request_id'] for req in reqs],
                    "deficit": total_requested - remaining
                }
            ))
        
        # 2. 检查同一库位中申请的化学品之间是否相容
        for i, req1 in enumerate(reqs):
            for j, req2 in enumerate(reqs[i+1:], i+1):
                chem1_id = req1['chemical_id']
                chem2_id = req2['chemical_id']
                
                if chem1_id not in chemicals or chem2_id not in chemicals:
                    continue
                
                chem1 = chemicals[chem1_id]
                chem2 = chemicals[chem2_id]
                
                cats1 = normalizer.normalize_list(chem1['dangerous_categories'])
                cats2 = normalizer.normalize_list(chem2['dangerous_categories'])
                
                # 简单检查：如果两个化学品有相同的危险类别，可能没问题
                # 但如果有不同的类别，需要更复杂的逻辑
                # 这里简化处理：如果没有重叠类别，标记为潜在冲突
                if not normalizer.has_overlap(cats1, cats2):
                    violations.append(Violation(
                        rule_id="CONFLICT-002",
                        severity=Severity.MEDIUM,
                        message=f"库位 {loc_id} 中申请的化学品 {chem1_id} 和 {chem2_id} 危险类别不同，需人工确认相容性",
                        location_id=loc_id,
                        details={
                            "chemical1": chem1_id,
                            "chemical1_categories": cats1,
                            "chemical2": chem2_id,
                            "chemical2_categories": cats2,
                            "request1": req1['request_id'],
                            "request2": req2['request_id']
                        }
                    ))
    
    # 3. 检查同一化学品被多次申请
    chemical_requests: Dict[str, List[Dict[str, Any]]] = {}
    for req in all_requests:
        chem_id = req['chemical_id']
        if chem_id not in chemical_requests:
            chemical_requests[chem_id] = []
        chemical_requests[chem_id].append(req)
    
    for chem_id, reqs in chemical_requests.items():
        if len(reqs) > 1:
            violations.append(Violation(
                rule_id="CONFLICT-003",
                severity=Severity.LOW,
                message=f"化学品 {chem_id} 被多个入库申请引用",
                chemical_id=chem_id,
                details={
                    "request_count": len(reqs),
                    "request_ids": [req['request_id'] for req in reqs]
                }
            ))
    
    return violations


def run_all_checks(
    request: Dict[str, Any],
    all_requests: List[Dict[str, Any]],
    storage: Dict[str, Dict[str, Any]],
    chemicals: Dict[str, Dict[str, Any]],
    compatibility: Dict[str, Dict[str, Any]],
    normalizer: Normalizer
) -> List[Violation]:
    """
    运行所有检查规则
    """
    violations = []
    
    # 1. 检查标签缺失
    label_violation = check_missing_labels(request, chemicals, normalizer)
    if label_violation:
        violations.append(label_violation)
    
    # 2. 检查库位容量
    capacity_violation = check_storage_capacity(request, storage, chemicals, normalizer)
    if capacity_violation:
        violations.append(capacity_violation)
    
    # 3. 检查危险类别禁混
    mixing_violations = check_dangerous_category_mixing(
        request, storage, chemicals, compatibility, normalizer
    )
    violations.extend(mixing_violations)
    
    return violations
