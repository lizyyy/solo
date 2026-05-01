import pytest
from rule_engine.opening_detector import OpeningDetector
from rule_engine.promise_detector import PromiseDetector
from rule_engine.sensitive_word_detector import SensitiveWordDetector
from rule_engine.silence_detector import SilenceDetector


class TestBoundaryCases:
    def test_out_of_order_timestamps(self):
        transcript = [
            {"speaker": "agent", "start_time": 10, "end_time": 15, "text": "这是第二句"},
            {"speaker": "agent", "start_time": 0, "end_time": 5, "text": "您好，请问有什么可以帮助您的？"},
            {"speaker": "customer", "start_time": 6, "end_time": 12, "text": "我要投诉"}
        ]
        
        rules = {
            "opening_rules": {
                "required_phrases": ["您好", "请问有什么可以帮助您的"],
                "max_time_seconds": 15,
                "agent_role": "agent"
            }
        }
        
        violations = OpeningDetector.detect_opening_missing(transcript, rules)
        
        assert len(violations) == 0
    
    def test_out_of_order_timestamps_silence(self):
        transcript = [
            {"speaker": "agent", "start_time": 10, "end_time": 15, "text": "好的"},
            {"speaker": "customer", "start_time": 0, "end_time": 5, "text": "你好"},
            {"speaker": "agent", "start_time": 30, "end_time": 35, "text": "再见"}
        ]
        
        rules = {
            "silence_rules": {
                "max_silence_seconds": 10
            }
        }
        
        violations = SilenceDetector.detect_long_silence(transcript, rules)
        
        assert len(violations) == 1
        assert violations[0]["duration"] == 15.0
    
    def test_multiple_rules_single_sentence(self):
        transcript = [
            {"speaker": "customer", "start_time": 0, "end_time": 10, "text": "这产品太垃圾了，简直是骗人的！"}
        ]
        
        sensitive_words = ["垃圾", "骗人"]
        
        violations = SensitiveWordDetector.detect_sensitive_words(transcript, sensitive_words)
        
        assert len(violations) == 2
        words_found = [v["word"] for v in violations]
        assert "垃圾" in words_found
        assert "骗人" in words_found
    
    def test_empty_transcript(self):
        transcript = []
        
        rules = {
            "opening_rules": {
                "required_phrases": ["您好"],
                "max_time_seconds": 15,
                "agent_role": "agent"
            },
            "silence_rules": {
                "max_silence_seconds": 10
            }
        }
        
        opening_violations = OpeningDetector.detect_opening_missing(transcript, rules)
        silence_violations = SilenceDetector.detect_long_silence(transcript, rules)
        
        assert len(opening_violations) == 1
        assert len(silence_violations) == 0
    
    def test_exact_boundary_silence(self):
        transcript = [
            {"speaker": "agent", "start_time": 0, "end_time": 10, "text": "您好"},
            {"speaker": "customer", "start_time": 20, "end_time": 25, "text": "你好"}
        ]
        
        rules = {
            "silence_rules": {
                "max_silence_seconds": 10
            }
        }
        
        violations = SilenceDetector.detect_long_silence(transcript, rules)
        
        assert len(violations) == 0