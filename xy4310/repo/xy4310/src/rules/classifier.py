import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List, Tuple
from datetime import timedelta
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from config import NOISE_SOURCE_RULES, TIME_CONFIG

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NoiseSourceClassifier:
    """噪声源分类器"""
    
    SOURCE_TYPES = {
        "short_construction": {
            "name": "短时施工",
            "description": "短时施工/装修活动",
            "keywords": ["施工", "装修", "打孔", "砸墙", "电钻", "切割", "敲打"],
            "priority": 3,
            "color": "#FF6B6B"
        },
        "bar_closing": {
            "name": "酒吧散场",
            "description": "酒吧散场/夜间娱乐活动",
            "keywords": ["酒吧", "KTV", "夜店", "会所", "唱歌", "音乐", "蹦迪", "吵闹"],
            "priority": 2,
            "color": "#4ECDC4"
        },
        "road_construction": {
            "name": "道路施工",
            "description": "道路施工/大型工程",
            "keywords": ["道路", "修路", "沥青", "铺路", "挖掘", "土方", "拆迁", "重型"],
            "priority": 1,
            "color": "#FFA07A"
        },
        "traffic": {
            "name": "交通噪声",
            "description": "交通噪声",
            "keywords": ["车辆", "堵车", "鸣笛", "货车", "卡车", "汽车", "喇叭"],
            "priority": 4,
            "color": "#9B59B6"
        },
        "unknown": {
            "name": "未知噪声",
            "description": "未知噪声源",
            "keywords": [],
            "priority": 5,
            "color": "#95A5A6"
        }
    }
    
    def __init__(self):
        self.classification_stats: Dict[str, Any] = {
            "total_classified": 0,
            "by_source": {},
            "confidence_distribution": []
        }
    
    def classify_by_keywords(
        self,
        text: str
    ) -> List[Tuple[str, float, str]]:
        """
        基于关键词分类
        
        Args:
            text: 文本内容（投诉描述等）
            
        Returns:
            [(噪声源类型, 置信度, 匹配关键词), ...]
        """
        if not text or pd.isna(text):
            return []
        
        text_lower = str(text).lower()
        results = []
        
        for source_type, source_info in self.SOURCE_TYPES.items():
            if source_type == "unknown":
                continue
            
            matched_keywords = []
            for keyword in source_info["keywords"]:
                if keyword in text_lower:
                    matched_keywords.append(keyword)
            
            if matched_keywords:
                confidence = min(1.0, len(matched_keywords) * 0.3)
                results.append((source_type, confidence, ", ".join(matched_keywords)))
        
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results
    
    def classify_by_time_pattern(
        self,
        hour: int,
        minute: int = 0,
        is_weekend: bool = False
    ) -> List[Tuple[str, float, str]]:
        """
        基于时间模式分类
        
        Args:
            hour: 小时
            minute: 分钟
            is_weekend: 是否周末
            
        Returns:
            [(噪声源类型, 置信度, 时间特征), ...]
        """
        results = []
        
        if 22 <= hour <= 23 or 0 <= hour <= 2:
            results.append(("bar_closing", 0.7, "夜间高峰时段(22:00-02:00)"))
        
        if (7 <= hour <= 9) or (17 <= hour <= 19):
            results.append(("traffic", 0.6, "交通高峰时段"))
        
        if 8 <= hour <= 18:
            results.append(("road_construction", 0.5, "白天施工时段"))
            results.append(("short_construction", 0.4, "白天装修时段"))
        
        if 19 <= hour <= 22:
            results.append(("short_construction", 0.3, "晚间施工时段"))
        
        if is_weekend:
            if 10 <= hour <= 12:
                results.append(("short_construction", 0.5, "周末装修高峰"))
        
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results
    
    def classify_by_noise_pattern(
        self,
        db_levels: List[float],
        time_intervals: Optional[List[timedelta]] = None
    ) -> List[Tuple[str, float, str]]:
        """
        基于噪声模式分类
        
        Args:
            db_levels: 分贝值序列
            time_intervals: 时间间隔序列
            
        Returns:
            [(噪声源类型, 置信度, 模式特征), ...]
        """
        if not db_levels or len(db_levels) < 3:
            return []
        
        results = []
        db_array = np.array(db_levels)
        
        mean_db = np.mean(db_array)
        max_db = np.max(db_array)
        min_db = np.min(db_array)
        std_db = np.std(db_array)
        db_range = max_db - min_db
        
        variations = np.abs(np.diff(db_array))
        mean_variation = np.mean(variations) if len(variations) > 0 else 0
        
        if db_range > 20 and mean_variation > 5:
            results.append(("short_construction", 0.7, f"波动大(范围{db_range:.1f}dB, 平均变动{mean_variation:.1f}dB)"))
        
        if db_range < 10 and std_db < 3 and mean_db > 70:
            results.append(("road_construction", 0.6, f"持续稳定高噪声(均值{mean_db:.1f}dB, 标准差{std_db:.1f}dB)"))
        
        if db_range > 15 and mean_db < 75 and mean_db > 60:
            results.append(("bar_closing", 0.5, f"中等波动(范围{db_range:.1f}dB, 均值{mean_db:.1f}dB)"))
        
        if mean_variation < 2 and 60 <= mean_db <= 80:
            results.append(("traffic", 0.4, f"平稳交通噪声(均值{mean_db:.1f}dB)"))
        
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results
    
    def classify_by_duration(
        self,
        duration_minutes: float
    ) -> List[Tuple[str, float, str]]:
        """
        基于持续时间分类
        
        Args:
            duration_minutes: 持续时间（分钟）
            
        Returns:
            [(噪声源类型, 置信度, 持续时间特征), ...]
        """
        results = []
        
        if 5 <= duration_minutes <= 120:
            results.append(("short_construction", 0.7, f"短时噪声({duration_minutes:.0f}分钟)"))
        
        if duration_minutes >= 180:
            results.append(("road_construction", 0.6, f"长时持续噪声({duration_minutes:.0f}分钟)"))
        
        if 30 <= duration_minutes <= 120:
            results.append(("bar_closing", 0.5, f"中等持续时间({duration_minutes:.0f}分钟)"))
        
        if duration_minutes < 30:
            results.append(("traffic", 0.3, f"短时间噪声({duration_minutes:.0f}分钟)"))
        
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results
    
    def classify_event(
        self,
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        综合分类单个噪声事件
        
        Args:
            event_data: 事件数据，包含：
                - description: 描述文本
                - hour: 小时
                - minute: 分钟
                - is_weekend: 是否周末
                - db_levels: 分贝值序列
                - duration_minutes: 持续时间
                - grid_id: 网格ID
                - has_active_permit: 是否有备案
                
        Returns:
            分类结果
        """
        all_scores: Dict[str, List[Tuple[float, str, str]]] = {}
        
        if "description" in event_data and event_data["description"]:
            keyword_results = self.classify_by_keywords(event_data["description"])
            for source_type, confidence, reason in keyword_results:
                if source_type not in all_scores:
                    all_scores[source_type] = []
                all_scores[source_type].append((confidence * 1.5, "关键词匹配", reason))
        
        if "hour" in event_data:
            time_results = self.classify_by_time_pattern(
                event_data["hour"],
                event_data.get("minute", 0),
                event_data.get("is_weekend", False)
            )
            for source_type, confidence, reason in time_results:
                if source_type not in all_scores:
                    all_scores[source_type] = []
                all_scores[source_type].append((confidence, "时间模式", reason))
        
        if "db_levels" in event_data and event_data["db_levels"]:
            noise_results = self.classify_by_noise_pattern(event_data["db_levels"])
            for source_type, confidence, reason in noise_results:
                if source_type not in all_scores:
                    all_scores[source_type] = []
                all_scores[source_type].append((confidence * 1.2, "噪声模式", reason))
        
        if "duration_minutes" in event_data and event_data["duration_minutes"] > 0:
            duration_results = self.classify_by_duration(event_data["duration_minutes"])
            for source_type, confidence, reason in duration_results:
                if source_type not in all_scores:
                    all_scores[source_type] = []
                all_scores[source_type].append((confidence, "持续时间", reason))
        
        if event_data.get("has_active_permit"):
            if "road_construction" not in all_scores:
                all_scores["road_construction"] = []
            all_scores["road_construction"].append((0.8, "备案匹配", "该时段有施工备案"))
        
        final_scores = []
        for source_type, scores in all_scores.items():
            if not scores:
                continue
            
            total_confidence = sum(s[0] for s in scores) / len(scores) if scores else 0
            total_confidence = min(1.0, total_confidence)
            
            evidences = [
                {"type": s[1], "confidence": round(s[0], 2), "reason": s[2]}
                for s in scores
            ]
            
            final_scores.append({
                "source_type": source_type,
                "source_name": self.SOURCE_TYPES[source_type]["name"],
                "confidence": round(total_confidence, 4),
                "priority": self.SOURCE_TYPES[source_type]["priority"],
                "color": self.SOURCE_TYPES[source_type]["color"],
                "evidences": evidences
            })
        
        final_scores.sort(key=lambda x: (x["confidence"], -x["priority"]), reverse=True)
        
        if not final_scores:
            final_scores.append({
                "source_type": "unknown",
                "source_name": self.SOURCE_TYPES["unknown"]["name"],
                "confidence": 0.0,
                "priority": self.SOURCE_TYPES["unknown"]["priority"],
                "color": self.SOURCE_TYPES["unknown"]["color"],
                "evidences": []
            })
        
        return {
            "primary_source": final_scores[0],
            "all_candidates": final_scores,
            "total_evidences": sum(len(s["evidences"]) for s in final_scores)
        }
    
    def classify_dataframe(
        self,
        df: pd.DataFrame,
        description_col: str = "description",
        time_col: str = "complaint_time",
        grid_col: str = "grid_id",
        db_levels_col: Optional[str] = None,
        permits_df: Optional[pd.DataFrame] = None
    ) -> pd.DataFrame:
        """
        分类整个DataFrame
        
        Args:
            df: 输入DataFrame
            description_col: 描述列名
            time_col: 时间列名
            grid_col: 网格列名
            db_levels_col: 分贝值列名
            permits_df: 备案数据
            
        Returns:
            添加了分类结果的DataFrame
        """
        if df.empty:
            return df
        
        result_df = df.copy()
        
        classifications = []
        primary_sources = []
        confidences = []
        
        for idx, row in result_df.iterrows():
            event_data = {}
            
            if description_col in row.index and pd.notna(row[description_col]):
                event_data["description"] = row[description_col]
            
            if time_col in row.index and pd.notna(row[time_col]):
                event_time = pd.to_datetime(row[time_col])
                event_data["hour"] = event_time.hour
                event_data["minute"] = event_time.minute
                event_data["is_weekend"] = event_time.dayofweek >= 5
            
            if db_levels_col and db_levels_col in row.index and pd.notna(row[db_levels_col]):
                event_data["db_levels"] = [row[db_levels_col]]
            
            if grid_col in row.index and permits_df is not None:
                grid_id = row[grid_col]
                if time_col in row.index:
                    event_time = pd.to_datetime(row[time_col])
                    active_permits = permits_df[
                        (permits_df["start_time"] <= event_time) &
                        (permits_df["end_time"] >= event_time) &
                        (permits_df.get("grid_id") == grid_id if "grid_id" in permits_df.columns else True)
                    ]
                    event_data["has_active_permit"] = len(active_permits) > 0
            
            classification = self.classify_event(event_data)
            classifications.append(classification)
            primary_sources.append(classification["primary_source"]["source_type"])
            confidences.append(classification["primary_source"]["confidence"])
        
        result_df["noise_source_type"] = primary_sources
        result_df["noise_source_name"] = [
            self.SOURCE_TYPES.get(s, {"name": s})["name"] for s in primary_sources
        ]
        result_df["classification_confidence"] = confidences
        result_df["classification_details"] = classifications
        
        self.classification_stats["total_classified"] = len(result_df)
        source_counts = result_df["noise_source_type"].value_counts()
        self.classification_stats["by_source"] = source_counts.to_dict()
        
        return result_df
    
    def get_classification_report(self) -> Dict[str, Any]:
        """获取分类报告"""
        return self.classification_stats
