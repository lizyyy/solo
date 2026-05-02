from typing import List, Dict, Any, Optional, Callable, Tuple
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
import json

from models import Pottery, SpliceGroup, PotteryGroupAssociation, Issue
from config import Config


class IssueSeverity(Enum):
    CRITICAL = 'critical'
    HIGH = 'high'
    MEDIUM = 'medium'
    LOW = 'low'
    WARNING = 'warning'


class IssueType(Enum):
    LAYER_CONFLICT = 'layer_conflict'
    EDGE_SIZE_ERROR = 'edge_size_error'
    TAG_CONFLICT = 'tag_conflict'
    PHOTO_MISSING = 'photo_missing'
    GROUP_LOOP = 'group_loop'
    DUPLICATE_REFERENCE = 'duplicate_reference'
    INVALID_GROUP_SIZE = 'invalid_group_size'
    EVIDENCE_MISSING = 'evidence_missing'


@dataclass
class RuleResult:
    passed: bool
    issues: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            'passed': self.passed,
            'issues': self.issues,
            'warnings': self.warnings,
            'metadata': self.metadata
        }


class BaseRule(ABC):
    rule_name: str
    description: str
    severity: IssueSeverity
    issue_type: IssueType
    
    @abstractmethod
    def validate(self, *args, **kwargs) -> RuleResult:
        pass
    
    def create_issue_dict(self, title: str, description: str, 
                          pottery_id: Optional[str] = None,
                          group_id: Optional[str] = None,
                          related_entity: Optional[str] = None,
                          related_entity_id: Optional[str] = None,
                          details: Optional[Dict] = None) -> Dict[str, Any]:
        return {
            'rule_name': self.rule_name,
            'issue_type': self.issue_type.value,
            'severity': self.severity.value,
            'title': title,
            'description': description,
            'pottery_id': pottery_id,
            'group_id': group_id,
            'related_entity': related_entity,
            'related_entity_id': related_entity_id,
            'rule_details': json.dumps(details) if details else None
        }


class TrenchLayerConsistencyRule(BaseRule):
    rule_name = 'trench_layer_consistency'
    description = '检查拼接组内陶片的探方和层位是否一致'
    severity = IssueSeverity.HIGH
    issue_type = IssueType.LAYER_CONFLICT
    
    def validate(self, group: SpliceGroup) -> RuleResult:
        potteries = group.get_potteries()
        
        if len(potteries) < 2:
            return RuleResult(passed=True, warnings=['拼接组陶片数量不足，跳过层位检查'])
        
        reference_trench = potteries[0].trench
        reference_layer = potteries[0].layer
        
        issues = []
        
        for pottery in potteries[1:]:
            if pottery.trench != reference_trench:
                issues.append(self.create_issue_dict(
                    title=f'探方不一致: {pottery.pottery_id}',
                    description=f'陶片 {pottery.pottery_id} 探方 "{pottery.trench}" 与参考陶片 {potteries[0].pottery_id} 探方 "{reference_trench}" 不一致',
                    pottery_id=pottery.pottery_id,
                    group_id=group.group_id,
                    related_entity='pottery',
                    related_entity_id=pottery.pottery_id,
                    details={
                        'expected_trench': reference_trench,
                        'actual_trench': pottery.trench,
                        'reference_pottery': potteries[0].pottery_id
                    }
                ))
            
            if pottery.layer != reference_layer:
                issues.append(self.create_issue_dict(
                    title=f'层位不一致: {pottery.pottery_id}',
                    description=f'陶片 {pottery.pottery_id} 层位 "{pottery.layer}" 与参考陶片 {potteries[0].pottery_id} 层位 "{reference_layer}" 不一致',
                    pottery_id=pottery.pottery_id,
                    group_id=group.group_id,
                    related_entity='pottery',
                    related_entity_id=pottery.pottery_id,
                    details={
                        'expected_layer': reference_layer,
                        'actual_layer': pottery.layer,
                        'reference_pottery': potteries[0].pottery_id
                    }
                ))
        
        return RuleResult(
            passed=len(issues) == 0,
            issues=issues,
            metadata={
                'total_potteries': len(potteries),
                'reference_trench': reference_trench,
                'reference_layer': reference_layer
            }
        )


class EdgeSizeRule(BaseRule):
    rule_name = 'edge_size_consistency'
    description = '检查拼接边缘尺寸误差是否在容限范围内'
    severity = IssueSeverity.MEDIUM
    issue_type = IssueType.EDGE_SIZE_ERROR
    
    def __init__(self, tolerance: Optional[float] = None):
        self.tolerance = tolerance or Config.RULE_CONFIG.get('edge_size_tolerance', 0.5)
    
    def validate(self, association: PotteryGroupAssociation, 
                 reference_length: Optional[float] = None) -> RuleResult:
        if reference_length is None or association.edge_length is None:
            return RuleResult(passed=True, warnings=['边缘尺寸不完整，跳过尺寸检查'])
        
        edge_length = association.edge_length
        diff = abs(edge_length - reference_length)
        
        issues = []
        
        if diff > self.tolerance:
            issues.append(self.create_issue_dict(
                title=f'边缘尺寸误差超出容限',
                description=f'边缘尺寸 {edge_length}cm 与参考尺寸 {reference_length}cm 的误差为 {diff}cm，超过容限值 {self.tolerance}cm',
                pottery_id=association.pottery.pottery_id if association.pottery else None,
                group_id=association.group.group_id if association.group else None,
                related_entity='association',
                related_entity_id=str(association.id),
                details={
                    'edge_length': edge_length,
                    'reference_length': reference_length,
                    'difference': diff,
                    'tolerance': self.tolerance,
                    'edge_position': association.edge_position
                }
            ))
        
        return RuleResult(
            passed=len(issues) == 0,
            issues=issues,
            metadata={
                'edge_length': edge_length,
                'reference_length': reference_length,
                'difference': diff,
                'tolerance': self.tolerance
            }
        )
    
    def validate_group(self, group: SpliceGroup) -> RuleResult:
        all_issues = []
        all_warnings = []
        
        associations = group.associations
        if len(associations) < 2:
            return RuleResult(passed=True, warnings=['拼接组关联数量不足，跳过边缘尺寸检查'])
        
        reference_assoc = None
        for assoc in associations:
            if assoc.edge_length is not None:
                reference_assoc = assoc
                break
        
        if reference_assoc is None:
            return RuleResult(passed=True, warnings=['所有陶片均无边缘尺寸，跳过检查'])
        
        reference_length = reference_assoc.edge_length
        
        for assoc in associations:
            if assoc.id == reference_assoc.id:
                continue
            
            result = self.validate(assoc, reference_length)
            all_issues.extend(result.issues)
            all_warnings.extend(result.warnings)
        
        return RuleResult(
            passed=len(all_issues) == 0,
            issues=all_issues,
            warnings=all_warnings,
            metadata={
                'reference_length': reference_length,
                'tolerance': self.tolerance
            }
        )


class TagConflictRule(BaseRule):
    rule_name = 'tag_conflict'
    description = '检查拼接组内陶片的纹饰和胎土标签是否冲突'
    severity = IssueSeverity.MEDIUM
    issue_type = IssueType.TAG_CONFLICT
    
    def validate(self, group: SpliceGroup) -> RuleResult:
        potteries = group.get_potteries()
        
        if len(potteries) < 2:
            return RuleResult(passed=True, warnings=['拼接组陶片数量不足，跳过标签检查'])
        
        issues = []
        
        decorations = {}
        paste_types = {}
        
        for pottery in potteries:
            if pottery.decoration:
                dec = pottery.decoration.strip()
                if dec not in decorations:
                    decorations[dec] = []
                decorations[dec].append(pottery.pottery_id)
            
            if pottery.paste_type:
                paste = pottery.paste_type.strip()
                if paste not in paste_types:
                    paste_types[paste] = []
                paste_types[paste].append(pottery.pottery_id)
        
        if len(decorations) > 1:
            dec_list = [f'"{k}": {", ".join(v)}' for k, v in decorations.items()]
            issues.append(self.create_issue_dict(
                title='纹饰标签冲突',
                description=f'拼接组内存在多种纹饰类型: {"; ".join(dec_list)}',
                group_id=group.group_id,
                related_entity='group',
                related_entity_id=group.group_id,
                details={
                    'decorations': decorations,
                    'pottery_ids': [p.pottery_id for p in potteries]
                }
            ))
        
        if len(paste_types) > 1:
            paste_list = [f'"{k}": {", ".join(v)}' for k, v in paste_types.items()]
            issues.append(self.create_issue_dict(
                title='胎土标签冲突',
                description=f'拼接组内存在多种胎土类型: {"; ".join(paste_list)}',
                group_id=group.group_id,
                related_entity='group',
                related_entity_id=group.group_id,
                details={
                    'paste_types': paste_types,
                    'pottery_ids': [p.pottery_id for p in potteries]
                }
            ))
        
        return RuleResult(
            passed=len(issues) == 0,
            issues=issues,
            metadata={
                'decoration_types': list(decorations.keys()),
                'paste_types': list(paste_types.keys()),
                'total_potteries': len(potteries)
            }
        )


class PhotoMissingRule(BaseRule):
    rule_name = 'photo_missing'
    description = '检查陶片是否缺失照片'
    severity = IssueSeverity.LOW
    issue_type = IssueType.PHOTO_MISSING
    
    def validate(self, pottery: Pottery) -> RuleResult:
        issues = []
        
        if not pottery.photo_path and not pottery.photo_hash:
            issues.append(self.create_issue_dict(
                title=f'陶片照片缺失: {pottery.pottery_id}',
                description=f'陶片 {pottery.pottery_id} 既没有照片路径也没有照片哈希值',
                pottery_id=pottery.pottery_id,
                related_entity='pottery',
                related_entity_id=pottery.pottery_id,
                details={
                    'photo_path': pottery.photo_path,
                    'photo_hash': pottery.photo_hash,
                    'trench': pottery.trench,
                    'layer': pottery.layer
                }
            ))
        
        return RuleResult(
            passed=len(issues) == 0,
            issues=issues,
            metadata={
                'has_photo_path': bool(pottery.photo_path),
                'has_photo_hash': bool(pottery.photo_hash)
            }
        )
    
    def validate_group(self, group: SpliceGroup) -> RuleResult:
        all_issues = []
        
        for pottery in group.get_potteries():
            result = self.validate(pottery)
            all_issues.extend(result.issues)
        
        return RuleResult(
            passed=len(all_issues) == 0,
            issues=all_issues,
            metadata={
                'total_checked': len(group.get_potteries())
            }
        )


class GroupClosureRule(BaseRule):
    rule_name = 'group_closure'
    description = '检查拼接组是否形成闭环（所有陶片都有明确的拼接关系）'
    severity = IssueSeverity.WARNING
    issue_type = IssueType.GROUP_LOOP
    
    def validate(self, group: SpliceGroup) -> RuleResult:
        potteries = group.get_potteries()
        associations = group.associations
        
        if len(potteries) < 2:
            return RuleResult(passed=True, warnings=['拼接组陶片数量不足，跳过闭环检查'])
        
        issues = []
        
        pottery_ids = set(p.pottery_id for p in potteries)
        associated_pottery_ids = set()
        
        for assoc in associations:
            if assoc.pottery:
                associated_pottery_ids.add(assoc.pottery.pottery_id)
                if assoc.edge_position:
                    pass
        
        unassociated = pottery_ids - associated_pottery_ids
        if unassociated:
            issues.append(self.create_issue_dict(
                title='陶片未关联拼接关系',
                description=f'以下陶片在拼接组中但没有明确的拼接关联: {", ".join(unassociated)}',
                group_id=group.group_id,
                related_entity='group',
                related_entity_id=group.group_id,
                details={
                    'unassociated_potteries': list(unassociated),
                    'total_potteries': len(potteries),
                    'total_associations': len(associations)
                }
            ))
        
        edge_count = {}
        for assoc in associations:
            if assoc.edge_position:
                pos = assoc.edge_position
                if pos not in edge_count:
                    edge_count[pos] = 0
                edge_count[pos] += 1
        
        duplicate_edges = {k: v for k, v in edge_count.items() if v > 1}
        if duplicate_edges:
            issues.append(self.create_issue_dict(
                title='边缘位置重复',
                description=f'以下边缘位置被多次引用: {", ".join([f"{k}({v}次)" for k, v in duplicate_edges.items()])}',
                group_id=group.group_id,
                related_entity='group',
                related_entity_id=group.group_id,
                details={
                    'edge_counts': edge_count,
                    'duplicate_edges': duplicate_edges
                }
            ))
        
        if not group.guess_evidence or len(str(group.guess_evidence).strip()) < 10:
            issues.append(self.create_issue_dict(
                title='拼接证据不足',
                description='拼接组的人工拼接猜测证据描述过短或缺失',
                group_id=group.group_id,
                related_entity='group',
                related_entity_id=group.group_id,
                details={
                    'evidence_length': len(str(group.guess_evidence)) if group.guess_evidence else 0
                }
            ))
        
        return RuleResult(
            passed=len(issues) == 0,
            issues=issues,
            metadata={
                'total_potteries': len(potteries),
                'total_associations': len(associations),
                'unassociated_count': len(unassociated),
                'has_evidence': bool(group.guess_evidence and len(str(group.guess_evidence).strip()) >= 10)
            }
        )


class DuplicateReferenceRule(BaseRule):
    rule_name = 'duplicate_reference'
    description = '检查陶片是否被多个拼接组重复引用'
    severity = IssueSeverity.CRITICAL
    issue_type = IssueType.DUPLICATE_REFERENCE
    
    def validate(self, pottery: Pottery, all_groups: List[SpliceGroup]) -> RuleResult:
        issues = []
        
        pottery_groups = []
        for group in all_groups:
            for assoc in group.associations:
                if assoc.pottery and assoc.pottery.id == pottery.id:
                    pottery_groups.append(group)
                    break
        
        if len(pottery_groups) > 1:
            group_ids = [g.group_id for g in pottery_groups]
            issues.append(self.create_issue_dict(
                title=f'陶片被多组重复引用: {pottery.pottery_id}',
                description=f'陶片 {pottery.pottery_id} 同时出现在以下拼接组中: {", ".join(group_ids)}',
                pottery_id=pottery.pottery_id,
                related_entity='pottery',
                related_entity_id=pottery.pottery_id,
                details={
                    'group_ids': group_ids,
                    'group_count': len(pottery_groups)
                }
            ))
        
        return RuleResult(
            passed=len(issues) == 0,
            issues=issues,
            metadata={
                'group_count': len(pottery_groups),
                'group_ids': [g.group_id for g in pottery_groups]
            }
        )


class GroupSizeRule(BaseRule):
    rule_name = 'group_size'
    description = '检查拼接组的陶片数量是否在有效范围内'
    severity = IssueSeverity.MEDIUM
    issue_type = IssueType.INVALID_GROUP_SIZE
    
    def __init__(self, min_size: Optional[int] = None, max_size: Optional[int] = None):
        self.min_size = min_size or Config.RULE_CONFIG.get('min_pieces_for_group', 2)
        self.max_size = max_size or Config.RULE_CONFIG.get('max_pieces_for_group', 10)
    
    def validate(self, group: SpliceGroup) -> RuleResult:
        potteries = group.get_potteries()
        count = len(potteries)
        
        issues = []
        
        if count < self.min_size:
            issues.append(self.create_issue_dict(
                title=f'拼接组陶片数量不足',
                description=f'拼接组 {group.group_id} 仅有 {count} 片陶片，少于最少要求的 {self.min_size} 片',
                group_id=group.group_id,
                related_entity='group',
                related_entity_id=group.group_id,
                details={
                    'current_count': count,
                    'min_required': self.min_size,
                    'max_allowed': self.max_size
                }
            ))
        
        if count > self.max_size:
            issues.append(self.create_issue_dict(
                title=f'拼接组陶片数量过多',
                description=f'拼接组 {group.group_id} 有 {count} 片陶片，超过建议的 {self.max_size} 片',
                group_id=group.group_id,
                related_entity='group',
                related_entity_id=group.group_id,
                details={
                    'current_count': count,
                    'min_required': self.min_size,
                    'max_allowed': self.max_size
                }
            ))
        
        return RuleResult(
            passed=len(issues) == 0,
            issues=issues,
            metadata={
                'current_count': count,
                'min_size': self.min_size,
                'max_size': self.max_size
            }
        )


class RuleEngine:
    def __init__(self):
        self.rules: Dict[str, BaseRule] = {}
        self._register_default_rules()
    
    def _register_default_rules(self):
        self.register_rule(TrenchLayerConsistencyRule())
        self.register_rule(EdgeSizeRule())
        self.register_rule(TagConflictRule())
        self.register_rule(PhotoMissingRule())
        self.register_rule(GroupClosureRule())
        self.register_rule(DuplicateReferenceRule())
        self.register_rule(GroupSizeRule())
    
    def register_rule(self, rule: BaseRule):
        self.rules[rule.rule_name] = rule
    
    def get_rule(self, rule_name: str) -> Optional[BaseRule]:
        return self.rules.get(rule_name)
    
    def validate_pottery(self, pottery: Pottery, 
                         all_groups: Optional[List[SpliceGroup]] = None,
                         rule_names: Optional[List[str]] = None) -> RuleResult:
        all_issues = []
        all_warnings = []
        all_metadata = {}
        
        rules_to_run = self._get_rules_to_run(rule_names)
        
        for rule_name, rule in rules_to_run.items():
            try:
                if isinstance(rule, PhotoMissingRule):
                    result = rule.validate(pottery)
                    all_issues.extend(result.issues)
                    all_warnings.extend(result.warnings)
                    all_metadata[rule_name] = result.metadata
                
                elif isinstance(rule, DuplicateReferenceRule) and all_groups is not None:
                    result = rule.validate(pottery, all_groups)
                    all_issues.extend(result.issues)
                    all_warnings.extend(result.warnings)
                    all_metadata[rule_name] = result.metadata
                    
            except Exception as e:
                all_warnings.append(f"规则 {rule_name} 执行出错: {str(e)}")
        
        return RuleResult(
            passed=len(all_issues) == 0,
            issues=all_issues,
            warnings=all_warnings,
            metadata=all_metadata
        )
    
    def validate_group(self, group: SpliceGroup,
                       rule_names: Optional[List[str]] = None) -> RuleResult:
        all_issues = []
        all_warnings = []
        all_metadata = {}
        
        rules_to_run = self._get_rules_to_run(rule_names)
        
        for rule_name, rule in rules_to_run.items():
            try:
                if isinstance(rule, TrenchLayerConsistencyRule):
                    result = rule.validate(group)
                    all_issues.extend(result.issues)
                    all_warnings.extend(result.warnings)
                    all_metadata[rule_name] = result.metadata
                
                elif isinstance(rule, EdgeSizeRule):
                    result = rule.validate_group(group)
                    all_issues.extend(result.issues)
                    all_warnings.extend(result.warnings)
                    all_metadata[rule_name] = result.metadata
                
                elif isinstance(rule, TagConflictRule):
                    result = rule.validate(group)
                    all_issues.extend(result.issues)
                    all_warnings.extend(result.warnings)
                    all_metadata[rule_name] = result.metadata
                
                elif isinstance(rule, PhotoMissingRule):
                    result = rule.validate_group(group)
                    all_issues.extend(result.issues)
                    all_warnings.extend(result.warnings)
                    all_metadata[rule_name] = result.metadata
                
                elif isinstance(rule, GroupClosureRule):
                    result = rule.validate(group)
                    all_issues.extend(result.issues)
                    all_warnings.extend(result.warnings)
                    all_metadata[rule_name] = result.metadata
                
                elif isinstance(rule, GroupSizeRule):
                    result = rule.validate(group)
                    all_issues.extend(result.issues)
                    all_warnings.extend(result.warnings)
                    all_metadata[rule_name] = result.metadata
                    
            except Exception as e:
                all_warnings.append(f"规则 {rule_name} 执行出错: {str(e)}")
        
        return RuleResult(
            passed=len(all_issues) == 0,
            issues=all_issues,
            warnings=all_warnings,
            metadata=all_metadata
        )
    
    def validate_all(self, potteries: List[Pottery], 
                     groups: List[SpliceGroup],
                     rule_names: Optional[List[str]] = None) -> Dict[str, Any]:
        results = {
            'pottery_results': {},
            'group_results': {},
            'summary': {
                'total_potteries': len(potteries),
                'total_groups': len(groups),
                'potteries_with_issues': 0,
                'groups_with_issues': 0,
                'total_issues': 0,
                'severity_counts': {
                    'critical': 0,
                    'high': 0,
                    'medium': 0,
                    'low': 0,
                    'warning': 0
                }
            }
        }
        
        all_issues = []
        
        for pottery in potteries:
            result = self.validate_pottery(pottery, groups, rule_names)
            results['pottery_results'][pottery.pottery_id] = result.to_dict()
            
            if result.issues:
                results['summary']['potteries_with_issues'] += 1
                all_issues.extend(result.issues)
        
        for group in groups:
            result = self.validate_group(group, rule_names)
            results['group_results'][group.group_id] = result.to_dict()
            
            if result.issues:
                results['summary']['groups_with_issues'] += 1
                all_issues.extend(result.issues)
        
        results['summary']['total_issues'] = len(all_issues)
        
        for issue in all_issues:
            severity = issue.get('severity', 'warning')
            if severity in results['summary']['severity_counts']:
                results['summary']['severity_counts'][severity] += 1
        
        return results
    
    def _get_rules_to_run(self, rule_names: Optional[List[str]]) -> Dict[str, BaseRule]:
        if rule_names is None:
            return self.rules.copy()
        
        return {
            name: rule for name, rule in self.rules.items()
            if name in rule_names
        }
    
    def list_rules(self) -> List[Dict[str, Any]]:
        return [
            {
                'name': rule.rule_name,
                'description': rule.description,
                'severity': rule.severity.value,
                'issue_type': rule.issue_type.value
            }
            for rule in self.rules.values()
        ]
