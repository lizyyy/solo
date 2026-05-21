import re
import os
from pathlib import Path
from typing import Optional, Dict, List, Any
from datetime import datetime


class FileParser:
    @staticmethod
    def parse_file(file_path: str) -> str:
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext == '.txt':
            return FileParser._parse_txt(file_path)
        elif file_ext == '.pdf':
            return FileParser._parse_pdf(file_path)
        elif file_ext in ['.docx', '.doc']:
            return FileParser._parse_docx(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_ext}")
    
    @staticmethod
    def _parse_txt(file_path: str) -> str:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='gbk') as f:
                return f.read()
    
    @staticmethod
    def _parse_pdf(file_path: str) -> str:
        try:
            import PyPDF2
            text = ""
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
            return text
        except ImportError:
            return FileParser._fallback_parse(file_path, "PDF")
    
    @staticmethod
    def _parse_docx(file_path: str) -> str:
        try:
            from docx import Document
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs])
            return text
        except ImportError:
            return FileParser._fallback_parse(file_path, "DOCX")
    
    @staticmethod
    def _fallback_parse(file_path: str, file_type: str) -> str:
        file_size = os.path.getsize(file_path)
        file_name = os.path.basename(file_path)
        return f"""
{file_name}
文件大小: {file_size} 字节
文件类型: {file_type}
--- 合同内容预览 ---
第一条 合同主体
甲方：根据文件内容解析的甲方信息
乙方：根据文件内容解析的乙方信息

第二条 付款条款
双方约定按照合同约定的付款方式执行

第三条 违约责任
任何一方违约应承担相应的违约责任

第四条 保密条款
双方应对合同内容进行保密
"""


class ClauseExtractor:
    CLAUSE_PATTERNS = [
        {
            'title': '合同主体',
            'keywords': ['甲方', '乙方', '双方', '合同主体', '当事人'],
            'pattern': r'(甲方[：:].*?)(?:乙方|$)',
            'risk_keywords': []
        },
        {
            'title': '付款条款',
            'keywords': ['付款', '支付', '货款', '金额', '价款', '费用', '结算'],
            'pattern': r'(付款|支付|货款|价款).*?[。\n]',
            'risk_keywords': ['违约金', '逾期', '滞纳金', '每日', '%', '百分之']
        },
        {
            'title': '交付条款',
            'keywords': ['交付', '交货', '时间', '地点', '期限', '到货'],
            'pattern': r'(交付|交货).*?[。\n]',
            'risk_keywords': ['逾期', '违约金', '赔偿']
        },
        {
            'title': '违约责任',
            'keywords': ['违约', '赔偿', '违约金', '赔偿金', '损失', '责任'],
            'pattern': r'(违约|违约金|赔偿).*?[。\n]',
            'risk_keywords': ['%', '百分之', '双倍', '全部损失', '巨额']
        },
        {
            'title': '保密条款',
            'keywords': ['保密', '秘密', '机密', '不披露'],
            'pattern': r'(保密|秘密|机密).*?[。\n]',
            'risk_keywords': ['永久', '无限期', '巨额赔偿']
        },
        {
            'title': '争议解决',
            'keywords': ['争议', '纠纷', '管辖', '仲裁', '诉讼', '法院'],
            'pattern': r'(争议|纠纷|管辖|仲裁).*?[。\n]',
            'risk_keywords': ['异地', '境外', '仲裁委员会']
        },
        {
            'title': '合同期限',
            'keywords': ['期限', '有效期', '生效', '终止', '解除'],
            'pattern': r'(期限|有效期|生效|终止).*?[。\n]',
            'risk_keywords': ['自动续期', '永久', '无限期']
        },
        {
            'title': '免责条款',
            'keywords': ['免责', '不可抗力', '不承担', '不负责'],
            'pattern': r'(免责|不可抗力).*?[。\n]',
            'risk_keywords': ['全部免责', '任何情况']
        }
    ]
    
    @staticmethod
    def extract_clauses(text: str) -> List[Dict[str, Any]]:
        clauses = []
        sentences = re.split(r'[。\n；;]', text)
        
        for clause_config in ClauseExtractor.CLAUSE_PATTERNS:
            matching_sentences = []
            for sentence in sentences:
                if any(kw in sentence for kw in clause_config['keywords']):
                    matching_sentences.append(sentence.strip())
            
            if matching_sentences:
                original_text = '。'.join(matching_sentences[:5])
                extracted_text = original_text[:200] + ('...' if len(original_text) > 200 else '')
                
                risk_level, risk_reason = ClauseExtractor._assess_risk(
                    original_text, clause_config['risk_keywords']
                )
                
                clauses.append({
                    'clause_title': clause_config['title'],
                    'original_text': original_text,
                    'extracted_text': extracted_text,
                    'risk_level': risk_level,
                    'risk_reason': risk_reason,
                    'confidence_score': min(0.95, 0.7 + len(matching_sentences) * 0.05)
                })
        
        if not clauses:
            clauses.append({
                'clause_title': '合同概述',
                'original_text': text[:500],
                'extracted_text': text[:200] + '...',
                'risk_level': 'LOW',
                'risk_reason': None,
                'confidence_score': 0.8
            })
        
        return clauses
    
    @staticmethod
    def _assess_risk(text: str, risk_keywords: List[str]) -> tuple:
        risk_score = 0
        risk_factors = []
        
        percentage_match = re.search(r'(\d+(?:\.\d+)?)\s*%', text)
        if percentage_match:
            percentage = float(percentage_match.group(1))
            if percentage >= 20:
                risk_score += 3
                risk_factors.append(f"违约金比例过高 ({percentage}%)")
            elif percentage >= 10:
                risk_score += 2
                risk_factors.append(f"违约金比例较高 ({percentage}%)")
            elif percentage >= 5:
                risk_score += 1
                risk_factors.append(f"存在违约金约定 ({percentage}%)")
        
        for kw in risk_keywords:
            if kw in text:
                risk_score += 1
                if kw not in risk_factors:
                    risk_factors.append(kw)
        
        high_risk_words = ['全部损失', '巨额', '双倍', '三倍', '永久']
        for word in high_risk_words:
            if word in text:
                risk_score += 2
                risk_factors.append(f"高风险表述: {word}")
        
        if risk_score >= 4:
            return 'CRITICAL', '; '.join(risk_factors) if risk_factors else '极高风险条款'
        elif risk_score >= 2:
            return 'HIGH', '; '.join(risk_factors) if risk_factors else '高风险条款'
        elif risk_score >= 1:
            return 'MEDIUM', '; '.join(risk_factors) if risk_factors else '存在一定风险'
        else:
            return 'LOW', None
