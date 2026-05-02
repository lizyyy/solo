from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import random
import pandas as pd
import numpy as np

from config import config, ensure_directories


class SampleDataGenerator:
    def __init__(self):
        ensure_directories()
        self.sample_dir = config.SAMPLE_DATA_DIR
        self._setup_random_seed()

    def _setup_random_seed(self):
        random.seed(42)
        np.random.seed(42)

    def generate_patient_data(self, num_patients: int = 10) -> pd.DataFrame:
        patient_names = [
            "张三", "李四", "王五", "赵六", "钱七",
            "孙八", "周九", "吴十", "郑十一", "冯十二",
            "陈十三", "褚十四", "卫十五", "蒋十六", "沈十七"
        ]
        diagnoses = [
            "脑卒中后偏瘫", "膝关节置换术后", "腰椎间盘突出",
            "肩周炎", "髋关节置换术后", "颈椎病", "帕金森病",
            "骨折后康复", "脊髓损伤", "慢性疼痛综合征"
        ]
        genders = ["男", "女"]

        patients = []
        for i in range(num_patients):
            patient_id = f"P{str(i+1).zfill(4)}"
            age = random.randint(60, 85)
            gender = random.choice(genders)
            name = patient_names[i % len(patient_names)]
            
            patients.append({
                "patient_id": patient_id,
                "name": name,
                "age": age,
                "gender": gender,
                "primary_diagnosis": random.choice(diagnoses),
                "treatment_plan": "每周居家训练5天，每日30分钟",
                "admission_date": str(date(2024, 1, random.randint(1, 28))),
                "notes": f"患者{name}，{age}岁，诊断为{random.choice(diagnoses)}，需要密切关注训练依从性",
            })

        return pd.DataFrame(patients)

    def generate_training_records(
        self,
        patient_ids: List[str],
        start_date: date,
        end_date: date,
    ) -> pd.DataFrame:
        training_programs = [
            "上肢力量训练", "下肢力量训练", "平衡训练",
            "关节活动度训练", "步行训练", "核心稳定性训练",
            "柔韧性训练", "协调性训练", "肌力强化训练"
        ]

        difficulty_levels = ["简单", "中等", "困难"]

        records = []
        current_date = start_date

        patient_profiles = {}
        for pid in patient_ids:
            base_compliance = random.uniform(0.3, 1.0)
            patient_profiles[pid] = {
                "base_compliance": base_compliance,
                "trend": random.choice(["stable", "improving", "declining"]),
            }

        day_counter = 0
        while current_date <= end_date:
            for patient_id in patient_ids:
                profile = patient_profiles[patient_id]
                compliance_factor = profile["base_compliance"]

                if profile["trend"] == "improving":
                    compliance_factor += day_counter * 0.01
                elif profile["trend"] == "declining":
                    compliance_factor -= day_counter * 0.01

                compliance_factor = max(0.1, min(1.0, compliance_factor))

                if random.random() < compliance_factor:
                    num_programs = random.randint(1, 3)
                    selected_programs = random.sample(training_programs, num_programs)

                    for program in selected_programs:
                        is_completed = random.random() < 0.85
                        completion_percentage = random.randint(60, 100) if is_completed else random.randint(20, 50)
                        duration = random.randint(15, 45) if is_completed else random.randint(5, 15)

                        records.append({
                            "patient_id": patient_id,
                            "date": str(current_date),
                            "training_program": program,
                            "is_completed": "是" if is_completed else "否",
                            "completion_percentage": completion_percentage,
                            "duration_minutes": duration,
                            "difficulty_level": random.choice(difficulty_levels),
                            "notes": f"训练{program}，完成度{completion_percentage}%" if random.random() < 0.3 else "",
                        })

            current_date += timedelta(days=1)
            day_counter += 1

        return pd.DataFrame(records)

    def generate_pain_records(
        self,
        patient_ids: List[str],
        start_date: date,
        end_date: date,
    ) -> pd.DataFrame:
        pain_locations = [
            "左膝关节", "右膝关节", "腰部", "左肩", "右肩",
            "左髋关节", "右髋关节", "颈部", "背部", "全身"
        ]
        pain_types = ["酸痛", "刺痛", "胀痛", "麻木", "僵硬"]

        records = []
        current_date = start_date

        patient_pain_profiles = {}
        for pid in patient_ids:
            base_pain = random.randint(2, 6)
            patient_pain_profiles[pid] = {
                "base_pain": base_pain,
                "trend": random.choice(["stable", "improving", "worsening"]),
                "location": random.choice(pain_locations),
            }

        day_counter = 0
        while current_date <= end_date:
            for patient_id in patient_ids:
                if random.random() < 0.7:
                    profile = patient_pain_profiles[patient_id]
                    pain_score = profile["base_pain"]

                    if profile["trend"] == "improving":
                        pain_score -= int(day_counter / 7)
                    elif profile["trend"] == "worsening":
                        pain_score += int(day_counter / 7)

                    pain_score += random.randint(-1, 1)
                    pain_score = max(0, min(10, pain_score))

                    records.append({
                        "patient_id": patient_id,
                        "date": str(current_date),
                        "pain_location": profile["location"],
                        "pain_score": pain_score,
                        "pain_type": random.choice(pain_types),
                        "notes": f"疼痛评分{pain_score}分，位置{profile['location']}" if random.random() < 0.4 else "",
                    })

            current_date += timedelta(days=1)
            day_counter += 1

        return pd.DataFrame(records)

    def generate_movement_records(
        self,
        patient_ids: List[str],
        start_date: date,
        end_date: date,
    ) -> pd.DataFrame:
        movements = [
            "仰卧位直腿抬高", "坐位站起", "步行10米", "上下楼梯",
            "单腿站立", "髋关节屈伸", "膝关节屈伸", "肩关节外展",
            "肘关节屈伸", "腕关节活动", "手指抓握", "平衡站立"
        ]

        records = []
        current_date = start_date

        patient_movement_profiles = {}
        for pid in patient_ids:
            base_score = random.randint(50, 90)
            patient_movement_profiles[pid] = {
                "base_score": base_score,
                "volatility": random.uniform(0.05, 0.35),
                "trend": random.choice(["stable", "improving", "declining"]),
            }

        day_counter = 0
        while current_date <= end_date:
            for patient_id in patient_ids:
                if random.random() < 0.6:
                    profile = patient_movement_profiles[patient_id]
                    num_movements = random.randint(1, 4)
                    selected_movements = random.sample(movements, num_movements)

                    for movement in selected_movements:
                        base_score = profile["base_score"]
                        
                        if profile["trend"] == "improving":
                            base_score += day_counter * 0.5
                        elif profile["trend"] == "declining":
                            base_score -= day_counter * 0.3

                        volatility = profile["volatility"]
                        score_variation = np.random.normal(0, volatility * 20)
                        
                        completion_score = int(base_score + score_variation)
                        completion_score = max(20, min(100, completion_score))

                        form_quality = completion_score + random.randint(-10, 10)
                        form_quality = max(20, min(100, form_quality))

                        range_of_motion = completion_score + random.randint(-15, 5)
                        range_of_motion = max(20, min(100, range_of_motion))

                        symmetry_score = completion_score + random.randint(-5, 15)
                        symmetry_score = max(20, min(100, symmetry_score))

                        records.append({
                            "patient_id": patient_id,
                            "date": str(current_date),
                            "movement_name": movement,
                            "completion_score": completion_score,
                            "form_quality": form_quality,
                            "range_of_motion": range_of_motion,
                            "symmetry_score": symmetry_score,
                            "notes": f"完成{movement}，动作质量{form_quality}分" if random.random() < 0.2 else "",
                        })

            current_date += timedelta(days=1)
            day_counter += 1

        return pd.DataFrame(records)

    def generate_followup_records(
        self,
        patient_ids: List[str],
        start_date: date,
        end_date: date,
    ) -> pd.DataFrame:
        therapists = ["王医生", "李治疗师", "张康复师", "刘护士", "陈医师"]
        followup_types = ["电话随访", "上门随访", "门诊复查", "远程视频"]

        records = []

        for patient_id in patient_ids:
            num_followups = random.randint(1, 4)
            current = start_date

            for _ in range(num_followups):
                days_to_add = random.randint(7, 21)
                followup_date = current + timedelta(days=days_to_add)

                if followup_date > end_date:
                    break

                summary_options = [
                    "患者训练依从性良好，疼痛评分稳定，建议继续当前训练计划",
                    "患者近期缺训较多，需要加强督促，考虑调整训练难度",
                    "患者疼痛评分有所上升，建议咨询医生是否需要调整用药或训练强度",
                    "患者动作完成质量提升明显，建议适当增加训练难度",
                    "患者整体情况稳定，继续观察，两周后再次随访",
                ]

                recommendation_options = [
                    "继续当前训练计划，每日训练30分钟",
                    "增加随访频率，改为每周一次电话随访",
                    "建议门诊复查，评估疼痛原因",
                    "调整训练计划，降低难度，增加趣味性",
                    "建议家属加强督促，提高训练依从性",
                ]

                records.append({
                    "patient_id": patient_id,
                    "date": str(followup_date),
                    "therapist_name": random.choice(therapists),
                    "follow_up_type": random.choice(followup_types),
                    "summary": random.choice(summary_options),
                    "recommendations": random.choice(recommendation_options),
                    "next_follow_up_date": str(followup_date + timedelta(days=14)),
                })

                current = followup_date

        return pd.DataFrame(records)

    def generate_all_sample_data(
        self,
        num_patients: int = 10,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Dict[str, pd.DataFrame]:
        if start_date is None:
            start_date = date.today() - timedelta(days=28)
        if end_date is None:
            end_date = date.today()

        patient_df = self.generate_patient_data(num_patients=num_patients)
        patient_ids = patient_df["patient_id"].tolist()

        training_df = self.generate_training_records(
            patient_ids=patient_ids,
            start_date=start_date,
            end_date=end_date,
        )

        pain_df = self.generate_pain_records(
            patient_ids=patient_ids,
            start_date=start_date,
            end_date=end_date,
        )

        movement_df = self.generate_movement_records(
            patient_ids=patient_ids,
            start_date=start_date,
            end_date=end_date,
        )

        followup_df = self.generate_followup_records(
            patient_ids=patient_ids,
            start_date=start_date,
            end_date=end_date,
        )

        return {
            "patient": patient_df,
            "training": training_df,
            "pain": pain_df,
            "movement": movement_df,
            "followup": followup_df,
        }

    def save_sample_data_to_csv(
        self,
        data_dict: Dict[str, pd.DataFrame],
        prefix: str = "sample",
    ) -> Dict[str, Path]:
        file_paths = {}

        for data_type, df in data_dict.items():
            file_name = f"{prefix}_{data_type}_{date.today().strftime('%Y%m%d')}.csv"
            file_path = self.sample_dir / file_name

            df.to_csv(file_path, index=False, encoding="utf-8-sig")
            file_paths[data_type] = file_path

        return file_paths

    def generate_and_save_sample_data(
        self,
        num_patients: int = 10,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        prefix: str = "sample",
    ) -> Dict[str, Path]:
        data_dict = self.generate_all_sample_data(
            num_patients=num_patients,
            start_date=start_date,
            end_date=end_date,
        )

        return self.save_sample_data_to_csv(data_dict, prefix=prefix)
