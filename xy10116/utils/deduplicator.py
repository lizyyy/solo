import re
from typing import List, Dict, Tuple, Optional
from fuzzywuzzy import fuzz
from fuzzywuzzy import process


class ResumeDeduplicator:
    def __init__(self):
        self.weights = {
            'id_number': 100,
            'phone': 60,
            'email': 50,
            'name': 35,
            'birth_date': 40,
            'school': 25,
            'address': 20,
            'current_company': 25,
            'work_years': 15,
            'major': 15,
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
    
    def compare_names(self, name1: str, name2: str) -> float:
        name1_clean = self.clean_name(name1)
        name2_clean = self.clean_name(name2)
        
        if not name1_clean or not name2_clean:
            return 0
        
        if name1_clean == name2_clean:
            return 100
        
        ratio = fuzz.ratio(name1_clean, name2_clean)
        if ratio >= 80:
            return ratio
        
        token_ratio = fuzz.token_sort_ratio(name1_clean, name2_clean)
        return token_ratio
    
    def compare_phones(self, phone1: str, phone2: str) -> float:
        phone1_clean = self.clean_phone(phone1)
        phone2_clean = self.clean_phone(phone2)
        
        if not phone1_clean or not phone2_clean:
            return 0
        
        if phone1_clean == phone2_clean:
            return 100
        
        if len(phone1_clean) >= 7 and len(phone2_clean) >= 7:
            if phone1_clean[-7:] == phone2_clean[-7:]:
                return 90
        
        return 0
    
    def compare_emails(self, email1: str, email2: str) -> float:
        email1_clean = self.clean_email(email1)
        email2_clean = self.clean_email(email2)
        
        if not email1_clean or not email2_clean:
            return 0
        
        if email1_clean == email2_clean:
            return 100
        
        local1 = email1_clean.split('@')[0] if '@' in email1_clean else email1_clean
        local2 = email2_clean.split('@')[0] if '@' in email2_clean else email2_clean
        
        if local1 == local2:
            return 70
        
        return 0
    
    def compare_id_numbers(self, id1: str, id2: str) -> float:
        id1_norm = self.normalize_id_number(id1)
        id2_norm = self.normalize_id_number(id2)
        
        if not id1_norm or not id2_norm:
            return 0
        
        if id1_norm == id2_norm:
            return 100
        
        if len(id1_norm) >= 8 and len(id2_norm) >= 8:
            if id1_norm[6:14] == id2_norm[6:14]:
                return 50
        
        return 0
    
    def compare_birth_dates(self, date1: str, date2: str) -> float:
        date1_norm = self.normalize_birth_date(date1)
        date2_norm = self.normalize_birth_date(date2)
        
        if not date1_norm or not date2_norm:
            return 0
        
        if date1_norm == date2_norm:
            return 100
        
        return 0
    
    def compare_fields(self, field1: str, field2: str, threshold: int = 85) -> float:
        if not field1 or not field2:
            return 0
        
        field1_clean = str(field1).strip().lower()
        field2_clean = str(field2).strip().lower()
        
        if field1_clean == field2_clean:
            return 100
        
        ratio = fuzz.ratio(field1_clean, field2_clean)
        return ratio if ratio >= threshold else 0
    
    def calculate_similarity(self, resume1: Dict, resume2: Dict) -> Tuple[float, List[str], str]:
        scores = {}
        matched_fields = []
        reasons = []
        
        id_score = self.compare_id_numbers(
            resume1.get('id_number', ''),
            resume2.get('id_number', '')
        )
        if id_score > 0:
            scores['id_number'] = id_score
            matched_fields.append('id_number')
            if id_score >= 100:
                reasons.append('身份证号完全匹配')
            elif id_score >= 50:
                reasons.append('身份证出生日期匹配')
        
        phone_score = self.compare_phones(
            resume1.get('phone', ''),
            resume2.get('phone', '')
        )
        if phone_score > 0:
            scores['phone'] = phone_score
            matched_fields.append('phone')
            if phone_score >= 100:
                reasons.append('手机号完全匹配')
            elif phone_score >= 90:
                reasons.append('手机号后7位匹配')
        
        email_score = self.compare_emails(
            resume1.get('email', ''),
            resume2.get('email', '')
        )
        if email_score > 0:
            scores['email'] = email_score
            matched_fields.append('email')
            if email_score >= 100:
                reasons.append('邮箱完全匹配')
            elif email_score >= 70:
                reasons.append('邮箱用户名相同')
        
        name_score = self.compare_names(
            resume1.get('name', ''),
            resume2.get('name', '')
        )
        if name_score > 0:
            scores['name'] = name_score
            matched_fields.append('name')
            if name_score >= 95:
                reasons.append('姓名高度相似')
            elif name_score >= 80:
                reasons.append('姓名相似')
        
        birth_score = self.compare_birth_dates(
            resume1.get('birth_date', ''),
            resume2.get('birth_date', '')
        )
        if birth_score > 0:
            scores['birth_date'] = birth_score
            matched_fields.append('birth_date')
            reasons.append('出生日期匹配')
        
        school_score = self.compare_fields(
            resume1.get('school', ''),
            resume2.get('school', ''),
            threshold=80
        )
        if school_score > 0:
            scores['school'] = school_score
            matched_fields.append('school')
            reasons.append('毕业院校匹配')
        
        company_score = self.compare_fields(
            resume1.get('current_company', ''),
            resume2.get('current_company', ''),
            threshold=80
        )
        if company_score > 0:
            scores['current_company'] = company_score
            matched_fields.append('current_company')
            reasons.append('当前公司匹配')
        
        address_score = self.compare_fields(
            resume1.get('address', ''),
            resume2.get('address', ''),
            threshold=75
        )
        if address_score > 0:
            scores['address'] = address_score
            matched_fields.append('address')
            reasons.append('住址相似')
        
        total_score = 0
        total_weight = 0
        
        for field, score in scores.items():
            weight = self.weights.get(field, 10)
            total_score += score * weight
            total_weight += weight
        
        final_score = total_score / total_weight if total_weight > 0 else 0
        reason_text = '; '.join(reasons) if reasons else '未发现明显匹配字段'
        
        return final_score, matched_fields, reason_text
    
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
                
                score, matched_fields, reason = self.calculate_similarity(resume1, resume2)
                
                if score >= min_score:
                    risk_level = self.determine_risk_level(score)
                    
                    auto_label = 'duplicate' if risk_level == 'high' else 'potential' if risk_level == 'medium' else None
                    
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
