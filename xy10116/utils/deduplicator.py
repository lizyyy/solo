import re
from typing import List, Dict, Tuple, Optional
from fuzzywuzzy import fuzz
from fuzzywuzzy import process


class ResumeDeduplicator:
    def __init__(self):
        self.identity_fields = ['id_number', 'phone', 'email', 'name', 'birth_date']
        self.weak_fields = ['school', 'address', 'current_company', 'major', 'work_years']
        
        self.weights = {
            'id_number': 100,
            'phone': 60,
            'email': 50,
            'name': 40,
            'birth_date': 40,
            'school': 15,
            'address': 10,
            'current_company': 15,
            'work_years': 8,
            'major': 10,
        }
        
        self.thresholds = {
            'high': 80,
            'medium': 50,
            'low': 30,
        }
    
    def clean_phone(self, phone: str) -> str:
        if not phone:
            return ''
        return re.sub(r'[\s\-\+\(\)]', '', str(phone))
    
    def clean_email(self, email: str) -> str:
        if not email:
            return ''
        return str(email).strip().lower()
    
    def clean_name(self, name: str) -> str:
        if not name:
            return ''
        return str(name).strip().lower()
    
    def normalize_id_number(self, id_num: str) -> str:
        if not id_num:
            return ''
        id_str = str(id_num).strip()
        if len(id_str) == 18:
            return id_str[:17] + 'x' if id_str[17].lower() == 'x' else id_str
        return id_str
    
    def normalize_birth_date(self, date_str: str) -> str:
        if not date_str:
            return ''
        date_str = str(date_str).strip()
        date_str = re.sub(r'[年月./\-]', '', date_str)
        if len(date_str) >= 8:
            return date_str[:8]
        return date_str
    
    def compare_names(self, name1: str, name2: str) -> Dict:
        name1_clean = self.clean_name(name1)
        name2_clean = self.clean_name(name2)
        
        if not name1_clean or not name2_clean:
            return {'score': 0, 'level': 'none'}
        
        if name1_clean == name2_clean:
            return {'score': 100, 'level': 'exact'}
        
        ratio = fuzz.ratio(name1_clean, name2_clean)
        if ratio >= 95:
            return {'score': ratio, 'level': 'high'}
        if ratio >= 85:
            return {'score': ratio, 'level': 'medium'}
        
        token_ratio = fuzz.token_sort_ratio(name1_clean, name2_clean)
        if token_ratio >= 90:
            return {'score': token_ratio, 'level': 'medium'}
        
        return {'score': 0, 'level': 'none'}
    
    def compare_phones(self, phone1: str, phone2: str) -> Dict:
        phone1_clean = self.clean_phone(phone1)
        phone2_clean = self.clean_phone(phone2)
        
        if not phone1_clean or not phone2_clean:
            return {'score': 0, 'level': 'none'}
        
        if phone1_clean == phone2_clean:
            return {'score': 100, 'level': 'exact'}
        
        if len(phone1_clean) >= 7 and len(phone2_clean) >= 7:
            if phone1_clean[-7:] == phone2_clean[-7:]:
                return {'score': 85, 'level': 'partial'}
        
        return {'score': 0, 'level': 'none'}
    
    def compare_emails(self, email1: str, email2: str) -> Dict:
        email1_clean = self.clean_email(email1)
        email2_clean = self.clean_email(email2)
        
        if not email1_clean or not email2_clean:
            return {'score': 0, 'level': 'none'}
        
        if email1_clean == email2_clean:
            return {'score': 100, 'level': 'exact'}
        
        local1 = email1_clean.split('@')[0] if '@' in email1_clean else email1_clean
        local2 = email2_clean.split('@')[0] if '@' in email2_clean else email2_clean
        
        if local1 == local2 and len(local1) >= 4:
            return {'score': 50, 'level': 'partial'}
        
        return {'score': 0, 'level': 'none'}
    
    def compare_id_numbers(self, id1: str, id2: str) -> Dict:
        id1_norm = self.normalize_id_number(id1)
        id2_norm = self.normalize_id_number(id2)
        
        if not id1_norm or not id2_norm:
            return {'score': 0, 'level': 'none'}
        
        if id1_norm == id2_norm:
            return {'score': 100, 'level': 'exact'}
        
        if len(id1_norm) >= 14 and len(id2_norm) >= 14:
            if id1_norm[6:14] == id2_norm[6:14]:
                return {'score': 30, 'level': 'partial'}
        
        return {'score': 0, 'level': 'none'}
    
    def compare_birth_dates(self, date1: str, date2: str) -> Dict:
        date1_norm = self.normalize_birth_date(date1)
        date2_norm = self.normalize_birth_date(date2)
        
        if not date1_norm or not date2_norm:
            return {'score': 0, 'level': 'none'}
        
        if date1_norm == date2_norm:
            return {'score': 100, 'level': 'exact'}
        
        return {'score': 0, 'level': 'none'}
    
    def compare_weak_fields(self, field1: str, field2: str, threshold: int = 85) -> Dict:
        if not field1 or not field2:
            return {'score': 0, 'level': 'none'}
        
        field1_clean = str(field1).strip().lower()
        field2_clean = str(field2).strip().lower()
        
        if field1_clean == field2_clean:
            return {'score': 100, 'level': 'exact'}
        
        ratio = fuzz.ratio(field1_clean, field2_clean)
        if ratio >= threshold:
            return {'score': ratio, 'level': 'partial'}
        
        return {'score': 0, 'level': 'none'}
    
    def _detect_exact_match_rules(self, identity_matches: Dict, weak_matches: Dict) -> Tuple[str, List[str], str]:
        id_match = identity_matches.get('id_number', {})
        phone_match = identity_matches.get('phone', {})
        email_match = identity_matches.get('email', {})
        name_match = identity_matches.get('name', {})
        birth_match = identity_matches.get('birth_date', {})
        
        reasons = []
        matched_fields = []
        
        if id_match.get('level') == 'exact':
            other_matches = [k for k in ['name', 'phone', 'email', 'birth_date'] 
                           if identity_matches.get(k, {}).get('level') in ['exact', 'high', 'medium']]
            weak_count = sum(1 for m in weak_matches.values() if m.get('level') in ['exact', 'partial'])
            
            if other_matches or weak_count >= 2:
                reasons.append('身份证号完全匹配')
                matched_fields.append('id_number')
                if name_match.get('level') in ['exact', 'high']:
                    reasons.append('姓名匹配')
                    matched_fields.append('name')
                for f in other_matches:
                    if f != 'name':
                        matched_fields.append(f)
                return 'high', matched_fields, '; '.join(reasons)
        
        if phone_match.get('level') == 'exact':
            if name_match.get('level') in ['exact', 'high'] or birth_match.get('level') == 'exact':
                reasons.append('手机号完全匹配')
                matched_fields.append('phone')
                if name_match.get('level') in ['exact', 'high']:
                    reasons.append('姓名匹配')
                    matched_fields.append('name')
                if birth_match.get('level') == 'exact':
                    reasons.append('出生日期匹配')
                    matched_fields.append('birth_date')
                return 'high', matched_fields, '; '.join(reasons)
        
        if email_match.get('level') == 'exact':
            if name_match.get('level') in ['exact', 'high'] or birth_match.get('level') == 'exact':
                reasons.append('邮箱完全匹配')
                matched_fields.append('email')
                if name_match.get('level') in ['exact', 'high']:
                    reasons.append('姓名匹配')
                    matched_fields.append('name')
                if birth_match.get('level') == 'exact':
                    reasons.append('出生日期匹配')
                    matched_fields.append('birth_date')
                return 'high', matched_fields, '; '.join(reasons)
        
        if name_match.get('level') == 'exact' and birth_match.get('level') == 'exact':
            reasons.append('姓名完全匹配')
            reasons.append('出生日期完全匹配')
            matched_fields.extend(['name', 'birth_date'])
            return 'high', matched_fields, '; '.join(reasons)
        
        if name_match.get('level') == 'exact':
            weak_count = sum(1 for m in weak_matches.values() if m.get('level') in ['exact', 'partial'])
            if weak_count >= 3:
                reasons.append('姓名完全匹配')
                reasons.append(f'弱关联字段匹配数: {weak_count}')
                matched_fields.append('name')
                return 'medium', matched_fields, '; '.join(reasons)
        
        return None, [], ''
    
    def _detect_partial_match_rules(self, identity_matches: Dict, weak_matches: Dict) -> Tuple[str, List[str], str]:
        phone_match = identity_matches.get('phone', {})
        email_match = identity_matches.get('email', {})
        name_match = identity_matches.get('name', {})
        birth_match = identity_matches.get('birth_date', {})
        
        reasons = []
        matched_fields = []
        
        if phone_match.get('level') == 'partial':
            weak_count = sum(1 for m in weak_matches.values() if m.get('level') in ['exact', 'partial'])
            if name_match.get('level') in ['exact', 'high', 'medium'] and weak_count >= 2:
                reasons.append('手机号部分匹配（后7位）')
                reasons.append('姓名相似')
                matched_fields.extend(['phone', 'name'])
                return 'medium', matched_fields, '; '.join(reasons)
        
        if email_match.get('level') == 'partial':
            if name_match.get('level') in ['exact', 'high']:
                reasons.append('邮箱用户名相同')
                reasons.append('姓名匹配')
                matched_fields.extend(['email', 'name'])
                return 'medium', matched_fields, '; '.join(reasons)
        
        if birth_match.get('level') == 'exact':
            weak_count = sum(1 for m in weak_matches.values() if m.get('level') in ['exact', 'partial'])
            if name_match.get('level') in ['medium', 'high'] or weak_count >= 3:
                reasons.append('出生日期匹配')
                if name_match.get('level') in ['medium', 'high']:
                    reasons.append('姓名相似')
                    matched_fields.append('name')
                matched_fields.append('birth_date')
                return 'medium', matched_fields, '; '.join(reasons)
        
        weak_exact_count = sum(1 for m in weak_matches.values() if m.get('level') == 'exact')
        weak_partial_count = sum(1 for m in weak_matches.values() if m.get('level') == 'partial')
        
        if weak_exact_count >= 4:
            weak_fields_list = [k for k, v in weak_matches.items() if v.get('level') == 'exact']
            reasons.append(f'多个弱字段完全匹配: {", ".join(weak_fields_list)}')
            matched_fields.extend(weak_fields_list)
            return 'medium', matched_fields, '; '.join(reasons)
        
        if weak_exact_count >= 2 and name_match.get('level') in ['medium', 'high']:
            reasons.append('姓名相似')
            reasons.append('多个弱字段匹配')
            matched_fields.append('name')
            return 'low', matched_fields, '; '.join(reasons)
        
        return None, [], ''
    
    def calculate_similarity(self, resume1: Dict, resume2: Dict) -> Tuple[float, List[str], str, str]:
        identity_matches = {}
        weak_matches = {}
        reasons = []
        matched_fields = []
        
        id_result = self.compare_id_numbers(
            resume1.get('id_number', ''),
            resume2.get('id_number', '')
        )
        if id_result['score'] > 0:
            identity_matches['id_number'] = id_result
        
        phone_result = self.compare_phones(
            resume1.get('phone', ''),
            resume2.get('phone', '')
        )
        if phone_result['score'] > 0:
            identity_matches['phone'] = phone_result
        
        email_result = self.compare_emails(
            resume1.get('email', ''),
            resume2.get('email', '')
        )
        if email_result['score'] > 0:
            identity_matches['email'] = email_result
        
        name_result = self.compare_names(
            resume1.get('name', ''),
            resume2.get('name', '')
        )
        if name_result['score'] > 0:
            identity_matches['name'] = name_result
        
        birth_result = self.compare_birth_dates(
            resume1.get('birth_date', ''),
            resume2.get('birth_date', '')
        )
        if birth_result['score'] > 0:
            identity_matches['birth_date'] = birth_result
        
        school_result = self.compare_weak_fields(
            resume1.get('school', ''),
            resume2.get('school', ''),
            threshold=85
        )
        if school_result['score'] > 0:
            weak_matches['school'] = school_result
        
        company_result = self.compare_weak_fields(
            resume1.get('current_company', ''),
            resume2.get('current_company', ''),
            threshold=85
        )
        if company_result['score'] > 0:
            weak_matches['current_company'] = company_result
        
        address_result = self.compare_weak_fields(
            resume1.get('address', ''),
            resume2.get('address', ''),
            threshold=80
        )
        if address_result['score'] > 0:
            weak_matches['address'] = address_result
        
        major_result = self.compare_weak_fields(
            resume1.get('major', ''),
            resume2.get('major', ''),
            threshold=80
        )
        if major_result['score'] > 0:
            weak_matches['major'] = major_result
        
        rule_result = self._detect_exact_match_rules(identity_matches, weak_matches)
        if rule_result[0]:
            risk_level, matched_fields, reason_text = rule_result
            
            total_score = 0
            total_weight = 0
            for field in matched_fields:
                score = identity_matches.get(field, {}).get('score', 0) or weak_matches.get(field, {}).get('score', 0)
                weight = self.weights.get(field, 10)
                total_score += score * weight
                total_weight += weight
            if total_weight > 0:
                final_score = total_score / total_weight
            else:
                final_score = 85 if risk_level == 'high' else 55
            
            return final_score, matched_fields, reason_text, risk_level
        
        rule_result = self._detect_partial_match_rules(identity_matches, weak_matches)
        if rule_result[0]:
            risk_level, matched_fields, reason_text = rule_result
            
            total_score = 0
            total_weight = 0
            for field in matched_fields:
                score = identity_matches.get(field, {}).get('score', 0) or weak_matches.get(field, {}).get('score', 0)
                weight = self.weights.get(field, 10)
                total_score += score * weight
                total_weight += weight
            if total_weight > 0:
                final_score = total_score / total_weight
            else:
                final_score = 55 if risk_level == 'medium' else 35
            
            return final_score, matched_fields, reason_text, risk_level
        
        all_matches = {**identity_matches, **weak_matches}
        if not all_matches:
            return 0, [], '未发现匹配字段', 'none'
        
        weak_field_count = len(weak_matches)
        identity_field_count = len(identity_matches)
        
        if identity_field_count == 0 and weak_field_count == 1:
            return 0, [], '未发现明显匹配字段', 'none'
        
        if identity_field_count == 0 and weak_field_count < 3:
            matched_fields = list(weak_matches.keys())
            reasons = []
            for wf in ['school', 'current_company', 'address', 'major']:
                if wf in weak_matches:
                    if wf == 'school':
                        reasons.append('毕业院校相似')
                    elif wf == 'current_company':
                        reasons.append('当前公司相似')
                    elif wf == 'address':
                        reasons.append('住址相似')
                    elif wf == 'major':
                        reasons.append('专业相似')
            return 20, matched_fields, '; '.join(reasons) + '（弱关联，仅作提醒）', 'none'
        
        total_score = 0
        total_weight = 0
        
        for field, match in all_matches.items():
            weight = self.weights.get(field, 10)
            effective_score = match['score']
            if field in self.weak_fields:
                effective_score = min(match['score'], 50)
            total_score += effective_score * weight
            total_weight += weight
        
        final_score = total_score / total_weight if total_weight > 0 else 0
        
        if final_score >= 40 or (identity_field_count > 0 and weak_field_count >= 1):
            matched_fields = list(all_matches.keys())
            reasons = []
            if identity_matches:
                if 'name' in identity_matches:
                    reasons.append('姓名相似')
            for wf in ['school', 'current_company', 'address', 'major']:
                if wf in weak_matches:
                    if wf == 'school':
                        reasons.append('毕业院校相似')
                    elif wf == 'current_company':
                        reasons.append('当前公司相似')
                    elif wf == 'address':
                        reasons.append('住址相似')
                    elif wf == 'major':
                        reasons.append('专业相似')
            
            reason_text = '; '.join(reasons) if reasons else '弱字段相似组合'
            return final_score, matched_fields, reason_text, 'low'
        
        return 0, [], '未发现明显匹配字段', 'none'
    
    def determine_risk_level(self, score: float) -> str:
        if score >= self.thresholds['high']:
            return 'high'
        elif score >= self.thresholds['medium']:
            return 'medium'
        elif score >= self.thresholds['low']:
            return 'low'
        return 'none'
    
    def detect_duplicates(
        self,
        resumes: List[Dict],
        existing_resumes: Optional[List[Dict]] = None,
        min_score: float = 30
    ) -> List[Dict]:
        results = []
        
        if existing_resumes:
            all_resumes = existing_resumes + resumes
        else:
            all_resumes = resumes
        
        resume_count = len(all_resumes)
        
        for i in range(resume_count):
            for j in range(i + 1, resume_count):
                resume1 = all_resumes[i]
                resume2 = all_resumes[j]
                
                if resume1.get('id') == resume2.get('id'):
                    continue
                
                score, matched_fields, reason, rule_risk = self.calculate_similarity(resume1, resume2)
                
                if score >= min_score or rule_risk in ['high', 'medium']:
                    risk_level = rule_risk if rule_risk in ['high', 'medium', 'low'] else self.determine_risk_level(score)
                    
                    if risk_level == 'none' and score < min_score:
                        continue
                    
                    if risk_level == 'high':
                        auto_label = 'duplicate'
                    elif risk_level == 'medium':
                        auto_label = 'potential'
                    else:
                        auto_label = None
                    
                    results.append({
                        'resume_id': resume1.get('id'),
                        'matched_resume_id': resume2.get('id'),
                        'score': score,
                        'risk_level': risk_level,
                        'matched_fields': matched_fields,
                        'risk_reason': reason,
                        'auto_label': auto_label,
                    })
        
        return results
