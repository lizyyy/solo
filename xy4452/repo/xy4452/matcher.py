import os
import re
from typing import List, Dict, Tuple, Optional
from models import FoundItem, LostReport, DataStore, ClaimRecord


class TextMatcher:
    STOP_WORDS = {
        '的', '了', '是', '在', '有', '和', '与', '或', '这', '那', '我', '你', '他',
        '她', '它', '们', '一', '二', '三', '个', '只', '件', '把', '台', '部',
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
        'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
        'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
        'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
        'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
        'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
        'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
        'about', 'against', 'between', 'into', 'through', 'during', 'before',
        'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
        'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once'
    }
    
    ITEM_KEYWORDS = {
        '电子产品': ['手机', 'phone', '电脑', 'computer', '笔记本', 'laptop', '平板', 'tablet',
                    '耳机', 'headphone', '耳机', 'earphone', '充电器', 'charger', '充电宝',
                    'power bank', '相机', 'camera', '手表', 'watch', '智能手表', 'smartwatch',
                    '耳机', 'airpods', '蓝牙', 'bluetooth', 'u盘', 'usb', '硬盘', 'hard disk'],
        '证件类': ['身份证', 'id card', '学生证', 'student card', '校园卡', 'campus card',
                  '银行卡', 'bank card', '信用卡', 'credit card', '驾照', 'driver license',
                  '护照', 'passport', '社保卡', 'social security card', '门禁卡', 'access card'],
        '钥匙类': ['钥匙', 'key', '钥匙扣', 'keychain', '锁匙'],
        '文具类': ['笔', 'pen', '铅笔', 'pencil', '笔记本', 'notebook', '书本', 'book',
                  '书包', 'bag', '背包', 'backpack', '文具盒', 'pencil case'],
        '衣物类': ['衣服', 'clothes', '外套', 'coat', '夹克', 'jacket', '卫衣', 'hoodie',
                  '裤子', 'pants', '鞋子', 'shoes', '帽子', 'hat', '围巾', 'scarf', '手套',
                  'gloves', '雨伞', 'umbrella'],
        '配饰类': ['眼镜', 'glasses', '墨镜', 'sunglasses', '项链', 'necklace', '戒指',
                  'ring', '手链', 'bracelet', '耳环', 'earring', '发夹', 'hairpin'],
        '运动类': ['篮球', 'basketball', '足球', 'football', '羽毛球', 'badminton',
                  '乒乓球', 'table tennis', '球拍', 'racket', '运动服', 'sportswear'],
        '水杯类': ['水杯', 'cup', '保温杯', 'thermos', '水壶', 'water bottle', '瓶子', 'bottle'],
        '其他': ['钱包', 'wallet', '钱包', 'purse', '现金', 'cash', '硬币', 'coin',
                 '文件', 'document', '快递', 'package', '包裹', 'parcel']
    }
    
    @staticmethod
    def tokenize(text: str) -> List[str]:
        if not text:
            return []
        
        text = text.lower()
        tokens = []
        
        chinese_pattern = re.findall(r'[\u4e00-\u9fff]+', text)
        for seg in chinese_pattern:
            for i in range(len(seg)):
                for j in range(i + 1, min(i + 4, len(seg) + 1)):
                    tokens.append(seg[i:j])
            for char in seg:
                tokens.append(char)
        
        english_pattern = re.findall(r'[a-zA-Z]+', text)
        tokens.extend(english_pattern)
        
        number_pattern = re.findall(r'\d+', text)
        tokens.extend(number_pattern)
        
        tokens = [t for t in tokens if t not in TextMatcher.STOP_WORDS and len(t) > 0]
        
        return tokens
    
    @staticmethod
    def extract_keywords(text: str) -> Dict[str, float]:
        tokens = TextMatcher.tokenize(text)
        if not tokens:
            return {}
        
        keyword_freq = {}
        for token in tokens:
            if token not in keyword_freq:
                keyword_freq[token] = 0
            keyword_freq[token] += 1
        
        total_tokens = len(tokens)
        for token in keyword_freq:
            keyword_freq[token] = keyword_freq[token] / total_tokens
        
        return keyword_freq
    
    @staticmethod
    def calculate_text_similarity(text1: str, text2: str) -> float:
        if not text1 or not text2:
            return 0.0
        
        keywords1 = TextMatcher.extract_keywords(text1)
        keywords2 = TextMatcher.extract_keywords(text2)
        
        if not keywords1 or not keywords2:
            return 0.0
        
        all_tokens = set(keywords1.keys()) | set(keywords2.keys())
        
        vec1 = [keywords1.get(token, 0) for token in all_tokens]
        vec2 = [keywords2.get(token, 0) for token in all_tokens]
        
        dot_product = sum(v1 * v2 for v1, v2 in zip(vec1, vec2))
        magnitude1 = (sum(v ** 2 for v in vec1)) ** 0.5
        magnitude2 = (sum(v ** 2 for v in vec2)) ** 0.5
        
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    @staticmethod
    def detect_item_category(text: str) -> List[str]:
        categories = []
        text_lower = text.lower()
        
        for category, keywords in TextMatcher.ITEM_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    categories.append(category)
                    break
        
        return categories


class SimpleImageFeature:
    @staticmethod
    def extract_features(image_path: str) -> Dict:
        if not image_path or not os.path.exists(image_path):
            return {}
        
        try:
            from PIL import Image
            img = Image.open(image_path)
            
            width, height = img.size
            aspect_ratio = width / height if height > 0 else 1.0
            
            img_small = img.resize((16, 16), Image.Resampling.LANCZOS).convert('L')
            pixels = list(img_small.getdata())
            avg_brightness = sum(pixels) / len(pixels) if pixels else 128
            
            if img.mode == 'RGB':
                r, g, b = img.split()
                r_avg = sum(list(r.getdata())) / len(list(r.getdata()))
                g_avg = sum(list(g.getdata())) / len(list(g.getdata()))
                b_avg = sum(list(b.getdata())) / len(list(b.getdata()))
            else:
                r_avg = g_avg = b_avg = avg_brightness
            
            dominant_color = 'colorful'
            if abs(r_avg - g_avg) < 20 and abs(g_avg - b_avg) < 20 and abs(r_avg - b_avg) < 20:
                dominant_color = 'grayscale'
                if avg_brightness > 200:
                    dominant_color = 'white'
                elif avg_brightness < 55:
                    dominant_color = 'black'
            
            return {
                'width': width,
                'height': height,
                'aspect_ratio': round(aspect_ratio, 2),
                'avg_brightness': round(avg_brightness, 2),
                'color_channels': img.mode,
                'dominant_color': dominant_color,
                'r_avg': round(r_avg, 2),
                'g_avg': round(g_avg, 2),
                'b_avg': round(b_avg, 2)
            }
        except Exception as e:
            print(f"Error extracting image features: {e}")
            return {}
    
    @staticmethod
    def calculate_image_similarity(features1: Dict, features2: Dict) -> float:
        if not features1 or not features2:
            return 0.0
        
        score = 0.0
        total_weights = 0.0
        
        if 'aspect_ratio' in features1 and 'aspect_ratio' in features2:
            ratio1 = features1['aspect_ratio']
            ratio2 = features2['aspect_ratio']
            ratio_diff = abs(ratio1 - ratio2)
            ratio_score = max(0, 1 - ratio_diff * 0.5)
            score += ratio_score * 0.3
            total_weights += 0.3
        
        if 'dominant_color' in features1 and 'dominant_color' in features2:
            color1 = features1['dominant_color']
            color2 = features2['dominant_color']
            color_score = 1.0 if color1 == color2 else 0.3
            score += color_score * 0.3
            total_weights += 0.3
        
        if 'avg_brightness' in features1 and 'avg_brightness' in features2:
            bright1 = features1['avg_brightness']
            bright2 = features2['avg_brightness']
            bright_diff = abs(bright1 - bright2)
            bright_score = max(0, 1 - bright_diff / 100)
            score += bright_score * 0.2
            total_weights += 0.2
        
        if all(k in features1 for k in ['r_avg', 'g_avg', 'b_avg']) and \
           all(k in features2 for k in ['r_avg', 'g_avg', 'b_avg']):
            r_diff = abs(features1['r_avg'] - features2['r_avg'])
            g_diff = abs(features1['g_avg'] - features2['g_avg'])
            b_diff = abs(features1['b_avg'] - features2['b_avg'])
            avg_diff = (r_diff + g_diff + b_diff) / 3
            color_sim = max(0, 1 - avg_diff / 100)
            score += color_sim * 0.2
            total_weights += 0.2
        
        return score / total_weights if total_weights > 0 else 0.0


class ItemMatcher:
    def __init__(self):
        self.text_matcher = TextMatcher()
        self.image_feature = SimpleImageFeature()
    
    def calculate_match_score(self, found_item: FoundItem, lost_report: LostReport) -> float:
        score = 0.0
        total_weights = 0.0
        
        title_sim = self.text_matcher.calculate_text_similarity(
            found_item.title, lost_report.title
        )
        if title_sim > 0:
            score += title_sim * 0.3
            total_weights += 0.3
        
        desc_sim = self.text_matcher.calculate_text_similarity(
            found_item.description, lost_report.description
        )
        if desc_sim > 0:
            score += desc_sim * 0.3
            total_weights += 0.3
        
        found_cats = self.text_matcher.detect_item_category(
            found_item.title + ' ' + found_item.description
        )
        lost_cats = self.text_matcher.detect_item_category(
            lost_report.title + ' ' + lost_report.description
        )
        
        if found_cats and lost_cats:
            common_cats = set(found_cats) & set(lost_cats)
            if common_cats:
                cat_score = len(common_cats) / max(len(found_cats), len(lost_cats), 1)
                score += cat_score * 0.2
                total_weights += 0.2
        
        location_sim = self.text_matcher.calculate_text_similarity(
            found_item.location, lost_report.location
        )
        if location_sim > 0:
            score += location_sim * 0.1
            total_weights += 0.1
        
        if found_item.tags and lost_report.tags:
            common_tags = set(found_item.tags) & set(lost_report.tags)
            if common_tags:
                tag_score = len(common_tags) / max(len(found_item.tags), len(lost_report.tags), 1)
                score += tag_score * 0.1
                total_weights += 0.1
        
        return score / total_weights if total_weights > 0 else 0.0
    
    def detect_risks(self, found_item: FoundItem, lost_report: LostReport, 
                     data_store: DataStore) -> List[Dict]:
        risks = []
        
        claim_records = data_store.get_claim_records_by_item(found_item.item_id)
        for record in claim_records:
            if record.status in ['confirmed', 'returned', 'claimed']:
                risks.append({
                    'type': 'already_claimed',
                    'severity': 'high',
                    'message': f'该物品已被领取（状态: {record.status}），请确认是否重复领取',
                    'claim_id': record.claim_id,
                    'claimant': record.claimant
                })
                break
        
        all_found_items = data_store.get_all_found_items()
        similar_items = []
        for item in all_found_items:
            if item.item_id != found_item.item_id:
                sim = self.text_matcher.calculate_text_similarity(
                    item.title + ' ' + item.description,
                    found_item.title + ' ' + found_item.description
                )
                if sim > 0.7:
                    similar_items.append({
                        'item_id': item.item_id,
                        'title': item.title,
                        'similarity': sim
                    })
        
        if similar_items:
            risks.append({
                'type': 'duplicate_registration',
                'severity': 'medium',
                'message': f'发现 {len(similar_items)} 个疑似重复登记的物品',
                'similar_items': similar_items
            })
        
        found_cats = self.text_matcher.detect_item_category(
            found_item.title + ' ' + found_item.description
        )
        lost_cats = self.text_matcher.detect_item_category(
            lost_report.title + ' ' + lost_report.description
        )
        
        if found_cats and lost_cats:
            common = set(found_cats) & set(lost_cats)
            if not common:
                risks.append({
                    'type': 'category_mismatch',
                    'severity': 'medium',
                    'message': f'物品类别描述矛盾：拾到物类别 {found_cats}，报失物类别 {lost_cats}',
                    'found_categories': found_cats,
                    'lost_categories': lost_cats
                })
        
        if found_item.description and lost_report.description:
            contradictions = self._detect_contradictions(
                found_item.description, lost_report.description
            )
            for contradiction in contradictions:
                risks.append({
                    'type': 'description_contradiction',
                    'severity': 'high',
                    'message': contradiction
                })
        
        return risks
    
    def _detect_contradictions(self, text1: str, text2: str) -> List[str]:
        contradictions = []
        text1_lower = text1.lower()
        text2_lower = text2.lower()
        
        color_pairs = [
            ('红色', 'red'), ('蓝色', 'blue'), ('绿色', 'green'),
            ('黄色', 'yellow'), ('黑色', 'black'), ('白色', 'white'),
            ('紫色', 'purple'), ('粉色', 'pink'), ('橙色', 'orange'),
            ('棕色', 'brown'), ('灰色', 'gray')
        ]
        
        colors1 = []
        colors2 = []
        
        for cn, en in color_pairs:
            if cn in text1_lower or en in text1_lower:
                colors1.append(cn)
            if cn in text2_lower or en in text2_lower:
                colors2.append(cn)
        
        if colors1 and colors2:
            common = set(colors1) & set(colors2)
            if not common:
                contradictions.append(f'颜色描述矛盾：拾到物描述为 {colors1}，报失物描述为 {colors2}')
        
        size_indicators = {
            'small': ['小', 'small', 'mini', '迷你'],
            'medium': ['中', 'medium', '普通', 'normal'],
            'large': ['大', 'large', 'big', '巨大']
        }
        
        size1 = None
        size2 = None
        
        for size, indicators in size_indicators.items():
            for ind in indicators:
                if ind in text1_lower:
                    size1 = size
                if ind in text2_lower:
                    size2 = size
        
        if size1 and size2 and size1 != size2:
            contradictions.append(f'尺寸描述矛盾：拾到物描述为 {size1}，报失物描述为 {size2}')
        
        return contradictions
