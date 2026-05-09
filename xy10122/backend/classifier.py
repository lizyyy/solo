import re
from typing import Tuple, Optional, List, Dict
from sqlalchemy.orm import Session
from .models import ClassificationRule


class CategoryClassifier:
    def __init__(self, db: Session = None):
        self.db = db
        self.default_rules = self._get_default_rules()

    def _get_default_rules(self) -> List[Dict]:
        return [
            {
                "category": "手机数码",
                "keywords": ["手机", "iphone", "华为", "小米", "vivo", "oppo", "苹果", "智能手机", "安卓", "5G手机", "拍照手机", "游戏手机"],
                "exclude_keywords": ["壳", "膜", "支架", "充电器", "数据线"],
                "priority": 100
            },
            {
                "category": "手机配件",
                "keywords": ["手机壳", "手机膜", "数据线", "充电器", "充电宝", "蓝牙耳机", "耳机", "手机支架", "手机配件", "钢化膜"],
                "priority": 90
            },
            {
                "category": "电脑办公",
                "keywords": ["笔记本", "台式机", "一体机", "游戏本", "轻薄本", "电脑", "笔记本电脑", "联想", "戴尔", "华硕", "惠普"],
                "exclude_keywords": ["配件"],
                "priority": 100
            },
            {
                "category": "电脑配件",
                "keywords": ["鼠标", "键盘", "显示器", "显卡", "主板", "cpu", "内存条", "硬盘", "固态硬盘", "机械硬盘", "电源", "机箱", "散热器", "电脑配件"],
                "priority": 90
            },
            {
                "category": "服装男装",
                "keywords": ["t恤", "衬衫", "牛仔裤", "外套", "夹克", "羽绒服", "卫衣", "裤子", "男装", "男式", "男士", "西装", "西裤", "西装裤"],
                "exclude_keywords": ["女", "儿童", "童装"],
                "priority": 95
            },
            {
                "category": "服装女装",
                "keywords": ["连衣裙", "半身裙", "上衣", "女鞋", "女装", "女式", "女士", "女款", "打底衫", "针织衫", "毛衣"],
                "exclude_keywords": ["男", "儿童", "童装"],
                "priority": 95
            },
            {
                "category": "鞋靴",
                "keywords": ["运动鞋", "跑鞋", "篮球鞋", "休闲鞋", "皮鞋", "靴子", "凉鞋", "拖鞋", "高跟鞋"],
                "priority": 90
            },
            {
                "category": "家居家纺",
                "keywords": ["床上用品", "四件套", "床单", "被套", "枕头", "枕套", "被子", "床垫", "家纺"],
                "priority": 85
            },
            {
                "category": "食品零食",
                "keywords": ["零食", "坚果", "饼干", "糖果", "巧克力", "薯片", "膨化", "方便面", "零食大礼包"],
                "priority": 85
            },
            {
                "category": "酒水饮料",
                "keywords": ["白酒", "红酒", "啤酒", "葡萄酒", "饮料", "矿泉水", "果汁", "牛奶", "酸奶", "咖啡", "奶茶"],
                "priority": 85
            },
            {
                "category": "美妆护肤",
                "keywords": ["面膜", "洗面奶", "爽肤水", "乳液", "面霜", "精华", "眼霜", "口红", "粉底", "彩妆", "护肤", "化妆品"],
                "priority": 85
            },
            {
                "category": "母婴用品",
                "keywords": ["奶粉", "纸尿裤", "婴儿", "尿不湿", "童装", "儿童", "宝宝", "婴儿车", "玩具", "母婴"],
                "priority": 90
            },
            {
                "category": "图书文具",
                "keywords": ["书籍", "图书", "钢笔", "笔记本", "文具", "本子", "笔", "文件夹", "办公用品"],
                "exclude_keywords": ["电脑", "手机"],
                "priority": 80
            },
            {
                "category": "运动户外",
                "keywords": ["运动服", "健身器材", "跑步机", "自行车", "登山", "户外", "帐篷", "羽毛球", "篮球", "足球"],
                "priority": 85
            },
            {
                "category": "汽车用品",
                "keywords": ["汽车", "车载", "汽车配件", "车内饰品", "导航", "行车记录仪", "轮胎"],
                "priority": 80
            }
        ]

    def _load_rules(self) -> List[Dict]:
        rules = []
        if self.db:
            try:
                db_rules = self.db.query(ClassificationRule).filter(
                    ClassificationRule.is_active == 1
                ).order_by(ClassificationRule.priority.desc()).all()
                for rule in db_rules:
                    rules.append({
                        "category": rule.category,
                        "keywords": [k.strip() for k in rule.keywords.split(",")],
                        "exclude_keywords": [],
                        "priority": rule.priority or 100
                    })
            except Exception:
                pass

        if not rules:
            rules = self.default_rules

        return sorted(rules, key=lambda x: x.get("priority", 100), reverse=True)

    def classify(self, title: str, original_category: str = None) -> Tuple[Optional[str], str]:
        if not title:
            return None, "标题为空"

        title_lower = title.lower()
        rules = self._load_rules()

        matched_rules = []

        for rule in rules:
            category = rule["category"]
            keywords = rule.get("keywords", [])
            exclude_keywords = rule.get("exclude_keywords", [])
            priority = rule.get("priority", 100)

            has_exclude = any(excl.lower() in title_lower for excl in exclude_keywords)
            if has_exclude:
                continue

            matched_keywords = []
            for kw in keywords:
                kw_lower = kw.lower()
                if kw_lower in title_lower:
                    matched_keywords.append(kw)
                    regex_pattern = r'\b' + re.escape(kw_lower) + r'\b'
                    if re.search(regex_pattern, title_lower):
                        matched_keywords.append(kw + "(精准匹配)")

            if matched_keywords:
                matched_rules.append({
                    "category": category,
                    "keywords": matched_keywords,
                    "priority": priority,
                    "score": len(matched_keywords) * 10 + priority
                })

        if matched_rules:
            matched_rules.sort(key=lambda x: x["score"], reverse=True)
            best_match = matched_rules[0]
            reason = f"匹配关键词: {', '.join(best_match['keywords'])}"
            return best_match["category"], reason
        elif original_category:
            return original_category, "无匹配规则，保留原分类"
        else:
            return None, "无匹配规则，未自动归类"

    def batch_classify(self, items: List[Dict]) -> List[Dict]:
        results = []
        for item in items:
            title = item.get("title", "")
            product_id = item.get("product_id", "")
            original_category = item.get("original_category")

            category, reason = self.classify(title, original_category)

            results.append({
                "product_id": product_id,
                "title": title,
                "original_category": original_category,
                "predicted_category": category,
                "reason": reason,
                "needs_review": category != original_category if original_category and category else True
            })

        return results
