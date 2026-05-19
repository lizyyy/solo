import re
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from database import (
    ChangeLog, ModuleTag, Interface, RiskWordMatch, CustomerImpact,
    RiskWordLibrary, RiskLevel, ProcessingStatus
)


class MarkdownParser:
    HEADING_PATTERN = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    LIST_PATTERN = re.compile(r'^[-*+]\s+(.+)$', re.MULTILINE)
    INTERFACE_PATTERN = re.compile(r'(GET|POST|PUT|DELETE|PATCH)\s+(/[\w/{}_-]+)', re.IGNORECASE)
    VERSION_PATTERN = re.compile(r'v?\d+\.\d+\.\d+', re.IGNORECASE)
    
    @classmethod
    def parse_headings(cls, content: str) -> List[Tuple[int, str]]:
        return [(len(match[0]), match[1].strip()) for match in cls.HEADING_PATTERN.findall(content)]
    
    @classmethod
    def parse_list_items(cls, content: str) -> List[str]:
        return [item.strip() for item in cls.LIST_PATTERN.findall(content)]
    
    @classmethod
    def extract_interfaces(cls, content: str) -> List[Dict]:
        interfaces = []
        for match in cls.INTERFACE_PATTERN.finditer(content):
            method = match.group(1).upper()
            path = match.group(2)
            start = max(0, match.start() - 100)
            end = min(len(content), match.end() + 100)
            context = content[start:end]
            
            interfaces.append({
                'method': method,
                'path': path,
                'name': f"{method} {path}",
                'context': context
            })
        return interfaces
    
    @classmethod
    def extract_version(cls, content: str) -> Optional[str]:
        match = cls.VERSION_PATTERN.search(content)
        return match.group(0) if match else None


class TagExtractor:
    MODULE_KEYWORDS = {
        '用户': ['用户', 'user', 'account', '登录', '注册', 'auth'],
        '订单': ['订单', 'order', '支付', 'payment', '结算'],
        '商品': ['商品', 'product', 'goods', 'sku', '库存'],
        '营销': ['营销', 'marketing', '促销', 'coupon', '优惠券'],
        '报表': ['报表', 'report', '统计', 'analytics', '数据'],
        '系统': ['系统', 'system', 'admin', '配置', 'config'],
        'API': ['api', '接口', 'endpoint', 'rest'],
        '性能': ['性能', 'performance', '优化', '速度', '延迟'],
        '安全': ['安全', 'security', '权限', 'permission', '加密'],
        '兼容性': ['兼容', 'compatibility', '废弃', 'deprecate']
    }
    
    @classmethod
    def extract_tags(cls, content: str) -> List[Dict]:
        tags = []
        content_lower = content.lower()
        
        for module, keywords in cls.MODULE_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in content_lower:
                    tags.append({
                        'tag_name': module,
                        'confidence': 80,
                        'source': 'keyword_match'
                    })
                    break
        
        return tags


class RiskAnalyzer:
    @staticmethod
    def calculate_risk_level(risk_words: List[Dict]) -> RiskLevel:
        if not risk_words:
            return RiskLevel.LOW
        
        max_risk = RiskLevel.LOW
        risk_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]
        
        for rw in risk_words:
            level = rw.get('risk_level', RiskLevel.LOW)
            if risk_order.index(level) > risk_order.index(max_risk):
                max_risk = level
        
        return max_risk
    
    @staticmethod
    def needs_human_review(risk_level: RiskLevel, risk_words_count: int, interfaces_count: int) -> bool:
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            return True
        if interfaces_count > 5:
            return True
        if risk_words_count > 10:
            return True
        return False


class CustomerImpactAnalyzer:
    CUSTOMER_SEGMENTS = ['全部客户', 'VIP客户', '企业客户', '开发者', '第三方合作方', '内部系统']
    
    IMPACT_RULES = {
        'CRITICAL': {
            'segments': ['全部客户'],
            'action_required': True,
            'description': '关键功能变更，可能影响业务流程，建议立即关注'
        },
        'HIGH': {
            'segments': ['全部客户', '开发者'],
            'action_required': True,
            'description': '重要功能变更，建议评估影响'
        },
        'MEDIUM': {
            'segments': ['开发者'],
            'action_required': False,
            'description': '一般变更，建议关注'
        },
        'LOW': {
            'segments': ['内部系统'],
            'action_required': False,
            'description': '常规更新，无特别影响'
        }
    }
    
    @classmethod
    def analyze_impact(cls, risk_level: RiskLevel, tags: List[str], interfaces: List[Dict]) -> List[Dict]:
        impacts = []
        rule = cls.IMPACT_RULES.get(risk_level.value.upper(), cls.IMPACT_RULES['LOW'])
        
        for segment in rule['segments']:
            affected_features = ', '.join(tags) if tags else '系统功能'
            affected_interfaces = ', '.join([i['name'] for i in interfaces[:5]]) if interfaces else '无'
            
            impacts.append({
                'customer_segment': segment,
                'impact_description': rule['description'],
                'affected_features': affected_features,
                'action_required': rule['action_required'],
                'action_description': '请评估变更对业务的影响并制定相应方案' if rule['action_required'] else ''
            })
        
        return impacts


class ChangeLogProcessor:
    def __init__(self, db: Session):
        self.db = db
    
    def _extract_risk_words(self, content: str) -> List[Dict]:
        risk_words = self.db.query(RiskWordLibrary).filter_by(is_active=True).all()
        matches = []
        
        for rw in risk_words:
            pattern = re.compile(re.escape(rw.word), re.IGNORECASE)
            for match in pattern.finditer(content):
                start = max(0, match.start() - 50)
                end = min(len(content), match.end() + 50)
                context = content[start:end]
                
                matches.append({
                    'word': rw.word,
                    'risk_level': rw.risk_level,
                    'context': context,
                    'position': match.start()
                })
        
        return matches
    
    def process_changelog(self, changelog_id: int) -> ChangeLog:
        changelog = self.db.query(ChangeLog).filter_by(id=changelog_id).first()
        if not changelog:
            raise ValueError(f"ChangeLog {changelog_id} not found")
        
        if changelog.status in [ProcessingStatus.PROCESSED, ProcessingStatus.NEEDS_REVIEW]:
            raise ValueError(f"ChangeLog {changelog_id} already processed")
        
        changelog.status = ProcessingStatus.PROCESSING
        self.db.commit()
        
        try:
            content = changelog.content
            
            version = MarkdownParser.extract_version(content)
            if version and not changelog.version:
                changelog.version = version
            
            interfaces_data = MarkdownParser.extract_interfaces(content)
            for iface_data in interfaces_data:
                interface = Interface(
                    changelog_id=changelog.id,
                    interface_name=iface_data['name'],
                    method=iface_data['method'],
                    path=iface_data['path'],
                    description=iface_data['context']
                )
                self.db.add(interface)
            
            tags_data = TagExtractor.extract_tags(content)
            for tag_data in tags_data:
                tag = ModuleTag(
                    changelog_id=changelog.id,
                    tag_name=tag_data['tag_name'],
                    confidence=tag_data['confidence'],
                    source=tag_data['source']
                )
                self.db.add(tag)
            
            risk_words_data = self._extract_risk_words(content)
            for rw_data in risk_words_data:
                rw_match = RiskWordMatch(
                    changelog_id=changelog.id,
                    word=rw_data['word'],
                    risk_level=rw_data['risk_level'],
                    context=rw_data['context'],
                    position=rw_data['position']
                )
                self.db.add(rw_match)
            
            risk_level = RiskAnalyzer.calculate_risk_level(risk_words_data)
            changelog.risk_level = risk_level
            
            tag_names = [t['tag_name'] for t in tags_data]
            impacts_data = CustomerImpactAnalyzer.analyze_impact(risk_level, tag_names, interfaces_data)
            for impact_data in impacts_data:
                impact = CustomerImpact(
                    changelog_id=changelog.id,
                    customer_segment=impact_data['customer_segment'],
                    impact_description=impact_data['impact_description'],
                    affected_features=impact_data['affected_features'],
                    action_required=impact_data['action_required'],
                    action_description=impact_data['action_description']
                )
                self.db.add(impact)
            
            needs_review = RiskAnalyzer.needs_human_review(
                risk_level, len(risk_words_data), len(interfaces_data)
            )
            changelog.needs_human_review = needs_review
            
            if needs_review:
                changelog.status = ProcessingStatus.NEEDS_REVIEW
                changelog.review_notes = "自动检测到高风险或复杂变更，需要人工复核"
            else:
                changelog.status = ProcessingStatus.PROCESSED
            
            self.db.commit()
            self.db.refresh(changelog)
            
            return changelog
            
        except Exception as e:
            changelog.status = ProcessingStatus.ERROR
            changelog.review_notes = f"处理失败: {str(e)}"
            self.db.commit()
            raise


class ExportService:
    @staticmethod
    def export_to_dict(changelog: ChangeLog) -> Dict:
        return {
            'id': changelog.id,
            'title': changelog.title,
            'version': changelog.version,
            'release_date': changelog.release_date.isoformat() if changelog.release_date else None,
            'status': changelog.status.value,
            'risk_level': changelog.risk_level.value,
            'needs_human_review': changelog.needs_human_review,
            'review_notes': changelog.review_notes,
            'tags': [{'tag_name': t.tag_name, 'confidence': t.confidence} for t in changelog.tags],
            'interfaces': [
                {
                    'name': i.interface_name,
                    'method': i.method,
                    'path': i.path,
                    'description': i.description
                } for i in changelog.interfaces
            ],
            'customer_impacts': [
                {
                    'segment': c.customer_segment,
                    'description': c.impact_description,
                    'affected_features': c.affected_features,
                    'action_required': c.action_required,
                    'action_description': c.action_description
                } for c in changelog.customer_impacts
            ],
            'risk_words': [
                {
                    'word': r.word,
                    'risk_level': r.risk_level.value,
                    'context': r.context
                } for r in changelog.risk_words
            ],
            'processed_at': changelog.updated_at.isoformat()
        }
    
    @staticmethod
    def export_list(changelogs: List[ChangeLog]) -> List[Dict]:
        return [ExportService.export_to_dict(c) for c in changelogs]
