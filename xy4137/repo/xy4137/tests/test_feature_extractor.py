import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from feature_extractor import FeatureExtractor, TextFeatures


class TestFeatureExtractor(unittest.TestCase):
    
    def setUp(self):
        self.extractor = FeatureExtractor()
    
    def test_extract_basic(self):
        text = "我最近心情有点低落，感觉很痛苦，工作压力很大。"
        features = self.extractor.extract(text, "TEST_001")
        
        self.assertIsInstance(features, TextFeatures)
        self.assertEqual(features.call_id, "TEST_001")
        self.assertGreater(features.word_count, 0)
    
    def test_high_risk_keywords_detection(self):
        text = "我真的不想活了，活着太痛苦了，有时候真想自杀。"
        features = self.extractor.extract(text, "TEST_002")
        
        high_risk_keywords = [kw for kw, _ in features.high_risk_keywords]
        self.assertIn("不想活", high_risk_keywords)
        self.assertIn("痛苦", high_risk_keywords)
        self.assertIn("自杀", high_risk_keywords)
        self.assertGreater(features.keyword_risk_score, 0.5)
    
    def test_medium_risk_keywords_detection(self):
        text = "我最近很抑郁，经常失眠，感觉压力很大。"
        features = self.extractor.extract(text, "TEST_003")
        
        medium_keywords = [kw for kw, _ in features.medium_risk_keywords]
        self.assertIn("抑郁", medium_keywords)
        self.assertIn("失眠", medium_keywords)
        self.assertIn("压力大", medium_keywords)
    
    def test_template_phrases_detection(self):
        text = "请您理解，按照规定，我们的流程是这样的。请您配合一下。"
        features = self.extractor.extract(text, "TEST_004")
        
        template_phrases = [kw for kw, _ in features.template_phrases]
        self.assertIn("请您理解", template_phrases)
        self.assertIn("按照规定", template_phrases)
        self.assertIn("我们的流程是", template_phrases)
        self.assertIn("请您配合", template_phrases)
        self.assertGreater(features.template_ratio, 0)
    
    def test_negative_emotion_score(self):
        negative_text = "我真的很痛苦，很难过，很绝望，没有人理解我。"
        neutral_text = "今天天气很好，我去公园散步了。"
        
        neg_features = self.extractor.extract(negative_text, "NEG_001")
        neu_features = self.extractor.extract(neutral_text, "NEU_001")
        
        self.assertGreater(neg_features.negative_emotion_score, neu_features.negative_emotion_score)
    
    def test_urgency_score(self):
        urgent_text = "我现在就需要帮助，马上，紧急情况！！！"
        normal_text = "我想找个人聊聊，什么时候都可以。"
        
        urgent_features = self.extractor.extract(urgent_text, "URG_001")
        normal_features = self.extractor.extract(normal_text, "NOR_001")
        
        self.assertGreater(urgent_features.urgency_score, normal_features.urgency_score)
    
    def test_empty_text(self):
        features = self.extractor.extract("", "EMPTY_001")
        
        self.assertEqual(features.call_id, "EMPTY_001")
        self.assertEqual(features.word_count, 0)
        self.assertEqual(features.high_risk_keywords, [])
        self.assertEqual(features.medium_risk_keywords, [])
        self.assertEqual(features.template_phrases, [])
    
    def test_whitespace_text(self):
        features = self.extractor.extract("   \n\n   ", "WS_001")
        
        self.assertEqual(features.call_id, "WS_001")
        self.assertEqual(features.word_count, 0)
    
    def test_keyword_count(self):
        text = "我很痛苦，非常痛苦，真的很痛苦。"
        features = self.extractor.extract(text, "COUNT_001")
        
        for kw, count in features.high_risk_keywords:
            if kw == "痛苦":
                self.assertEqual(count, 3)
                break
    
    def test_avg_sentence_length(self):
        long_sentences = "这是一个很长很长很长的句子，包含了很多很多的词语和标点符号。这是另一个同样很长很长的句子，也包含了很多很多的词语。"
        short_sentences = "你好。再见。谢谢。"
        
        long_features = self.extractor.extract(long_sentences, "LONG_001")
        short_features = self.extractor.extract(short_sentences, "SHORT_001")
        
        self.assertGreater(long_features.avg_sentence_length, short_features.avg_sentence_length)
    
    def test_get_all_keywords(self):
        text = "我很痛苦，感觉很抑郁，请您理解我的感受。"
        keywords = self.extractor.get_all_keywords(text)
        
        self.assertIn("痛苦", keywords["high_risk"])
        self.assertIn("抑郁", keywords["medium_risk"])
        self.assertIn("请您理解", keywords["template"])
    
    def test_combined_risk_detection(self):
        text = "我真的不想活了，活着太痛苦了，最近一直在想自杀的事情，感觉非常绝望。"
        features = self.extractor.extract(text, "HIGH_RISK_001")
        
        self.assertGreater(len(features.high_risk_keywords), 0)
        self.assertGreater(features.keyword_risk_score, 0.7)
        self.assertGreater(features.negative_emotion_score, 0.3)


if __name__ == "__main__":
    unittest.main()
