import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import random

from config.settings import SAMPLE_DATA_CONFIG, MEAL_TYPES, CHRONIC_DISEASES


DISH_CATEGORIES = ["主食", "荤菜", "素菜", "汤", "点心"]

SAMPLE_DISHES = [
    {"dish_name": "白米饭", "category": "主食", "energy": 116, "protein": 2.6, "fat": 0.3, "carbs": 25.6, "sodium": 2, "fiber": 0.3},
    {"dish_name": "小米粥", "category": "主食", "energy": 46, "protein": 1.4, "fat": 0.7, "carbs": 8.4, "sodium": 4, "fiber": 1.6},
    {"dish_name": "馒头", "category": "主食", "energy": 223, "protein": 7.0, "fat": 1.1, "carbs": 45.7, "sodium": 165, "fiber": 1.3},
    {"dish_name": "面条", "category": "主食", "energy": 284, "protein": 8.3, "fat": 2.3, "carbs": 56.9, "sodium": 3, "fiber": 0.8},
    {"dish_name": "杂粮饭", "category": "主食", "energy": 112, "protein": 3.0, "fat": 0.5, "carbs": 23.5, "sodium": 5, "fiber": 2.8},
    {"dish_name": "清蒸鲈鱼", "category": "荤菜", "energy": 105, "protein": 18.6, "fat": 3.4, "carbs": 0.0, "sodium": 144, "fiber": 0.0},
    {"dish_name": "红烧肉", "category": "荤菜", "energy": 469, "protein": 17.8, "fat": 44.2, "carbs": 2.1, "sodium": 140, "fiber": 0.0},
    {"dish_name": "番茄炒蛋", "category": "荤菜", "energy": 82, "protein": 4.8, "fat": 6.0, "carbs": 2.7, "sodium": 146, "fiber": 0.5},
    {"dish_name": "宫保鸡丁", "category": "荤菜", "energy": 226, "protein": 16.4, "fat": 16.5, "carbs": 5.7, "sodium": 680, "fiber": 1.0},
    {"dish_name": "清蒸排骨", "category": "荤菜", "energy": 264, "protein": 18.3, "fat": 20.4, "carbs": 1.7, "sodium": 62, "fiber": 0.0},
    {"dish_name": "炒青菜", "category": "素菜", "energy": 47, "protein": 1.8, "fat": 4.0, "carbs": 2.0, "sodium": 213, "fiber": 1.1},
    {"dish_name": "蒜蓉西兰花", "category": "素菜", "energy": 41, "protein": 2.3, "fat": 3.0, "carbs": 2.7, "sodium": 180, "fiber": 1.6},
    {"dish_name": "清炒冬瓜", "category": "素菜", "energy": 24, "protein": 0.4, "fat": 2.0, "carbs": 2.6, "sodium": 120, "fiber": 0.7},
    {"dish_name": "茄子烧豆腐", "category": "素菜", "energy": 56, "protein": 2.8, "fat": 3.5, "carbs": 4.2, "sodium": 240, "fiber": 1.3},
    {"dish_name": "凉拌黄瓜", "category": "素菜", "energy": 16, "protein": 0.8, "fat": 0.2, "carbs": 3.6, "sodium": 4, "fiber": 0.5},
    {"dish_name": "紫菜蛋花汤", "category": "汤", "energy": 52, "protein": 3.2, "fat": 3.5, "carbs": 1.5, "sodium": 350, "fiber": 0.3},
    {"dish_name": "番茄蛋汤", "category": "汤", "energy": 45, "protein": 2.5, "fat": 3.0, "carbs": 2.8, "sodium": 280, "fiber": 0.4},
    {"dish_name": "玉米排骨汤", "category": "汤", "energy": 68, "protein": 4.2, "fat": 4.5, "carbs": 2.1, "sodium": 200, "fiber": 0.6},
    {"dish_name": "豆浆", "category": "汤", "energy": 31, "protein": 1.8, "fat": 0.7, "carbs": 1.1, "sodium": 3, "fiber": 0.8},
    {"dish_name": "银耳莲子汤", "category": "汤", "energy": 42, "protein": 0.5, "fat": 0.1, "carbs": 10.0, "sodium": 5, "fiber": 0.6},
    {"dish_name": "煮鸡蛋", "category": "点心", "energy": 143, "protein": 12.8, "fat": 9.9, "carbs": 1.5, "sodium": 142, "fiber": 0.0},
    {"dish_name": "豆沙包", "category": "点心", "energy": 220, "protein": 6.0, "fat": 1.0, "carbs": 45.2, "sodium": 180, "fiber": 1.5},
    {"dish_name": "牛奶", "category": "点心", "energy": 54, "protein": 3.0, "fat": 3.2, "carbs": 3.4, "sodium": 37, "fiber": 0.0},
    {"dish_name": "水果拼盘", "category": "点心", "energy": 45, "protein": 0.5, "fat": 0.2, "carbs": 11.5, "sodium": 2, "fiber": 1.2},
    {"dish_name": "燕麦粥", "category": "点心", "energy": 68, "protein": 2.4, "fat": 1.4, "carbs": 12.0, "sodium": 6, "fiber": 1.7},
    {"dish_name": "包子", "category": "主食", "energy": 227, "protein": 7.2, "fat": 1.0, "carbs": 45.6, "sodium": 150, "fiber": 1.4},
    {"dish_name": "水饺", "category": "主食", "energy": 218, "protein": 10.5, "fat": 9.5, "carbs": 22.5, "sodium": 220, "fiber": 1.2},
    {"dish_name": "炒牛肉", "category": "荤菜", "energy": 125, "protein": 22.1, "fat": 4.2, "carbs": 0.0, "sodium": 84, "fiber": 0.0},
    {"dish_name": "清炒胡萝卜", "category": "素菜", "energy": 39, "protein": 1.0, "fat": 2.5, "carbs": 3.6, "sodium": 71, "fiber": 1.1},
    {"dish_name": "酸辣土豆丝", "category": "素菜", "energy": 76, "protein": 2.0, "fat": 4.5, "carbs": 8.0, "sodium": 260, "fiber": 1.3},
]

SAMPLE_ELDERLY_NAMES = [
    "张桂英", "李淑珍", "王秀兰", "刘凤英", "陈玉兰",
    "杨秀珍", "赵桂兰", "黄淑华", "周秀珍", "吴桂英",
    "徐淑兰", "孙秀兰", "胡凤英", "朱玉兰", "高秀珍",
    "林桂英", "何淑珍", "罗秀兰", "郑凤英", "梁玉兰",
    "谢秀珍", "宋桂英", "唐淑珍", "韩秀兰", "曹凤英",
    "许玉兰", "邓秀珍", "萧桂英", "冯淑珍", "曾秀兰",
    "程凤英", "蔡玉兰", "彭秀珍", "苏桂英", "卢淑珍",
    "蒋秀兰", "蔡凤英", "贾玉兰", "魏秀珍", "丁桂英",
    "薛淑珍", "叶秀兰", "阎凤英", "余玉兰", "潘秀珍",
    "杜桂英", "戴淑珍", "夏秀兰", "钟凤英"
]

SAMPLE_BED_NUMBERS = [f"{floor}{room:02d}" for floor in [1, 2, 3] for room in range(1, 21)]


class SampleDataGenerator:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or SAMPLE_DATA_CONFIG
        self.num_elderly = self.config.get('num_elderly', 50)
        self.num_dishes = min(self.config.get('num_dishes', 30), len(SAMPLE_DISHES))
        self.date_range = self.config.get('date_range', 7)
        self.default_date = self.config.get('default_date', '2024-01-15')
        
        self.chronic_types = list(CHRONIC_DISEASES.keys())
        self._random = random.Random(42)
        self._np_random = np.random.default_rng(42)
    
    def generate_elderly_info(self) -> pd.DataFrame:
        elderly_data = []
        
        for i in range(self.num_elderly):
            elderly_id = f"E{i+1:05d}"
            name = SAMPLE_ELDERLY_NAMES[i % len(SAMPLE_ELDERLY_NAMES)]
            age = self._random.randint(65, 92)
            gender = self._random.choice(["男", "女"])
            bed_number = SAMPLE_BED_NUMBERS[i % len(SAMPLE_BED_NUMBERS)]
            
            chronic_weights = [0.35, 0.25, 0.15, 0.10, 0.05, 0.10]
            chronic_type = self._np_random.choice(self.chronic_types, p=chronic_weights)
            
            if chronic_type == "普通":
                chronic_diseases = ""
            else:
                num_chronic = self._random.randint(1, 3)
                selected = self._random.sample(
                    [c for c in self.chronic_types if c != "普通"],
                    min(num_chronic, len(self.chronic_types) - 1)
                )
                chronic_diseases = ",".join(selected)
            
            elderly_data.append({
                "elderly_id": elderly_id,
                "name": name,
                "age": age,
                "gender": gender,
                "bed_number": bed_number,
                "chronic_diseases": chronic_diseases,
                "dietary_restrictions": self._generate_dietary_restrictions(chronic_diseases)
            })
        
        return pd.DataFrame(elderly_data)
    
    def _generate_dietary_restrictions(self, chronic_diseases: str) -> str:
        restrictions = []
        diseases = [c.strip() for c in chronic_diseases.split(",") if c.strip()]
        
        for disease in diseases:
            restrictions.extend(CHRONIC_DISEASES.get(disease, []))
        
        return ",".join(restrictions) if restrictions else ""
    
    def generate_dish_info(self) -> pd.DataFrame:
        dish_data = []
        
        for i in range(self.num_dishes):
            dish = SAMPLE_DISHES[i]
            dish_code = f"D{i+1:04d}"
            
            dietary_tags = self._generate_dietary_tags(dish)
            
            dish_data.append({
                "dish_code": dish_code,
                "dish_name": dish["dish_name"],
                "dish_category": dish["category"],
                "energy_per_100g": dish["energy"],
                "protein_per_100g": dish["protein"],
                "fat_per_100g": dish["fat"],
                "carbs_per_100g": dish["carbs"],
                "sodium_per_100g": dish["sodium"],
                "fiber_per_100g": dish["fiber"],
                "dietary_tags": ",".join(dietary_tags),
                "description": f"标准{self._get_cooking_method(dish['category'])}菜品"
            })
        
        return pd.DataFrame(dish_data)
    
    def _generate_dietary_tags(self, dish: Dict) -> List[str]:
        tags = []
        
        if dish["sodium"] < 100:
            tags.append("低钠")
        if dish["fat"] < 5:
            tags.append("低脂")
        if dish["carbs"] < 10 and dish["category"] not in ["主食", "点心"]:
            tags.append("低糖")
        if dish["fiber"] >= 1.5:
            tags.append("高纤维")
        if dish["category"] == "素菜":
            tags.append("素食")
        
        return tags
    
    def _get_cooking_method(self, category: str) -> str:
        methods = {
            "主食": "蒸煮",
            "荤菜": "清蒸/红烧",
            "素菜": "清炒",
            "汤": "炖煮",
            "点心": "蒸煮"
        }
        return methods.get(category, "烹饪")
    
    def generate_daily_menu(self, date: date) -> Dict[str, List[str]]:
        menu = {}
        
        for meal_type in MEAL_TYPES:
            if meal_type == "早餐":
                staple_dishes = [d for d in range(self.num_dishes) 
                                if SAMPLE_DISHES[d]["category"] in ["主食", "点心"]]
                soup_dishes = [d for d in range(self.num_dishes) 
                              if SAMPLE_DISHES[d]["category"] == "汤"]
                dish_dishes = [d for d in range(self.num_dishes) 
                              if SAMPLE_DISHES[d]["category"] in ["素菜", "荤菜"]]
                
                meal_dishes = (
                    self._random.sample(staple_dishes, min(2, len(staple_dishes))) +
                    self._random.sample(soup_dishes, min(1, len(soup_dishes))) +
                    self._random.sample(dish_dishes, min(1, len(dish_dishes)))
                )
            else:
                staple_dishes = [d for d in range(self.num_dishes) 
                                if SAMPLE_DISHES[d]["category"] == "主食"]
                meat_dishes = [d for d in range(self.num_dishes) 
                              if SAMPLE_DISHES[d]["category"] == "荤菜"]
                veg_dishes = [d for d in range(self.num_dishes) 
                             if SAMPLE_DISHES[d]["category"] == "素菜"]
                soup_dishes = [d for d in range(self.num_dishes) 
                              if SAMPLE_DISHES[d]["category"] == "汤"]
                
                meal_dishes = (
                    self._random.sample(staple_dishes, min(1, len(staple_dishes))) +
                    self._random.sample(meat_dishes, min(2, len(meat_dishes))) +
                    self._random.sample(veg_dishes, min(2, len(veg_dishes))) +
                    self._random.sample(soup_dishes, min(1, len(soup_dishes)))
                )
            
            menu[meal_type] = [f"D{d+1:04d}" for d in meal_dishes]
        
        return menu
    
    def generate_orders(self, elderly_df: pd.DataFrame, dish_df: pd.DataFrame,
                       start_date: date, end_date: date) -> pd.DataFrame:
        orders_data = []
        order_id_counter = 1
        
        current_date = start_date
        while current_date <= end_date:
            daily_menu = self.generate_daily_menu(current_date)
            
            for _, elderly in elderly_df.iterrows():
                for meal_type in MEAL_TYPES:
                    meal_dishes = daily_menu.get(meal_type, [])
                    
                    num_dishes = self._random.randint(max(1, len(meal_dishes) - 1), len(meal_dishes))
                    selected_dishes = self._random.sample(meal_dishes, num_dishes)
                    
                    for dish_code in selected_dishes:
                        dish_info = dish_df[dish_df['dish_code'] == dish_code]
                        if dish_info.empty:
                            continue
                        
                        category = dish_info['dish_category'].iloc[0]
                        
                        if category == "主食":
                            base_weight = self._random.randint(100, 150)
                        elif category == "荤菜":
                            base_weight = self._random.randint(80, 120)
                        elif category == "素菜":
                            base_weight = self._random.randint(100, 150)
                        elif category == "汤":
                            base_weight = self._random.randint(150, 200)
                        else:
                            base_weight = self._random.randint(50, 100)
                        
                        orders_data.append({
                            "order_id": f"O{order_id_counter:06d}",
                            "elderly_id": elderly['elderly_id'],
                            "date": current_date,
                            "meal_type": meal_type,
                            "dish_code": dish_code,
                            "planned_weight": base_weight,
                            "order_status": "已确认",
                            "notes": ""
                        })
                        order_id_counter += 1
            
            current_date += timedelta(days=1)
        
        return pd.DataFrame(orders_data)
    
    def generate_servings(self, orders_df: pd.DataFrame, elderly_df: pd.DataFrame) -> pd.DataFrame:
        servings_data = []
        serving_id_counter = 1
        
        for _, order in orders_df.iterrows():
            elderly = elderly_df[elderly_df['elderly_id'] == order['elderly_id']]
            
            chronic_diseases = ""
            if not elderly.empty:
                chronic_diseases = str(elderly['chronic_diseases'].iloc[0])
            
            planned = order['planned_weight']
            
            base_variation = self._np_random.normal(0, 10)
            
            chronic_factor = 1.0
            if "糖尿病" in chronic_diseases:
                if order['dish_category'] if 'dish_category' in order.index else "" in ["主食", "点心"]:
                    chronic_factor = 0.85
            
            if "高血压" in chronic_diseases:
                chronic_factor *= 0.95
            
            under_serve_chance = self._random.random()
            if under_serve_chance < 0.15:
                chronic_factor *= 0.75
            
            actual_weight = max(0, int(planned * chronic_factor + base_variation))
            actual_weight = min(actual_weight, int(planned * 1.2))
            
            if actual_weight <= 0:
                actual_weight = int(planned * 0.5)
            
            servings_data.append({
                "serving_id": f"S{serving_id_counter:06d}",
                "elderly_id": order['elderly_id'],
                "date": order['date'],
                "meal_type": order['meal_type'],
                "dish_code": order['dish_code'],
                "actual_weight": actual_weight,
                "serving_time": datetime.combine(order['date'], 
                                                 datetime.strptime(
                                                     self._get_meal_time(order['meal_type']), 
                                                     "%H:%M"
                                                 ).time()),
                "operator": self._random.choice(["李师傅", "王师傅", "张师傅", "刘师傅"]),
                "is_manual": False,
                "correction_reason": "",
                "notes": ""
            })
            serving_id_counter += 1
        
        return pd.DataFrame(servings_data)
    
    def _get_meal_time(self, meal_type: str) -> str:
        times = {
            "早餐": "07:30",
            "午餐": "11:30",
            "晚餐": "17:30"
        }
        return times.get(meal_type, "12:00")
    
    def generate_wastes(self, servings_df: pd.DataFrame, elderly_df: pd.DataFrame,
                       dish_df: pd.DataFrame) -> pd.DataFrame:
        wastes_data = []
        waste_id_counter = 1
        
        for _, serving in servings_df.iterrows():
            elderly = elderly_df[elderly_df['elderly_id'] == serving['elderly_id']]
            dish = dish_df[dish_df['dish_code'] == serving['dish_code']]
            
            chronic_diseases = ""
            if not elderly.empty:
                chronic_diseases = str(elderly['chronic_diseases'].iloc[0])
            
            dish_category = ""
            if not dish.empty:
                dish_category = dish['dish_category'].iloc[0]
            
            actual = serving['actual_weight']
            
            base_waste_rate = self._random.uniform(0, 0.25)
            
            if dish_category == "素菜":
                base_waste_rate += 0.1
            elif dish_category == "汤":
                base_waste_rate += 0.05
            elif dish_category == "荤菜":
                base_waste_rate -= 0.05
            
            if "糖尿病" in chronic_diseases and dish_category in ["主食", "点心"]:
                base_waste_rate += 0.15
            
            if "高血压" in chronic_diseases:
                if not dish.empty and dish['sodium_per_100g'].iloc[0] > 200:
                    base_waste_rate += 0.1
            
            waste_rate = max(0, min(1, base_waste_rate))
            waste_weight = int(actual * waste_rate)
            
            if waste_weight > 0:
                waste_reason = self._get_waste_reason(waste_rate, dish_category, chronic_diseases)
                
                wastes_data.append({
                    "waste_id": f"W{waste_id_counter:06d}",
                    "elderly_id": serving['elderly_id'],
                    "date": serving['date'],
                    "meal_type": serving['meal_type'],
                    "dish_code": serving['dish_code'],
                    "waste_weight": waste_weight,
                    "collection_time": datetime.combine(serving['date'], 
                                                        datetime.strptime(
                                                            self._get_collection_time(serving['meal_type']),
                                                            "%H:%M"
                                                        ).time()),
                    "collector": self._random.choice(["周阿姨", "吴阿姨", "郑阿姨"]),
                    "waste_reason": waste_reason,
                    "notes": ""
                })
                waste_id_counter += 1
        
        return pd.DataFrame(wastes_data)
    
    def _get_waste_reason(self, waste_rate: float, dish_category: str, chronic_diseases: str) -> str:
        if waste_rate > 0.5:
            return "几乎未动"
        elif waste_rate > 0.3:
            if "糖尿病" in chronic_diseases and dish_category in ["主食", "点心"]:
                return "控糖少吃"
            if "高血压" in chronic_diseases:
                return "太咸没吃"
            return "不合口味"
        elif waste_rate > 0.1:
            return "剩少量"
        else:
            return "正常剩余"
    
    def _get_collection_time(self, meal_type: str) -> str:
        times = {
            "早餐": "08:30",
            "午餐": "12:30",
            "晚餐": "18:30"
        }
        return times.get(meal_type, "13:00")


def generate_sample_elderly(num_elderly: int = 50) -> pd.DataFrame:
    generator = SampleDataGenerator({'num_elderly': num_elderly})
    return generator.generate_elderly_info()


def generate_sample_dishes(num_dishes: int = 30) -> pd.DataFrame:
    generator = SampleDataGenerator({'num_dishes': num_dishes})
    return generator.generate_dish_info()


def generate_sample_orders(elderly_df: pd.DataFrame, dish_df: pd.DataFrame,
                          start_date: date, end_date: date) -> pd.DataFrame:
    generator = SampleDataGenerator()
    return generator.generate_orders(elderly_df, dish_df, start_date, end_date)


def generate_sample_servings(orders_df: pd.DataFrame, elderly_df: pd.DataFrame) -> pd.DataFrame:
    generator = SampleDataGenerator()
    return generator.generate_servings(orders_df, elderly_df)


def generate_sample_wastes(servings_df: pd.DataFrame, elderly_df: pd.DataFrame,
                          dish_df: pd.DataFrame) -> pd.DataFrame:
    generator = SampleDataGenerator()
    return generator.generate_wastes(servings_df, elderly_df, dish_df)


def create_all_sample_data(start_date: Optional[date] = None,
                           end_date: Optional[date] = None,
                           num_elderly: int = 50,
                           num_dishes: int = 30) -> Dict[str, pd.DataFrame]:
    if start_date is None:
        start_date = date(2024, 1, 15)
    if end_date is None:
        end_date = start_date + timedelta(days=6)
    
    generator = SampleDataGenerator({
        'num_elderly': num_elderly,
        'num_dishes': num_dishes
    })
    
    elderly_df = generator.generate_elderly_info()
    dish_df = generator.generate_dish_info()
    orders_df = generator.generate_orders(elderly_df, dish_df, start_date, end_date)
    servings_df = generator.generate_servings(orders_df, elderly_df)
    wastes_df = generator.generate_wastes(servings_df, elderly_df, dish_df)
    
    return {
        'elderly': elderly_df,
        'dish': dish_df,
        'orders': orders_df,
        'servings': servings_df,
        'wastes': wastes_df
    }


def save_sample_data_to_csv(data: Dict[str, pd.DataFrame], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for name, df in data.items():
        file_path = output_dir / f"sample_{name}.csv"
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
        print(f"已保存: {file_path}")


if __name__ == "__main__":
    data = create_all_sample_data()
    print("\n示例数据生成完成:")
    for name, df in data.items():
        print(f"  {name}: {len(df)} 条记录")
