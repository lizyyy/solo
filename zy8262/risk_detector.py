import json
from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models


class RiskDetector:
    def __init__(self, db: Session):
        self.db = db
        self._banned_chemicals = None

    def _get_banned_chemicals(self) -> List[str]:
        """获取禁用化学品列表"""
        if self._banned_chemicals is None:
            rules = self.db.query(models.Rule).filter(
                models.Rule.rule_type == "banned_chemical",
                models.Rule.is_active == True
            ).all()
            banned = []
            for rule in rules:
                try:
                    values = json.loads(rule.value)
                    if isinstance(values, list):
                        banned.extend(values)
                    else:
                        banned.append(str(rule.value))
                except json.JSONDecodeError:
                    banned.append(str(rule.value))
            self._banned_chemicals = [c.lower() for c in banned]
        return self._banned_chemicals

    def detect_duplicate_coordinates(self) -> List[Dict[str, Any]]:
        """检测同一树号重复坐标或不同树号相同坐标"""
        risks = []
        
        trees = self.db.query(models.Tree).all()
        coord_map = {}
        
        for tree in trees:
            coord_key = (round(tree.latitude, 6), round(tree.longitude, 6))
            if coord_key in coord_map:
                existing_tree = coord_map[coord_key]
                risks.append({
                    "risk_type": "duplicate_coordinate",
                    "severity": "high",
                    "tree_id": tree.tree_id,
                    "description": f"树木 {tree.tree_id} 与树木 {existing_tree.tree_id} 坐标重复",
                    "details": f"坐标: ({tree.latitude}, {tree.longitude}) 被多个树号使用: {tree.tree_id}, {existing_tree.tree_id}"
                })
            else:
                coord_map[coord_key] = tree
        
        return risks

    def detect_missing_photos(self) -> List[Dict[str, Any]]:
        """检测巡检照片缺失"""
        risks = []
        
        inspections = self.db.query(models.Inspection).all()
        
        for inspection in inspections:
            try:
                photos = json.loads(inspection.photo_paths)
            except json.JSONDecodeError:
                photos = []
            
            if not photos or len(photos) == 0:
                risks.append({
                    "risk_type": "missing_photo",
                    "severity": "medium",
                    "tree_id": inspection.tree_id,
                    "inspection_id": inspection.inspection_id,
                    "description": f"巡检记录 {inspection.inspection_id} 缺少照片",
                    "details": f"巡检日期: {inspection.inspection_date}, 巡检人: {inspection.inspector}"
                })
        
        return risks

    def detect_banned_chemicals(self) -> List[Dict[str, Any]]:
        """检测使用禁用药剂"""
        risks = []
        banned = self._get_banned_chemicals()
        
        if not banned:
            return risks
        
        treatments = self.db.query(models.Treatment).all()
        
        for treatment in treatments:
            chemical = treatment.chemical_used.lower().strip()
            if chemical and chemical in banned:
                risks.append({
                    "risk_type": "banned_chemical",
                    "severity": "critical",
                    "tree_id": treatment.tree_id,
                    "treatment_id": treatment.treatment_id,
                    "description": f"使用了禁用药剂: {treatment.chemical_used}",
                    "details": f"处置日期: {treatment.treatment_date}, 巡检人: {treatment.inspector}"
                })
        
        return risks

    def detect_rain_after_spray(self) -> List[Dict[str, Any]]:
        """检测雨后24小时内喷药无效"""
        risks = []
        
        rain_rules = self.db.query(models.Rule).filter(
            models.Rule.rule_type == "rain_record",
            models.Rule.is_active == True
        ).all()
        
        rain_dates = []
        for rule in rain_rules:
            try:
                values = json.loads(rule.value)
                if isinstance(values, list):
                    for v in values:
                        try:
                            rain_dates.append(datetime.fromisoformat(v.replace('Z', '+00:00')))
                        except ValueError:
                            pass
                else:
                    try:
                        rain_dates.append(datetime.fromisoformat(str(rule.value).replace('Z', '+00:00')))
                    except ValueError:
                        pass
            except json.JSONDecodeError:
                try:
                    rain_dates.append(datetime.fromisoformat(str(rule.value).replace('Z', '+00:00')))
                except ValueError:
                    pass
        
        if not rain_dates:
            return risks
        
        treatments = self.db.query(models.Treatment).filter(
            models.Treatment.treatment_type.in_(["spray", "喷施", "喷药", "chemical", "喷洒"])
        ).all()
        
        for treatment in treatments:
            treatment_time = treatment.treatment_date
            for rain_time in rain_dates:
                time_diff = treatment_time - rain_time
                if timedelta(hours=0) <= time_diff <= timedelta(hours=24):
                    risks.append({
                        "risk_type": "spray_after_rain",
                        "severity": "high",
                        "tree_id": treatment.tree_id,
                        "treatment_id": treatment.treatment_id,
                        "description": "雨后24小时内喷药可能无效",
                        "details": f"降雨时间: {rain_time}, 喷药时间: {treatment_time}, 间隔: {time_diff.total_seconds()/3600:.1f}小时"
                    })
                    break
        
        return risks

    def detect_midnight_inspection(self) -> List[Dict[str, Any]]:
        """检测跨午夜巡检归属错误"""
        risks = []
        
        inspections = self.db.query(models.Inspection).all()
        
        for inspection in inspections:
            inspection_time = inspection.inspection_date
            hour = inspection_time.hour
            
            if 0 <= hour < 6:
                risks.append({
                    "risk_type": "midnight_inspection",
                    "severity": "medium",
                    "tree_id": inspection.tree_id,
                    "inspection_id": inspection.inspection_id,
                    "description": "跨午夜巡检，归属日期可能错误",
                    "details": f"巡检时间: {inspection_time}, 凌晨 {hour} 点进行，可能应归属于前一天"
                })
        
        return risks

    def detect_all_risks(self) -> List[Dict[str, Any]]:
        """检测所有风险"""
        all_risks = []
        all_risks.extend(self.detect_duplicate_coordinates())
        all_risks.extend(self.detect_missing_photos())
        all_risks.extend(self.detect_banned_chemicals())
        all_risks.extend(self.detect_rain_after_spray())
        all_risks.extend(self.detect_midnight_inspection())
        return all_risks

    def save_risks(self, risks: List[Dict[str, Any]]) -> int:
        """保存检测到的风险到数据库"""
        count = 0
        for risk_data in risks:
            existing = self.db.query(models.Risk).filter(
                models.Risk.risk_type == risk_data["risk_type"],
                models.Risk.tree_id == risk_data.get("tree_id"),
                models.Risk.inspection_id == risk_data.get("inspection_id"),
                models.Risk.treatment_id == risk_data.get("treatment_id")
            ).first()
            
            if not existing:
                risk = models.Risk(**risk_data)
                self.db.add(risk)
                count += 1
        
        self.db.commit()
        return count

    def run_detection(self) -> Dict[str, Any]:
        """运行完整的风险检测"""
        risks = self.detect_all_risks()
        saved_count = self.save_risks(risks)
        
        risk_summary = {}
        for risk in risks:
            risk_type = risk["risk_type"]
            if risk_type not in risk_summary:
                risk_summary[risk_type] = {"count": 0, "severity": risk["severity"]}
            risk_summary[risk_type]["count"] += 1
        
        return {
            "total_risks": len(risks),
            "new_risks": saved_count,
            "risk_summary": risk_summary,
            "risks": risks
        }
