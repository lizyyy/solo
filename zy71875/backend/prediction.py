from datetime import date, timedelta
from typing import List, Dict, Optional, Tuple
import numpy as np
from collections import defaultdict

from models import MealRecord
from utils import generate_id


MODEL_DESCRIPTION = """
# 食堂备餐预测模型说明（版本 1.0）

## 模型概述
本模型基于历史用餐数据，结合日期特征（星期几、节假日、季节因素）和菜品流行度，
为未来一段时间的每餐每道菜提供份数预测。

## 预测算法
1. **基础权重计算**：
   - 最近7天：权重 50%
   - 最近14-8天：权重 30%
   - 最近30-15天：权重 20%

2. **日期因子调整**：
   - 工作日（周一至周五）：基准系数 1.0
   - 周末（周六至周日）：调整系数 0.75
   - 法定节假日：调整系数 0.5
   - 开学/返工第一周：调整系数 1.2

3. **菜品分类系数**：
   - 热菜类：基准系数 1.0
   - 主食类：基准系数 1.1
   - 汤品类：基准系数 0.8
   - 冷菜类：基准系数 0.6
   - 小吃类：基准系数 0.5

4. **平滑处理**：
   - 预测值取整数，最少为 0
   - 单日单菜品预测上限为 9999 份

## 数据范围说明
- 历史数据：取预测日期前 30 天内的实际用餐数据
- 预测范围：用户选择的日期区间，单次最多 365 天
- 导出范围：与当前屏幕显示的筛选条件完全一致

## 约束条件
1. 同一日期、同一餐次、同一菜品只能有一条预测记录
2. 预测份数不能为负数
3. 已复核的记录不允许被覆盖，除非明确指定强制更新
4. 批量预测时，系统会自动跳过已存在且已复核的记录

## 版本信息
- 模型版本：v1.0
- 更新日期：2024-01-01
- 适用场景：企事业单位食堂、学校食堂日常备餐
"""


class MealPredictor:
    """食堂备餐预测器"""

    def __init__(self, db_session):
        self.db = db_session
        self.model_version = "v1.0"
        self.category_factors = {
            "热菜": 1.0,
            "主食": 1.1,
            "汤品": 0.8,
            "冷菜": 0.6,
            "小吃": 0.5,
            "其他": 1.0,
        }

    def get_day_factor(self, d: date) -> float:
        """获取日期调整因子"""
        weekday = d.weekday()

        if weekday >= 5:
            return 0.75

        if self._is_holiday(d):
            return 0.5

        if self._is_school_start_week(d):
            return 1.2

        return 1.0

    def _is_holiday(self, d: date) -> bool:
        """简化的节假日判断"""
        holidays = [
            (1, 1), (1, 2), (1, 3),
            (5, 1), (5, 2), (5, 3),
            (10, 1), (10, 2), (10, 3), (10, 4), (10, 5), (10, 6), (10, 7),
        ]
        return (d.month, d.day) in holidays

    def _is_school_start_week(self, d: date) -> bool:
        """判断是否为开学/返工第一周"""
        spring_start = date(d.year, 2, 15)
        fall_start = date(d.year, 9, 1)

        for start_date in [spring_start, fall_start]:
            if start_date <= d <= start_date + timedelta(days=7):
                return True
        return False

    def get_category_factor(self, category: Optional[str]) -> float:
        """获取菜品分类系数"""
        if not category:
            return 1.0
        for key, factor in self.category_factors.items():
            if key in category:
                return factor
        return 1.0

    def get_historical_data(self, end_date: date, days: int = 30) -> Dict[Tuple[str, str, int], List[int]]:
        """获取历史数据，按(菜品, 餐次, 星期)分组"""
        start_date = end_date - timedelta(days=days)

        records = self.db.query(MealRecord).filter(
            MealRecord.record_date >= start_date,
            MealRecord.record_date < end_date,
            MealRecord.actual_count > 0
        ).all()

        historical = defaultdict(list)
        for rec in records:
            key = (rec.dish_name, rec.meal_type, rec.record_date.weekday())
            historical[key].append(rec.actual_count)

        return historical

    def predict_dish(
        self,
        dish_name: str,
        meal_type: str,
        category: Optional[str],
        predict_date: date,
        historical: Dict[Tuple[str, str, int], List[int]]
    ) -> int:
        """预测单个菜品的份数"""
        weekday = predict_date.weekday()
        key = (dish_name, meal_type, weekday)

        if key not in historical:
            return 0

        counts = historical[key]
        if not counts:
            return 0

        weights = []
        for i in range(min(len(counts), 30)):
            if i < 7:
                weights.append(0.5 / 7)
            elif i < 14:
                weights.append(0.3 / 7)
            else:
                weights.append(0.2 / 16)

        weights = weights[:len(counts)]
        weights = [w / sum(weights) for w in weights]

        weighted_avg = np.average(counts[:len(weights)], weights=weights)

        day_factor = self.get_day_factor(predict_date)
        category_factor = self.get_category_factor(category)

        predicted = weighted_avg * day_factor * category_factor
        predicted = max(0, min(9999, int(round(predicted))))

        return predicted

    def generate_predictions(
        self,
        start_date: date,
        end_date: date,
        overwrite_existing: bool = False
    ) -> Tuple[List[Dict], int, int]:
        """
        生成指定日期范围的预测

        返回：(预测记录列表, 新增数量, 跳过数量)
        """
        historical = self.get_historical_data(start_date, days=30)

        dish_meal_pairs = self._get_common_dishes(start_date)

        batch_id = generate_id("PRED")

        predictions = []
        added_count = 0
        skipped_count = 0

        current_date = start_date
        while current_date <= end_date:
            for dish_name, meal_type, category, price in dish_meal_pairs:
                existing = self.db.query(MealRecord).filter(
                    MealRecord.record_date == current_date,
                    MealRecord.meal_type == meal_type,
                    MealRecord.dish_name == dish_name
                ).first()

                if existing:
                    if existing.is_reviewed and not overwrite_existing:
                        skipped_count += 1
                        continue
                    if not overwrite_existing:
                        skipped_count += 1
                        continue

                predicted_count = self.predict_dish(
                    dish_name, meal_type, category, current_date, historical
                )

                if predicted_count == 0 and not existing:
                    continue

                predictions.append({
                    "record_date": current_date,
                    "meal_type": meal_type,
                    "dish_name": dish_name,
                    "predicted_count": predicted_count,
                    "category": category,
                    "price": price or 0.0,
                    "unit": "份",
                    "batch_id": batch_id,
                })
                added_count += 1

            current_date += timedelta(days=1)

        return predictions, added_count, skipped_count, batch_id

    def _get_common_dishes(self, reference_date: date) -> List[Tuple[str, str, Optional[str], Optional[float]]]:
        """获取最近常见的菜品列表"""
        start_date = reference_date - timedelta(days=30)

        records = self.db.query(MealRecord).filter(
            MealRecord.record_date >= start_date,
            MealRecord.record_date < reference_date
        ).all()

        dish_map = {}
        for rec in records:
            key = (rec.dish_name, rec.meal_type)
            if key not in dish_map:
                dish_map[key] = (rec.category, rec.price)

        return [(k[0], k[1], v[0], v[1]) for k, v in dish_map.items()]

    def get_model_info(self) -> Dict:
        """获取模型说明信息"""
        return {
            "model_version": self.model_version,
            "model_description": MODEL_DESCRIPTION.strip(),
            "category_factors": self.category_factors,
            "date_factors": {
                "工作日": 1.0,
                "周末": 0.75,
                "节假日": 0.5,
                "开学周": 1.2,
            },
            "weight_scheme": {
                "最近7天": "50%",
                "8-14天": "30%",
                "15-30天": "20%",
            },
        }
