import os
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from pathlib import Path


@dataclass
class LabelRule:
    label_id: str
    display_name: str
    keywords: List[str]
    synonyms: List[str] = field(default_factory=list)
    patterns: List[str] = field(default_factory=list)
    exclude_keywords: List[str] = field(default_factory=list)
    priority: int = 0
    description: str = ""
    suggestion_template: str = ""
    estimated_time: str = "30分钟"
    difficulty: str = "medium"


@dataclass
class RulesConfig:
    labels: Dict[str, LabelRule]
    similarity_threshold: float = 0.6
    cluster_threshold: float = 0.7
    min_cluster_size: int = 2
    language: str = "zh"


@dataclass
class DictionaryConfig:
    stopwords: List[str] = field(default_factory=list)
    custom_words: List[str] = field(default_factory=list)
    essay_types: List[str] = field(default_factory=list)
    severity_levels: Dict[str, float] = field(default_factory=dict)


class ConfigLoader:
    DEFAULT_CONFIG_DIR = Path(__file__).parent.parent / "configs"

    def __init__(self, config_dir: Optional[Path] = None):
        self.config_dir = config_dir or self.DEFAULT_CONFIG_DIR
        self._rules: Optional[RulesConfig] = None
        self._dictionary: Optional[DictionaryConfig] = None

    def load_rules(self) -> RulesConfig:
        if self._rules is not None:
            return self._rules

        rules_file = self.config_dir / "rules.json"
        if not rules_file.exists():
            self._rules = self._get_default_rules()
            return self._rules

        with open(rules_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        labels = {}
        for label_id, label_data in data.get('labels', {}).items():
            labels[label_id] = LabelRule(
                label_id=label_id,
                display_name=label_data.get('display_name', label_id),
                keywords=label_data.get('keywords', []),
                synonyms=label_data.get('synonyms', []),
                patterns=label_data.get('patterns', []),
                exclude_keywords=label_data.get('exclude_keywords', []),
                priority=label_data.get('priority', 0),
                description=label_data.get('description', ''),
                suggestion_template=label_data.get('suggestion_template', ''),
                estimated_time=label_data.get('estimated_time', '30分钟'),
                difficulty=label_data.get('difficulty', 'medium')
            )

        self._rules = RulesConfig(
            labels=labels,
            similarity_threshold=data.get('similarity_threshold', 0.6),
            cluster_threshold=data.get('cluster_threshold', 0.7),
            min_cluster_size=data.get('min_cluster_size', 2),
            language=data.get('language', 'zh')
        )

        return self._rules

    def load_dictionary(self) -> DictionaryConfig:
        if self._dictionary is not None:
            return self._dictionary

        dict_file = self.config_dir / "dictionary.json"
        if not dict_file.exists():
            self._dictionary = self._get_default_dictionary()
            return self._dictionary

        with open(dict_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self._dictionary = DictionaryConfig(
            stopwords=data.get('stopwords', self._get_default_stopwords()),
            custom_words=data.get('custom_words', []),
            essay_types=data.get('essay_types', ['记叙文', '议论文', '说明文', '散文', '应用文']),
            severity_levels=data.get('severity_levels', {'high': 1.5, 'medium': 1.0, 'low': 0.5})
        )

        return self._dictionary

    @staticmethod
    def _get_default_stopwords() -> List[str]:
        return [
            '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
            '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
            '好', '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么',
            '老师', '学生', '作文', '文章', '写', '作', '了', '啊', '吗', '呢', '吧',
        ]

    @staticmethod
    def _get_default_rules() -> RulesConfig:
        labels = {
            'off_topic': LabelRule(
                label_id='off_topic',
                display_name='审题偏差',
                keywords=['审题', '偏题', '跑题', '离题', '偏离题意', '偏离中心', '中心不明确',
                          '主题不突出', '文不对题', '答非所问'],
                synonyms=['跑题了', '偏了', '没抓住中心', '中心偏离'],
                description='审题错误，文章内容与题目要求不符或偏离中心思想',
                suggestion_template='建议：1）仔细阅读题目要求，圈出关键词；2）写作前列出写作提纲，明确每段要表达的中心；3）写完后检查每段是否围绕主题展开',
                estimated_time='45分钟',
                difficulty='high',
                priority=5
            ),
            'structure_weak': LabelRule(
                label_id='structure_weak',
                display_name='结构松散',
                keywords=['结构', '段落', '层次', '逻辑', '衔接', '过渡', '结构散', '条理',
                          '段落不清', '逻辑混乱', '缺乏过渡', '衔接不自然', '结构不完整',
                          '缺少过渡', '缺少衔接', '层次不清'],
                synonyms=['结构乱', '没条理', '逻辑差', '段落乱'],
                description='文章结构不清晰，段落之间缺乏衔接，层次不分明',
                suggestion_template='建议：1）使用总分总、并列、递进等常见结构；2）每段开头使用中心句；3）注意段落间的过渡词语',
                estimated_time='30分钟',
                difficulty='medium',
                priority=4
            ),
            'evidence_insufficient': LabelRule(
                label_id='evidence_insufficient',
                display_name='证据不足',
                keywords=['证据', '论据', '例子', '事例', '引用', '材料', '内容空',
                          '论据不足', '缺乏例证', '例子不够', '论据薄弱', '论证不充分',
                          '缺少具体', '太笼统', '不够具体', '缺乏细节', '内容单薄'],
                synonyms=['没例子', '例子少', '论据弱', '内容空泛'],
                description='文章缺乏具体的事例、数据或引用，论证不够充分',
                suggestion_template='建议：1）积累名人名言、历史事例、数据统计等；2）每一个观点配一个具体的例子；3）引用原文或权威资料',
                estimated_time='40分钟',
                difficulty='medium',
                priority=4
            ),
            'grammar_error': LabelRule(
                label_id='grammar_error',
                display_name='语法错误',
                keywords=['语法', '病句', '句子', '语病', '不通顺', '表达', '句子不通',
                          '搭配不当', '成分残缺', '语序不当', '句式杂糅', '逻辑错误',
                          '表达不清', '语句不通'],
                synonyms=['句子错', '语法错', '不通顺', '读不懂'],
                description='存在语法错误，句子表达不通顺',
                suggestion_template='建议：1）学习基本句型结构（主谓宾、定状补）；2）写完后自己朗读检查；3）注意关联词、介词的使用',
                estimated_time='20分钟',
                difficulty='low',
                priority=3
            ),
            'expression_empty': LabelRule(
                label_id='expression_empty',
                display_name='表达空泛',
                keywords=['表达', '语言', '空洞', '空泛', '笼统', '抽象', '不具体',
                          '语言平淡', '缺乏文采', '语言贫乏', '词汇量少', '表达单一',
                          '缺少描写', '不够生动', '太抽象', '语言干巴'],
                synonyms=['没文采', '语言干', '写得空', '不生动'],
                description='语言表达不够生动形象，缺乏具体描写和文采',
                suggestion_template='建议：1）多积累好词好句；2）使用比喻、拟人、排比等修辞手法；3）增加细节描写',
                estimated_time='35分钟',
                difficulty='medium',
                priority=3
            ),
            'typo': LabelRule(
                label_id='typo',
                display_name='错别字',
                keywords=['错字', '别字', '错别字', '写错', '写错字', '写错了',
                          '形近字', '同音字', '书写错误'],
                synonyms=['写错字', '字错了', '错别字', '笔误'],
                description='存在错别字或书写错误',
                suggestion_template='建议：1）写完后仔细检查每一个字；2）注意形近字、同音字的区别；3）准备一个错别字本积累易错字',
                estimated_time='15分钟',
                difficulty='low',
                priority=2
            ),
            'logic_confusion': LabelRule(
                label_id='logic_confusion',
                display_name='逻辑混乱',
                keywords=['逻辑', '推理', '论证', '因果', '前后矛盾', '前后不一',
                          '推理不当', '因果关系', '逻辑不清', '思路混乱',
                          '前后不一致', '自相矛盾', '不合逻辑'],
                synonyms=['逻辑乱', '没道理', '说不通', '矛盾'],
                description='逻辑推理有问题，因果关系不明确，前后矛盾',
                suggestion_template='建议：1）写作前理清逻辑链条；2）注意因果关系的连接；3）检查前后观点是否一致',
                estimated_time='30分钟',
                difficulty='high',
                priority=4
            ),
            'material_inappropriate': LabelRule(
                label_id='material_inappropriate',
                display_name='选材不当',
                keywords=['选材', '材料', '选择', '例子不合适', '材料不当',
                          '例子不当', '材料陈旧', '例子老套',
                          '材料不典型', '例子不恰当'],
                synonyms=['选的不好', '例子不对', '材料老', '没新意'],
                description='选择的材料或例子不恰当、不典型或陈旧',
                suggestion_template='建议：1）选择新颖、典型的材料；2）材料要围绕中心；3）注意材料的时代感',
                estimated_time='25分钟',
                difficulty='medium',
                priority=3
            ),
            'beginning_ending_weak': LabelRule(
                label_id='beginning_ending_weak',
                display_name='开头结尾薄弱',
                keywords=['开头', '结尾', '开篇', '收尾', '开头不好', '结尾仓促',
                          '开头平淡', '结尾无力', '虎头蛇尾', '开头不够吸引人',
                          '结尾没升华', '缺少点题'],
                synonyms=['开头差', '结尾烂', '没开好头', '没结好尾'],
                description='开头不够吸引人或结尾不够有力，缺少点题',
                suggestion_template='建议：1）开头可以用悬念、引用、场景描写等；2）结尾要点题、升华主题；3）开头结尾要呼应',
                estimated_time='25分钟',
                difficulty='medium',
                priority=3
            ),
            'language_vocabulary_weak': LabelRule(
                label_id='language_vocabulary_weak',
                display_name='词汇贫乏',
                keywords=['词汇', '词语', '用词', '词汇量', '词汇贫乏', '用词单一',
                          '词语贫乏', '词汇不够', '用词重复', '表达单一'],
                synonyms=['词穷', '没词儿', '词用得不好', '词汇少'],
                description='词汇量不足，用词单一重复',
                suggestion_template='建议：1）多阅读积累好词好句；2）建立词汇本；3）学习同义词替换',
                estimated_time='20分钟',
                difficulty='low',
                priority=2
            )
        }

        return RulesConfig(
            labels=labels,
            similarity_threshold=0.6,
            cluster_threshold=0.7,
            min_cluster_size=2,
            language='zh'
        )

    @staticmethod
    def _get_default_dictionary() -> DictionaryConfig:
        return DictionaryConfig(
            stopwords=ConfigLoader._get_default_stopwords(),
            custom_words=[],
            essay_types=['记叙文', '议论文', '说明文', '散文', '应用文', '书信', '日记',
                      '读后感', '观后感', '演讲稿'],
            severity_levels={'high': 1.5, 'medium': 1.0, 'low': 0.5}
        )
