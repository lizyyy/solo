import csv
from typing import List, Dict, Any
from datetime import datetime

from ..risk.models import RiskAssessment, RiskLevel, RiskCategory


class CSVExporter:
    def __init__(self):
        pass

    def export_risk_points(self, assessment: RiskAssessment) -> List[Dict[str, Any]]:
        rows = []
        for risk in assessment.risk_points:
            row = {
                'risk_id': risk.risk_id,
                'category': risk.category.value,
                'level': risk.level.value,
                'lat': risk.location.get('lat', '') if risk.location else '',
                'lon': risk.location.get('lon', '') if risk.location else '',
                'elevation': risk.location.get('elevation', '') if risk.location else '',
                'description': risk.description,
                'recommendations': ' | '.join(risk.recommendations),
                'timestamp': risk.timestamp.isoformat()
            }
            for key, value in risk.details.items():
                if isinstance(value, float):
                    row[f'detail_{key}'] = f"{value:.2f}"
                else:
                    row[f'detail_{key}'] = str(value)
            rows.append(row)
        return rows

    def export_retreat_points(self, assessment: RiskAssessment) -> List[Dict[str, Any]]:
        rows = []
        for rp in assessment.retreat_points:
            row = {
                'point_id': rp.point_id,
                'name': rp.name or '',
                'lat': rp.location.get('lat', ''),
                'lon': rp.location.get('lon', ''),
                'elevation': rp.location.get('elevation', ''),
                'distance_from_start': f"{rp.distance_from_start/1000:.2f}km",
                'reason': rp.reason,
                'risk_level': rp.risk_level.value,
                'backtrack_distance': f"{rp.backtrack_distance/1000:.2f}km",
                'safety_assessment': rp.safety_assessment
            }
            rows.append(row)
        return rows

    def export_supply_points(self, assessment: RiskAssessment) -> List[Dict[str, Any]]:
        rows = []
        for sp in assessment.supply_points:
            row = {
                'point_id': sp.point_id,
                'name': sp.name or '',
                'lat': sp.location.get('lat', ''),
                'lon': sp.location.get('lon', ''),
                'elevation': sp.location.get('elevation', ''),
                'water_available': sp.water_available,
                'food_available': sp.food_available,
                'is_emergency': '是' if sp.is_emergency else '否',
                'distance_from_last': f"{sp.distance_from_last/1000:.2f}km"
            }
            rows.append(row)
        return rows

    def write_risk_points(self, file_path: str, assessment: RiskAssessment) -> None:
        rows = self.export_risk_points(assessment)
        if not rows:
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['风险点列表为空'])
            return

        all_fieldnames = set()
        for row in rows:
            all_fieldnames.update(row.keys())
        
        base_fields = ['risk_id', 'category', 'level', 'lat', 'lon', 'elevation', 'description', 'recommendations', 'timestamp']
        detail_fields = sorted([f for f in all_fieldnames if f.startswith('detail_')])
        fieldnames = [f for f in base_fields if f in all_fieldnames] + detail_fields

        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(rows)

    def write_retreat_points(self, file_path: str, assessment: RiskAssessment) -> None:
        rows = self.export_retreat_points(assessment)
        if not rows:
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['撤返点列表为空'])
            return

        fieldnames = list(rows[0].keys())
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def write_supply_points(self, file_path: str, assessment: RiskAssessment) -> None:
        rows = self.export_supply_points(assessment)
        if not rows:
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['补给点列表为空'])
            return

        fieldnames = list(rows[0].keys())
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def write_all(self, base_path: str, assessment: RiskAssessment) -> Dict[str, str]:
        files_written = {}

        risk_file = f"{base_path}_risk_points.csv"
        self.write_risk_points(risk_file, assessment)
        files_written['risk_points'] = risk_file

        retreat_file = f"{base_path}_retreat_points.csv"
        self.write_retreat_points(retreat_file, assessment)
        files_written['retreat_points'] = retreat_file

        supply_file = f"{base_path}_supply_points.csv"
        self.write_supply_points(supply_file, assessment)
        files_written['supply_points'] = supply_file

        return files_written
