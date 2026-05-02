from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from .rules import (
    Normalizer, 
    Violation, 
    Severity,
    check_storage_capacity,
    check_dangerous_category_mixing,
    check_missing_labels
)


@dataclass
class AlternativeLocation:
    location_id: str
    location_name: str
    suitability_score: float  # 0-100 分数越高越合适
    remaining_capacity: float
    reasons: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class PlacementItem:
    request_id: str
    chemical_id: str
    chemical_name: str
    requested_location: Optional[str]
    final_location: Optional[str]
    volume: float
    status: str  # approved, rejected, needs_review
    violations: List[Violation] = field(default_factory=list)
    alternative_locations: List[AlternativeLocation] = field(default_factory=list)


def find_alternative_locations(
    request: Dict[str, Any],
    storage: Dict[str, Dict[str, Any]],
    chemicals: Dict[str, Dict[str, Any]],
    compatibility: Dict[str, Dict[str, Any]],
    normalizer: Normalizer
) -> List[AlternativeLocation]:
    """
    为入库申请寻找可替代的库位
    返回按适用性排序的库位列表
    """
    alternatives = []
    chem_id = request['chemical_id']
    
    if chem_id not in chemicals:
        return []
    
    chemical = chemicals[chem_id]
    requested_volume = request['volume']
    incoming_categories = normalizer.normalize_list(chemical['dangerous_categories'])
    incompatible_pairs = compatibility.get('incompatible_pairs', {})
    
    for loc_id, location in storage.items():
        # 跳过原申请的库位（如果有）
        if loc_id == request.get('requested_location'):
            continue
        
        reasons = []
        warnings = []
        score = 0
        
        # 1. 检查容量
        remaining = location['remaining_capacity']
        if requested_volume > remaining:
            continue  # 容量不足，直接跳过
        
        score += 30  # 容量足够加30分
        reasons.append(f"容量充足（剩余 {remaining}L，需要 {requested_volume}L）")
        
        # 2. 检查库位的允许/禁止类别
        forbidden_cats = normalizer.normalize_list(location.get('forbidden_categories', []))
        allowed_cats = normalizer.normalize_list(location.get('allowed_categories', []))
        
        # 检查是否在禁止类别中
        has_forbidden = False
        for cat in incoming_categories:
            if normalizer.has_overlap([cat], forbidden_cats):
                has_forbidden = True
                break
        
        if has_forbidden:
            warnings.append(f"化学品危险类别与库位禁止类别冲突")
            continue  # 禁止类别，直接跳过
        
        # 检查是否在允许类别中（如果有设置）
        if allowed_cats:
            has_allowed = False
            for cat in incoming_categories:
                if normalizer.has_overlap([cat], allowed_cats):
                    has_allowed = True
                    break
            
            if has_allowed:
                score += 20
                reasons.append("危险类别匹配库位允许类别")
            else:
                warnings.append(f"化学品危险类别不在库位允许列表中")
                score -= 10
        else:
            # 没有设置允许类别，默认可以存放
            score += 10
        
        # 3. 检查与现有化学品的相容性
        incompatibility_found = False
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
                    
                    if inc_norm in incompatible_pairs and exist_norm in incompatible_pairs[inc_norm]:
                        severity = incompatible_pairs[inc_norm][exist_norm]
                        if severity in ['critical', 'high']:
                            incompatibility_found = True
                            warnings.append(f"与库位中现有化学品 {existing_chem_id}({exist_cat}) 高度不相容")
                        else:
                            warnings.append(f"与库位中现有化学品 {existing_chem_id}({exist_cat}) 存在潜在冲突")
                            score -= 5
        
        if incompatibility_found:
            continue  # 高度不相容，跳过
        
        # 4. 加分项：库位中已有相同类别的化学品
        for existing_chem in location['current_chemicals']:
            existing_chem_id = existing_chem['chemical_id']
            if existing_chem_id not in chemicals:
                continue
            
            existing_chemical = chemicals[existing_chem_id]
            existing_categories = normalizer.normalize_list(existing_chemical['dangerous_categories'])
            
            if normalizer.has_overlap(incoming_categories, existing_categories):
                score += 15
                reasons.append(f"库位中已有相同类别的化学品 {existing_chem_id}")
                break
        
        # 5. 加分项：库位名称包含相关类别关键词
        loc_name = location.get('name', '').lower()
        for cat in incoming_categories:
            cat_lower = cat.lower()
            if cat_lower in loc_name or loc_name in cat_lower:
                score += 10
                reasons.append(f"库位名称 '{location['name']}' 与化学品类别匹配")
                break
        
        # 确保分数在合理范围内
        score = max(0, min(100, score))
        
        alternatives.append(AlternativeLocation(
            location_id=loc_id,
            location_name=location.get('name', ''),
            suitability_score=score,
            remaining_capacity=remaining,
            reasons=reasons,
            warnings=warnings
        ))
    
    # 按分数排序
    alternatives.sort(key=lambda x: x.suitability_score, reverse=True)
    
    return alternatives


def generate_placement_plan(
    inbound_requests: List[Dict[str, Any]],
    storage: Dict[str, Dict[str, Any]],
    chemicals: Dict[str, Dict[str, Any]],
    compatibility: Dict[str, Dict[str, Any]],
    normalizer: Normalizer,
    all_violations: List[Violation]
) -> Tuple[List[PlacementItem], Dict[str, Dict[str, Any]]]:
    """
    生成完整的放置计划
    返回：(放置项列表, 更新后的库位状态)
    """
    placement_items = []
    updated_storage = {loc_id: loc.copy() for loc_id, loc in storage.items()}
    
    # 按请求ID建立违规索引
    request_violations: Dict[str, List[Violation]] = {}
    for v in all_violations:
        if v.request_id:
            if v.request_id not in request_violations:
                request_violations[v.request_id] = []
            request_violations[v.request_id].append(v)
    
    for request in inbound_requests:
        req_id = request['request_id']
        chem_id = request['chemical_id']
        requested_loc = request.get('requested_location')
        volume = request['volume']
        
        # 获取化学品信息
        chem_name = chemicals.get(chem_id, {}).get('name', '未知')
        
        # 获取该请求的违规
        violations = request_violations.get(req_id, [])
        
        # 确定状态
        status = 'approved'
        has_critical = any(v.severity == Severity.CRITICAL for v in violations)
        has_high = any(v.severity == Severity.HIGH for v in violations)
        
        if has_critical:
            status = 'rejected'
        elif has_high:
            status = 'needs_review'
        
        # 寻找替代库位
        alternatives = []
        if status != 'approved':
            alternatives = find_alternative_locations(
                request, updated_storage, chemicals, compatibility, normalizer
            )
        
        # 确定最终库位
        final_location = None
        if status == 'approved' and requested_loc and requested_loc in updated_storage:
            final_location = requested_loc
            # 更新库位状态
            if final_location in updated_storage:
                updated_storage[final_location]['remaining_capacity'] -= volume
                updated_storage[final_location]['current_usage'] += volume
                updated_storage[final_location]['current_chemicals'].append({
                    'chemical_id': chem_id,
                    'volume': volume
                })
        
        placement_items.append(PlacementItem(
            request_id=req_id,
            chemical_id=chem_id,
            chemical_name=chem_name,
            requested_location=requested_loc,
            final_location=final_location,
            volume=volume,
            status=status,
            violations=violations,
            alternative_locations=alternatives
        ))
    
    return placement_items, updated_storage


def calculate_storage_utilization(
    storage: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    计算库位利用率统计
    """
    total_capacity = 0.0
    total_used = 0.0
    location_stats = []
    
    for loc_id, loc in storage.items():
        capacity = loc['capacity']
        used = loc['current_usage']
        utilization = (used / capacity * 100) if capacity > 0 else 0
        
        total_capacity += capacity
        total_used += used
        
        location_stats.append({
            'location_id': loc_id,
            'location_name': loc.get('name', ''),
            'capacity': capacity,
            'used': used,
            'remaining': loc['remaining_capacity'],
            'utilization_percent': round(utilization, 2)
        })
    
    overall_utilization = (total_used / total_capacity * 100) if total_capacity > 0 else 0
    
    return {
        'total_capacity': total_capacity,
        'total_used': total_used,
        'total_remaining': total_capacity - total_used,
        'overall_utilization_percent': round(overall_utilization, 2),
        'location_details': location_stats
    }
