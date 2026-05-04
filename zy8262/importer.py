import json
import csv
import yaml
import geojson
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
import models
import schemas


class DataImporter:
    def __init__(self, db: Session):
        self.db = db

    def import_geojson(self, file_content: str) -> Dict[str, Any]:
        """Import trees from GeoJSON format"""
        imported_count = 0
        errors = []

        try:
            data = geojson.loads(file_content)
            if not hasattr(data, 'features'):
                return {"success": False, "message": "Invalid GeoJSON format - missing features", "imported_count": 0, "errors": []}

            for feature in data.features:
                try:
                    props = feature.properties
                    coords = feature.geometry.coordinates

                    tree_data = {
                        "tree_id": str(props.get("tree_id", "") or props.get("id", "")),
                        "latitude": coords[1] if len(coords) >= 2 else 0.0,
                        "longitude": coords[0] if len(coords) >= 2 else 0.0,
                        "species": props.get("species", ""),
                        "address": props.get("address", ""),
                        "district": props.get("district", ""),
                        "status": props.get("status", "healthy")
                    }

                    existing = self.db.query(models.Tree).filter(models.Tree.tree_id == tree_data["tree_id"]).first()
                    if existing:
                        for key, value in tree_data.items():
                            if key != "tree_id":
                                setattr(existing, key, value)
                    else:
                        tree = models.Tree(**tree_data)
                        self.db.add(tree)

                    imported_count += 1
                except Exception as e:
                    errors.append(f"Feature error: {str(e)}")

            self.db.commit()
            return {"success": True, "message": f"Imported {imported_count} trees", "imported_count": imported_count, "errors": errors}

        except Exception as e:
            return {"success": False, "message": f"GeoJSON parse error: {str(e)}", "imported_count": 0, "errors": [str(e)]}

    def import_csv(self, file_content: str) -> Dict[str, Any]:
        """Import inspections from CSV format"""
        imported_count = 0
        errors = []

        try:
            lines = file_content.strip().split('\n')
            reader = csv.DictReader(lines)

            for row in reader:
                try:
                    inspection_date_str = row.get("inspection_date", row.get("date", ""))
                    try:
                        inspection_date = datetime.fromisoformat(inspection_date_str.replace('Z', '+00:00'))
                    except ValueError:
                        inspection_date = datetime.now()

                    photo_paths_str = row.get("photo_paths", row.get("photos", "[]"))
                    try:
                        photo_paths = json.loads(photo_paths_str) if photo_paths_str else []
                    except json.JSONDecodeError:
                        photo_paths = photo_paths_str.split(",") if photo_paths_str else []

                    inspection_data = {
                        "inspection_id": str(row.get("inspection_id", row.get("id", ""))),
                        "tree_id": str(row.get("tree_id", "")),
                        "inspector": row.get("inspector", ""),
                        "inspection_date": inspection_date,
                        "photo_paths": photo_paths,
                        "pest_damage": row.get("pest_damage", "false").lower() in ["true", "1", "yes"],
                        "disease_present": row.get("disease_present", "false").lower() in ["true", "1", "yes"],
                        "health_status": row.get("health_status", "normal"),
                        "notes": row.get("notes", "")
                    }

                    existing = self.db.query(models.Inspection).filter(
                        models.Inspection.inspection_id == inspection_data["inspection_id"]
                    ).first()

                    photo_paths_json = json.dumps(inspection_data.pop("photo_paths", []))

                    if existing:
                        for key, value in inspection_data.items():
                            if key != "inspection_id":
                                setattr(existing, key, value)
                        existing.photo_paths = photo_paths_json
                    else:
                        inspection = models.Inspection(**inspection_data, photo_paths=photo_paths_json)
                        self.db.add(inspection)

                    imported_count += 1
                except Exception as e:
                    errors.append(f"Row error: {str(e)}")

            self.db.commit()
            return {"success": True, "message": f"Imported {imported_count} inspections", "imported_count": imported_count, "errors": errors}

        except Exception as e:
            return {"success": False, "message": f"CSV parse error: {str(e)}", "imported_count": 0, "errors": [str(e)]}

    def import_jsonl(self, file_content: str) -> Dict[str, Any]:
        """Import treatments from JSONL format"""
        imported_count = 0
        errors = []

        try:
            lines = file_content.strip().split('\n')

            for line_num, line in enumerate(lines, 1):
                if not line.strip():
                    continue

                try:
                    row = json.loads(line)

                    treatment_date_str = row.get("treatment_date", row.get("date", ""))
                    try:
                        treatment_date = datetime.fromisoformat(treatment_date_str.replace('Z', '+00:00'))
                    except ValueError:
                        treatment_date = datetime.now()

                    treatment_data = {
                        "treatment_id": str(row.get("treatment_id", row.get("id", ""))),
                        "tree_id": str(row.get("tree_id", "")),
                        "inspector": row.get("inspector", ""),
                        "treatment_date": treatment_date,
                        "chemical_used": row.get("chemical_used", row.get("chemical", "")),
                        "dosage": row.get("dosage", ""),
                        "treatment_type": row.get("treatment_type", ""),
                        "notes": row.get("notes", ""),
                        "is_effective": row.get("is_effective")
                    }

                    existing = self.db.query(models.Treatment).filter(
                        models.Treatment.treatment_id == treatment_data["treatment_id"]
                    ).first()

                    if existing:
                        for key, value in treatment_data.items():
                            if key != "treatment_id" and value is not None:
                                setattr(existing, key, value)
                    else:
                        treatment = models.Treatment(**treatment_data)
                        self.db.add(treatment)

                    imported_count += 1
                except json.JSONDecodeError as e:
                    errors.append(f"Line {line_num} JSON parse error: {str(e)}")
                except Exception as e:
                    errors.append(f"Line {line_num} error: {str(e)}")

            self.db.commit()
            return {"success": True, "message": f"Imported {imported_count} treatments", "imported_count": imported_count, "errors": errors}

        except Exception as e:
            return {"success": False, "message": f"JSONL parse error: {str(e)}", "imported_count": 0, "errors": [str(e)]}

    def import_yaml(self, file_content: str) -> Dict[str, Any]:
        """Import rules from YAML format"""
        imported_count = 0
        errors = []

        try:
            data = yaml.safe_load(file_content)

            if data and "rules" in data:
                for rule in data["rules"]:
                    try:
                        rule_data = {
                            "rule_type": rule.get("type", rule.get("rule_type", "")),
                            "name": rule.get("name", ""),
                            "value": json.dumps(rule.get("value", rule.get("values", []))) if isinstance(rule.get("value"), (list, dict)) else str(rule.get("value", "")),
                            "description": rule.get("description", ""),
                            "is_active": rule.get("active", True)
                        }

                        existing = self.db.query(models.Rule).filter(
                            models.Rule.rule_type == rule_data["rule_type"],
                            models.Rule.name == rule_data["name"]
                        ).first()

                        if existing:
                            for key, value in rule_data.items():
                                setattr(existing, key, value)
                        else:
                            rule_obj = models.Rule(**rule_data)
                            self.db.add(rule_obj)

                        imported_count += 1
                    except Exception as e:
                        errors.append(f"Rule error: {str(e)}")

                self.db.commit()
                return {"success": True, "message": f"Imported {imported_count} rules", "imported_count": imported_count, "errors": errors}
            else:
                return {"success": False, "message": "Invalid YAML format - missing 'rules' key", "imported_count": 0, "errors": []}

        except Exception as e:
            return {"success": False, "message": f"YAML parse error: {str(e)}", "imported_count": 0, "errors": [str(e)]}
