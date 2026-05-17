from typing import List, Dict, Set, Tuple, Any
from collections import defaultdict
from dataclasses import dataclass
from utils import Lead, normalize_phone, normalize_email, normalize_company, calculate_similarity, SOURCE_PRIORITY


@dataclass
class DuplicateGroup:
    group_id: str
    primary_lead: Lead
    duplicate_leads: List[Lead]
    match_reason: str
    match_score: float
    merge_suggestion: Dict[str, Any] = None


@dataclass
class DeduplicationResult:
    unique_leads: List[Lead]
    duplicate_groups: List[DuplicateGroup]
    total_input: int
    total_unique: int
    total_duplicates: int


class LeadDeduplicator:
    def __init__(self, phone_threshold: float = 0.9, 
                 email_threshold: float = 0.9, 
                 company_threshold: float = 0.8,
                 company_email_combined_threshold: float = 0.75):
        self.phone_threshold = phone_threshold
        self.email_threshold = email_threshold
        self.company_threshold = company_threshold
        self.company_email_combined_threshold = company_email_combined_threshold
        
    def _get_source_priority(self, source: str) -> int:
        return SOURCE_PRIORITY.get(source, 999)
    
    def _select_primary_lead(self, leads: List[Lead]) -> Lead:
        if not leads:
            return None
        
        sorted_leads = sorted(leads, key=lambda x: (
            self._get_source_priority(x.source),
            -len(x.phone or ''),
            -len(x.email or ''),
            -len(x.company or ''),
            x.id
        ))
        return sorted_leads[0]
    
    def _generate_merge_suggestion(self, primary: Lead, duplicates: List[Lead]) -> Dict[str, Any]:
        all_leads = [primary] + duplicates
        suggestion = {
            'phone': self._merge_field(all_leads, 'phone'),
            'email': self._merge_field(all_leads, 'email'),
            'company': self._merge_field(all_leads, 'company'),
            'name': self._merge_field(all_leads, 'name'),
            'sources': list(set(ld.source for ld in all_leads if ld.source)),
            'conflict_fields': [],
            'recommended_source': primary.source,
        }
        
        fields = ['phone', 'email', 'company', 'name']
        for field in fields:
            values = set(getattr(ld, field) for ld in all_leads if getattr(ld, field))
            if len(values) > 1:
                suggestion['conflict_fields'].append({
                    'field': field,
                    'values': list(values),
                    'primary_value': getattr(primary, field)
                })
        
        return suggestion
    
    def _merge_field(self, leads: List[Lead], field: str) -> str:
        values = [getattr(ld, field) for ld in leads if getattr(ld, field)]
        return values[0] if values else ''
    
    def _is_duplicate_by_phone(self, lead1: Lead, lead2: Lead) -> Tuple[bool, float]:
        p1 = normalize_phone(lead1.phone)
        p2 = normalize_phone(lead2.phone)
        
        if not p1 or not p2:
            return False, 0.0
        
        is_dup = p1 == p2
        score = 1.0 if is_dup else 0.0
        return is_dup, score
    
    def _is_duplicate_by_email(self, lead1: Lead, lead2: Lead) -> Tuple[bool, float]:
        e1 = normalize_email(lead1.email)
        e2 = normalize_email(lead2.email)
        
        if not e1 or not e2:
            return False, 0.0
        
        is_dup = e1 == e2
        score = 1.0 if is_dup else 0.0
        return is_dup, score
    
    def _is_duplicate_by_company_and_email(self, lead1: Lead, lead2: Lead) -> Tuple[bool, float]:
        c1 = normalize_company(lead1.company)
        c2 = normalize_company(lead2.company)
        e1 = normalize_email(lead1.email)
        e2 = normalize_email(lead2.email)
        
        phone1 = normalize_phone(lead1.phone)
        phone2 = normalize_phone(lead2.phone)
        if phone1 and phone2 and phone1 == phone2:
            return False, 0.0
        if e1 and e2 and e1 == e2:
            return False, 0.0
        
        if not c1 or not c2:
            return False, 0.0
        if not e1 or not e2:
            return False, 0.0
        
        if c1 == c2:
            company_score = 1.0
        else:
            company_score = calculate_similarity(c1, c2)
            if company_score < self.company_threshold:
                return False, company_score
        
        email_prefix1 = e1.split('@')[0] if '@' in e1 else e1
        email_prefix2 = e2.split('@')[0] if '@' in e2 else e2
        email_prefix_score = calculate_similarity(email_prefix1, email_prefix2)
        
        combined_score = (company_score * 0.6) + (email_prefix_score * 0.4)
        
        return combined_score >= self.company_email_combined_threshold, combined_score
    
    def deduplicate(self, leads: List[Lead]) -> DeduplicationResult:
        if not leads:
            return DeduplicationResult(
                unique_leads=[],
                duplicate_groups=[],
                total_input=0,
                total_unique=0,
                total_duplicates=0
            )
        
        duplicate_groups: List[DuplicateGroup] = []
        lead_groups: List[List[Lead]] = []
        assigned: Set[int] = set()
        
        for i, lead in enumerate(leads):
            if i in assigned:
                continue
            
            group = [lead]
            assigned.add(i)
            
            for j, other in enumerate(leads):
                if j in assigned or j == i:
                    continue
                
                is_dup_phone, score_phone = self._is_duplicate_by_phone(lead, other)
                if is_dup_phone:
                    group.append(other)
                    assigned.add(j)
                    continue
                
                is_dup_email, score_email = self._is_duplicate_by_email(lead, other)
                if is_dup_email:
                    group.append(other)
                    assigned.add(j)
                    continue
                
                is_dup_company_email, score_ce = self._is_duplicate_by_company_and_email(lead, other)
                if is_dup_company_email:
                    group.append(other)
                    assigned.add(j)
                    continue
            
            lead_groups.append(group)
        
        unique_leads: List[Lead] = []
        for idx, group in enumerate(lead_groups):
            if len(group) == 1:
                unique_leads.append(group[0])
            else:
                primary = self._select_primary_lead(group)
                duplicates = [ld for ld in group if ld.id != primary.id]
                
                match_reason, match_score = self._get_match_reason(group)
                
                dup_group = DuplicateGroup(
                    group_id=f"GROUP_{idx:04d}",
                    primary_lead=primary,
                    duplicate_leads=duplicates,
                    match_reason=match_reason,
                    match_score=match_score,
                    merge_suggestion=self._generate_merge_suggestion(primary, duplicates)
                )
                duplicate_groups.append(dup_group)
                unique_leads.append(primary)
        
        return DeduplicationResult(
            unique_leads=unique_leads,
            duplicate_groups=duplicate_groups,
            total_input=len(leads),
            total_unique=len(unique_leads),
            total_duplicates=len(leads) - len(unique_leads)
        )
    
    def _get_match_reason(self, group: List[Lead]) -> Tuple[str, float]:
        primary = group[0]
        max_score = 0.0
        reason = []
        
        for other in group[1:]:
            is_dup_phone, score_phone = self._is_duplicate_by_phone(primary, other)
            if is_dup_phone:
                if '手机号' not in reason:
                    reason.append('手机号')
                max_score = max(max_score, score_phone)
            
            is_dup_email, score_email = self._is_duplicate_by_email(primary, other)
            if is_dup_email:
                if '邮箱' not in reason:
                    reason.append('邮箱')
                max_score = max(max_score, score_email)
            
            is_dup_ce, score_ce = self._is_duplicate_by_company_and_email(primary, other)
            if is_dup_ce:
                if '公司名+邮箱前缀' not in reason:
                    reason.append('公司名+邮箱前缀')
                max_score = max(max_score, score_ce)
        
        if not reason:
            reason = ['多维度匹配']
        
        return ' + '.join(reason), max_score
