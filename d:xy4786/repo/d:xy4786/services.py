import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from database import get_db, calculate_hash, generate_batch_number
from seeds import SEED_DATA, get_seed_by_type, get_all_seed_types


class MigrationService:
    
    @staticmethod
    def create_batch(source: str = "system") -> str:
        batch_number = generate_batch_number()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO batch_records (batch_number, source, status) VALUES (?, ?, ?)",
                (batch_number, source, "created")
            )
            conn.commit()
        return batch_number
    
    @staticmethod
    def update_batch_status(batch_number: str, status: str, notes: str = None):
        with get_db() as conn:
            cursor = conn.cursor()
            if status == "completed":
                cursor.execute(
                    "UPDATE batch_records SET status = ?, completed_at = CURRENT_TIMESTAMP, notes = ? WHERE batch_number = ?",
                    (status, notes, batch_number)
                )
            else:
                cursor.execute(
                    "UPDATE batch_records SET status = ?, notes = ? WHERE batch_number = ?",
                    (status, notes, batch_number)
                )
            conn.commit()
    
    @staticmethod
    def one_click_init() -> Dict[str, Any]:
        batch_number = MigrationService.create_batch("one_click_init")
        
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                
                cursor.execute(
                    "INSERT OR REPLACE INTO migration_versions (version, description, status, applied_at) VALUES (?, ?, 'applied', CURRENT_TIMESTAMP)",
                    ("v1.0.0", "一键初始化 - 基础数据结构")
                )
                
                for window in SEED_DATA["windows"]:
                    window_hash = calculate_hash(window)
                    cursor.execute('''
                        INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                        VALUES (?, ?, ?, ?, 'applied', ?)
                    ''', ("window", window["code"], json.dumps(window, ensure_ascii=False), batch_number, window_hash))
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO windows (code, name, description, floor, status)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (window["code"], window["name"], window["description"], window["floor"], window["status"]))
                
                for allergen in SEED_DATA["allergens"]:
                    allergen_hash = calculate_hash(allergen)
                    cursor.execute('''
                        INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                        VALUES (?, ?, ?, ?, 'applied', ?)
                    ''', ("allergen", allergen["code"], json.dumps(allergen, ensure_ascii=False), batch_number, allergen_hash))
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO allergens (code, name, description, icon)
                        VALUES (?, ?, ?, ?)
                    ''', (allergen["code"], allergen["name"], allergen["description"], allergen["icon"]))
                
                for role in SEED_DATA["roles"]:
                    role_data = role.copy()
                    role_data["permissions"] = json.dumps(role["permissions"], ensure_ascii=False)
                    role_hash = calculate_hash(role)
                    cursor.execute('''
                        INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                        VALUES (?, ?, ?, ?, 'applied', ?)
                    ''', ("role", role["code"], json.dumps(role, ensure_ascii=False), batch_number, role_hash))
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO roles (code, name, description, permissions, is_default)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (role["code"], role["name"], role["description"], json.dumps(role["permissions"], ensure_ascii=False), role["is_default"]))
                
                for package in SEED_DATA["packages"]:
                    package_data = package.copy()
                    package_data["allergens"] = json.dumps(package["allergens"], ensure_ascii=False)
                    package_hash = calculate_hash(package)
                    cursor.execute('''
                        INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                        VALUES (?, ?, ?, ?, 'applied', ?)
                    ''', ("package", package["code"], json.dumps(package, ensure_ascii=False), batch_number, package_hash))
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO packages (code, name, description, price, window_code, allergens, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (package["code"], package["name"], package["description"], package["price"], 
                          package["window_code"], json.dumps(package["allergens"], ensure_ascii=False), package["status"]))
                
                conn.commit()
                
            MigrationService.update_batch_status(batch_number, "completed", "一键初始化完成")
            
            return {
                "success": True,
                "batch_number": batch_number,
                "message": "初始化完成",
                "details": {
                    "windows_count": len(SEED_DATA["windows"]),
                    "allergens_count": len(SEED_DATA["allergens"]),
                    "roles_count": len(SEED_DATA["roles"]),
                    "packages_count": len(SEED_DATA["packages"])
                }
            }
        except Exception as e:
            MigrationService.update_batch_status(batch_number, "failed", str(e))
            return {
                "success": False,
                "batch_number": batch_number,
                "message": f"初始化失败: {str(e)}"
            }
    
    @staticmethod
    def import_old_sample() -> Dict[str, Any]:
        batch_number = MigrationService.create_batch("import_old_sample")
        
        old_sample_data = {
            "windows": [
                {"code": "WIN001", "name": "早餐窗口", "description": "旧版：早餐供应", "floor": 1, "status": "active"},
                {"code": "WIN002", "name": "午餐窗口", "description": "旧版：午餐供应", "floor": 1, "status": "active"},
                {"code": "WIN006", "name": "夜宵窗口", "description": "旧版新增", "floor": 1, "status": "active"}
            ],
            "allergens": [
                {"code": "ALLER001", "name": "花生", "description": "花生制品", "icon": "🥜"},
                {"code": "ALLER007", "name": "辣椒", "description": "辛辣食品", "icon": "🌶️"}
            ],
            "roles": [
                {"code": "ROLE_STAFF", "name": "工作人员", "description": "旧版员工", "permissions": ["order:read"], "is_default": 1},
                {"code": "ROLE_TEACHER", "name": "教师", "description": "旧版教师角色", "permissions": ["menu:read"], "is_default": 0}
            ],
            "packages": [
                {"code": "PKG001", "name": "早餐套餐", "description": "旧版早餐A", "price": 8.0, "window_code": "WIN001", "allergens": ["ALLER004"], "status": "active"},
                {"code": "PKG009", "name": "旧版特色", "description": "已废弃套餐", "price": 20.0, "window_code": "WIN006", "allergens": [], "status": "inactive"}
            ]
        }
        
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                
                for window in old_sample_data["windows"]:
                    window_hash = calculate_hash(window)
                    cursor.execute('''
                        INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                        VALUES (?, ?, ?, ?, 'imported', ?)
                    ''', ("window", window["code"], json.dumps(window, ensure_ascii=False), batch_number, window_hash))
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO windows (code, name, description, floor, status)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (window["code"], window["name"], window["description"], window["floor"], window["status"]))
                
                for allergen in old_sample_data["allergens"]:
                    allergen_hash = calculate_hash(allergen)
                    cursor.execute('''
                        INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                        VALUES (?, ?, ?, ?, 'imported', ?)
                    ''', ("allergen", allergen["code"], json.dumps(allergen, ensure_ascii=False), batch_number, allergen_hash))
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO allergens (code, name, description, icon)
                        VALUES (?, ?, ?, ?)
                    ''', (allergen["code"], allergen["name"], allergen["description"], allergen["icon"]))
                
                for role in old_sample_data["roles"]:
                    role_hash = calculate_hash(role)
                    cursor.execute('''
                        INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                        VALUES (?, ?, ?, ?, 'imported', ?)
                    ''', ("role", role["code"], json.dumps(role, ensure_ascii=False), batch_number, role_hash))
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO roles (code, name, description, permissions, is_default)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (role["code"], role["name"], role["description"], json.dumps(role["permissions"], ensure_ascii=False), role["is_default"]))
                
                for package in old_sample_data["packages"]:
                    package_hash = calculate_hash(package)
                    cursor.execute('''
                        INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                        VALUES (?, ?, ?, ?, 'imported', ?)
                    ''', ("package", package["code"], json.dumps(package, ensure_ascii=False), batch_number, package_hash))
                    
                    cursor.execute('''
                        INSERT OR REPLACE INTO packages (code, name, description, price, window_code, allergens, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (package["code"], package["name"], package["description"], package["price"], 
                          package["window_code"], json.dumps(package["allergens"], ensure_ascii=False), package["status"]))
                
                conn.commit()
            
            MigrationService.update_batch_status(batch_number, "completed", "旧库样例导入完成")
            
            return {
                "success": True,
                "batch_number": batch_number,
                "message": "旧库样例导入完成",
                "details": {
                    "windows_count": len(old_sample_data["windows"]),
                    "allergens_count": len(old_sample_data["allergens"]),
                    "roles_count": len(old_sample_data["roles"]),
                    "packages_count": len(old_sample_data["packages"])
                }
            }
        except Exception as e:
            MigrationService.update_batch_status(batch_number, "failed", str(e))
            return {
                "success": False,
                "batch_number": batch_number,
                "message": f"导入失败: {str(e)}"
            }
    
    @staticmethod
    def precheck_diff() -> Dict[str, Any]:
        diff_report = {
            "summary": {
                "total_expected": 0,
                "total_actual": 0,
                "matched": 0,
                "missing": 0,
                "mismatched": 0,
                "extra": 0
            },
            "details": {}
        }
        
        seed_types = ["window", "allergen", "role", "package"]
        
        for seed_type in seed_types:
            expected_seeds = get_seed_by_type(seed_type)
            
            with get_db() as conn:
                cursor = conn.cursor()
                
                table_name = {
                    "window": "windows",
                    "allergen": "allergens",
                    "role": "roles",
                    "package": "packages"
                }[seed_type]
                
                id_field = "code"
                
                cursor.execute(f"SELECT * FROM {table_name}")
                actual_rows = cursor.fetchall()
                actual_dict = {}
                for row in actual_rows:
                    row_dict = dict(row)
                    if "permissions" in row_dict and row_dict["permissions"]:
                        row_dict["permissions"] = json.loads(row_dict["permissions"])
                    if "allergens" in row_dict and row_dict["allergens"]:
                        row_dict["allergens"] = json.loads(row_dict["allergens"])
                    actual_dict[row_dict[id_field]] = row_dict
                
                type_diff = {
                    "expected_count": len(expected_seeds),
                    "actual_count": len(actual_dict),
                    "matched": [],
                    "missing": [],
                    "mismatched": [],
                    "extra": []
                }
                
                for expected in expected_seeds:
                    expected_id = expected["code"]
                    expected_hash = calculate_hash(expected)
                    
                    if expected_id not in actual_dict:
                        type_diff["missing"].append({
                            "id": expected_id,
                            "expected": expected
                        })
                    else:
                        actual = actual_dict[expected_id]
                        
                        actual_clean = {k: v for k, v in actual.items() if k not in ["id", "created_at", "updated_at"]}
                        
                        actual_hash = calculate_hash(actual_clean)
                        
                        if expected_hash == actual_hash:
                            type_diff["matched"].append(expected_id)
                        else:
                            type_diff["mismatched"].append({
                                "id": expected_id,
                                "expected": expected,
                                "actual": actual_clean,
                                "diff_fields": MigrationService._compare_dicts(expected, actual_clean)
                            })
                        
                        del actual_dict[expected_id]
                
                for extra_id, extra_data in actual_dict.items():
                    type_diff["extra"].append({
                        "id": extra_id,
                        "data": extra_data
                    })
                
                diff_report["details"][seed_type] = type_diff
                
                diff_report["summary"]["total_expected"] += type_diff["expected_count"]
                diff_report["summary"]["total_actual"] += type_diff["actual_count"]
                diff_report["summary"]["matched"] += len(type_diff["matched"])
                diff_report["summary"]["missing"] += len(type_diff["missing"])
                diff_report["summary"]["mismatched"] += len(type_diff["mismatched"])
                diff_report["summary"]["extra"] += len(type_diff["extra"])
        
        has_issues = (diff_report["summary"]["missing"] > 0 or 
                      diff_report["summary"]["mismatched"] > 0 or 
                      diff_report["summary"]["extra"] > 0)
        
        return {
            "success": True,
            "has_issues": has_issues,
            "report": diff_report
        }
    
    @staticmethod
    def _compare_dicts(dict1: Dict, dict2: Dict) -> List[Dict]:
        diffs = []
        all_keys = set(dict1.keys()).union(set(dict2.keys()))
        
        for key in all_keys:
            val1 = dict1.get(key)
            val2 = dict2.get(key)
            
            if isinstance(val1, list) and isinstance(val2, list):
                val1_sorted = sorted(val1) if val1 else []
                val2_sorted = sorted(val2) if val2 else []
                if val1_sorted != val2_sorted:
                    diffs.append({
                        "field": key,
                        "expected": val1,
                        "actual": val2
                    })
            elif val1 != val2:
                diffs.append({
                    "field": key,
                    "expected": val1,
                    "actual": val2
                })
        
        return diffs
    
    @staticmethod
    def apply_migration(dry_run: bool = False) -> Dict[str, Any]:
        precheck = MigrationService.precheck_diff()
        if not precheck["has_issues"]:
            return {
                "success": True,
                "dry_run": dry_run,
                "message": "数据已一致，无需迁移",
                "actions": []
            }
        
        batch_number = MigrationService.create_batch("apply_migration")
        
        actions = []
        report = precheck["report"]["details"]
        
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                
                for seed_type, type_diff in report.items():
                    table_name = {
                        "window": "windows",
                        "allergen": "allergens",
                        "role": "roles",
                        "package": "packages"
                    }[seed_type]
                    
                    expected_seeds = get_seed_by_type(seed_type)
                    expected_dict = {s["code"]: s for s in expected_seeds}
                    
                    for missing in type_diff["missing"]:
                        seed_id = missing["id"]
                        seed_data = expected_dict[seed_id]
                        seed_hash = calculate_hash(seed_data)
                        
                        actions.append({
                            "action": "INSERT",
                            "seed_type": seed_type,
                            "seed_id": seed_id,
                            "reason": "缺失种子数据"
                        })
                        
                        if not dry_run:
                            if seed_type == "window":
                                cursor.execute('''
                                    INSERT INTO windows (code, name, description, floor, status)
                                    VALUES (?, ?, ?, ?, ?)
                                ''', (seed_data["code"], seed_data["name"], seed_data["description"], 
                                      seed_data["floor"], seed_data["status"]))
                            elif seed_type == "allergen":
                                cursor.execute('''
                                    INSERT INTO allergens (code, name, description, icon)
                                    VALUES (?, ?, ?, ?)
                                ''', (seed_data["code"], seed_data["name"], seed_data["description"], 
                                      seed_data["icon"]))
                            elif seed_type == "role":
                                cursor.execute('''
                                    INSERT INTO roles (code, name, description, permissions, is_default)
                                    VALUES (?, ?, ?, ?, ?)
                                ''', (seed_data["code"], seed_data["name"], seed_data["description"],
                                      json.dumps(seed_data["permissions"], ensure_ascii=False), seed_data["is_default"]))
                            elif seed_type == "package":
                                cursor.execute('''
                                    INSERT INTO packages (code, name, description, price, window_code, allergens, status)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)
                                ''', (seed_data["code"], seed_data["name"], seed_data["description"],
                                      seed_data["price"], seed_data["window_code"],
                                      json.dumps(seed_data["allergens"], ensure_ascii=False), seed_data["status"]))
                            
                            cursor.execute('''
                                INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                                VALUES (?, ?, ?, ?, 'applied', ?)
                            ''', (seed_type, seed_id, json.dumps(seed_data, ensure_ascii=False), batch_number, seed_hash))
                            
                            cursor.execute('''
                                INSERT INTO manual_fixes (seed_type, seed_id, field_name, old_value, new_value, reason, batch_number)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            ''', (seed_type, seed_id, "ALL", None, json.dumps(seed_data, ensure_ascii=False), 
                                  "缺失数据补充", batch_number))
                    
                    for mismatched in type_diff["mismatched"]:
                        seed_id = mismatched["id"]
                        expected_data = expected_dict[seed_id]
                        expected_hash = calculate_hash(expected_data)
                        
                        for diff in mismatched["diff_fields"]:
                            actions.append({
                                "action": "UPDATE",
                                "seed_type": seed_type,
                                "seed_id": seed_id,
                                "field": diff["field"],
                                "old_value": diff["actual"],
                                "new_value": diff["expected"],
                                "reason": "字段值不匹配"
                            })
                        
                        if not dry_run:
                            if seed_type == "window":
                                cursor.execute('''
                                    UPDATE windows SET name = ?, description = ?, floor = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                                    WHERE code = ?
                                ''', (expected_data["name"], expected_data["description"], 
                                      expected_data["floor"], expected_data["status"], expected_data["code"]))
                            elif seed_type == "allergen":
                                cursor.execute('''
                                    UPDATE allergens SET name = ?, description = ?, icon = ?, updated_at = CURRENT_TIMESTAMP
                                    WHERE code = ?
                                ''', (expected_data["name"], expected_data["description"], 
                                      expected_data["icon"], expected_data["code"]))
                            elif seed_type == "role":
                                cursor.execute('''
                                    UPDATE roles SET name = ?, description = ?, permissions = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
                                    WHERE code = ?
                                ''', (expected_data["name"], expected_data["description"],
                                      json.dumps(expected_data["permissions"], ensure_ascii=False), 
                                      expected_data["is_default"], expected_data["code"]))
                            elif seed_type == "package":
                                cursor.execute('''
                                    UPDATE packages SET name = ?, description = ?, price = ?, window_code = ?, 
                                    allergens = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                                    WHERE code = ?
                                ''', (expected_data["name"], expected_data["description"], expected_data["price"],
                                      expected_data["window_code"], json.dumps(expected_data["allergens"], ensure_ascii=False),
                                      expected_data["status"], expected_data["code"]))
                            
                            cursor.execute('''
                                UPDATE seed_inventory SET seed_data = ?, hash = ?, status = 'applied', 
                                updated_at = CURRENT_TIMESTAMP WHERE seed_type = ? AND seed_id = ?
                            ''', (json.dumps(expected_data, ensure_ascii=False), expected_hash, seed_type, seed_id))
                            
                            for diff in mismatched["diff_fields"]:
                                cursor.execute('''
                                    INSERT INTO manual_fixes (seed_type, seed_id, field_name, old_value, new_value, reason, batch_number)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)
                                ''', (seed_type, seed_id, diff["field"], 
                                      json.dumps(diff["actual"], ensure_ascii=False) if diff["actual"] else None,
                                      json.dumps(diff["expected"], ensure_ascii=False) if diff["expected"] else None,
                                      "字段值修正", batch_number))
                    
                    for extra in type_diff["extra"]:
                        seed_id = extra["id"]
                        actions.append({
                            "action": "FLAG_EXTRA",
                            "seed_type": seed_type,
                            "seed_id": seed_id,
                            "data": extra["data"],
                            "reason": "旧库冗余数据，建议人工确认"
                        })
                
                if not dry_run:
                    conn.commit()
                    MigrationService.update_batch_status(batch_number, "completed", "迁移应用完成")
                else:
                    MigrationService.update_batch_status(batch_number, "completed", "预检模式，未实际应用")
            
            return {
                "success": True,
                "dry_run": dry_run,
                "batch_number": batch_number,
                "message": f"迁移{'预检' if dry_run else '应用'}完成",
                "actions_count": len(actions),
                "actions": actions
            }
        except Exception as e:
            MigrationService.update_batch_status(batch_number, "failed", str(e))
            return {
                "success": False,
                "batch_number": batch_number,
                "message": f"迁移失败: {str(e)}"
            }
    
    @staticmethod
    def rerun_seeds(seed_types: List[str] = None) -> Dict[str, Any]:
        if seed_types is None:
            seed_types = get_all_seed_types()
        
        batch_number = MigrationService.create_batch("rerun_seeds")
        results = {}
        
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                
                for seed_type in seed_types:
                    seeds = get_seed_by_type(seed_type)
                    results[seed_type] = {
                        "total": len(seeds),
                        "inserted": 0,
                        "updated": 0,
                        "skipped": 0
                    }
                    
                    for seed_data in seeds:
                        if seed_type == "migration":
                            seed_id = seed_data["version"]
                        else:
                            seed_id = seed_data["code"]
                        seed_hash = calculate_hash(seed_data)
                        
                        cursor.execute('''
                            SELECT hash FROM seed_inventory WHERE seed_type = ? AND seed_id = ?
                        ''', (seed_type, seed_id))
                        existing = cursor.fetchone()
                        
                        if existing and existing[0] == seed_hash:
                            results[seed_type]["skipped"] += 1
                            continue
                        
                        if existing:
                            results[seed_type]["updated"] += 1
                            action = "UPDATE"
                        else:
                            results[seed_type]["inserted"] += 1
                            action = "INSERT"
                        
                        table_name = {
                            "migration": "migration_versions",
                            "window": "windows",
                            "allergen": "allergens",
                            "role": "roles",
                            "package": "packages"
                        }[seed_type]
                        
                        if seed_type == "migration":
                            cursor.execute('''
                                INSERT OR REPLACE INTO migration_versions (version, description, status, applied_at)
                                VALUES (?, ?, 'applied', CURRENT_TIMESTAMP)
                            ''', (seed_data["version"], seed_data["description"]))
                        
                        elif seed_type == "window":
                            cursor.execute('''
                                INSERT OR REPLACE INTO windows (code, name, description, floor, status)
                                VALUES (?, ?, ?, ?, ?)
                            ''', (seed_data["code"], seed_data["name"], seed_data["description"], 
                                  seed_data["floor"], seed_data["status"]))
                        
                        elif seed_type == "allergen":
                            cursor.execute('''
                                INSERT OR REPLACE INTO allergens (code, name, description, icon)
                                VALUES (?, ?, ?, ?)
                            ''', (seed_data["code"], seed_data["name"], seed_data["description"], 
                                  seed_data["icon"]))
                        
                        elif seed_type == "role":
                            cursor.execute('''
                                INSERT OR REPLACE INTO roles (code, name, description, permissions, is_default)
                                VALUES (?, ?, ?, ?, ?)
                            ''', (seed_data["code"], seed_data["name"], seed_data["description"],
                                  json.dumps(seed_data["permissions"], ensure_ascii=False), seed_data["is_default"]))
                        
                        elif seed_type == "package":
                            cursor.execute('''
                                INSERT OR REPLACE INTO packages (code, name, description, price, window_code, allergens, status)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            ''', (seed_data["code"], seed_data["name"], seed_data["description"],
                                  seed_data["price"], seed_data["window_code"],
                                  json.dumps(seed_data["allergens"], ensure_ascii=False), seed_data["status"]))
                        
                        cursor.execute('''
                            INSERT OR REPLACE INTO seed_inventory (seed_type, seed_id, seed_data, batch_number, status, hash)
                            VALUES (?, ?, ?, ?, 'applied', ?)
                        ''', (seed_type, seed_id, json.dumps(seed_data, ensure_ascii=False), batch_number, seed_hash))
                        
                        if action == "UPDATE":
                            cursor.execute('''
                                INSERT INTO manual_fixes (seed_type, seed_id, field_name, old_value, new_value, reason, batch_number)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            ''', (seed_type, seed_id, "hash", existing[0], seed_hash, 
                                  "种子数据更新", batch_number))
                
                conn.commit()
            
            MigrationService.update_batch_status(batch_number, "completed", "种子重跑完成")
            
            total_inserted = sum(r["inserted"] for r in results.values())
            total_updated = sum(r["updated"] for r in results.values())
            total_skipped = sum(r["skipped"] for r in results.values())
            
            return {
                "success": True,
                "batch_number": batch_number,
                "message": "种子重跑完成（幂等）",
                "summary": {
                    "total_inserted": total_inserted,
                    "total_updated": total_updated,
                    "total_skipped": total_skipped
                },
                "details": results
            }
        except Exception as e:
            MigrationService.update_batch_status(batch_number, "failed", str(e))
            return {
                "success": False,
                "batch_number": batch_number,
                "message": f"种子重跑失败: {str(e)}"
            }
    
    @staticmethod
    def export_report(format_type: str = "json") -> Dict[str, Any]:
        precheck = MigrationService.precheck_diff()
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM batch_records ORDER BY created_at DESC LIMIT 10")
            batches = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute('''
                SELECT seed_type, COUNT(*) as count, status
                FROM seed_inventory GROUP BY seed_type, status
            ''')
            seed_stats = {}
            for row in cursor.fetchall():
                seed_type = row[0]
                if seed_type not in seed_stats:
                    seed_stats[seed_type] = {}
                seed_stats[seed_type][row[2]] = row[1]
            
            cursor.execute('''
                SELECT * FROM manual_fixes ORDER BY fixed_at DESC LIMIT 20
            ''')
            fixes = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute("SELECT COUNT(*) FROM windows WHERE status = 'active'")
            active_windows = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM allergens")
            allergen_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM roles")
            role_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM packages WHERE status = 'active'")
            active_packages = cursor.fetchone()[0]
        
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "status_summary": {
                "is_consistent": not precheck["has_issues"],
                "active_windows": active_windows,
                "allergens_count": allergen_count,
                "roles_count": role_count,
                "active_packages": active_packages
            },
            "differences": precheck["report"],
            "batch_history": batches,
            "seed_inventory_stats": seed_stats,
            "manual_fixes": fixes
        }
        
        if format_type == "markdown":
            markdown = MigrationService._generate_markdown_report(report_data)
            return {
                "success": True,
                "format": "markdown",
                "content": markdown
            }
        else:
            return {
                "success": True,
                "format": "json",
                "content": report_data
            }
    
    @staticmethod
    def _generate_markdown_report(data: Dict) -> str:
        md_lines = [
            "# 食堂点餐系统数据迁移一致性报告",
            "",
            f"**生成时间**: {data['generated_at']}",
            "",
            "## 状态概览",
            "",
            f"- **数据一致性**: {'✅ 一致' if data['status_summary']['is_consistent'] else '❌ 存在差异'}",
            f"- **活跃窗口**: {data['status_summary']['active_windows']} 个",
            f"- **过敏原标签**: {data['status_summary']['allergens_count']} 个",
            f"- **系统角色**: {data['status_summary']['roles_count']} 个",
            f"- **活跃套餐**: {data['status_summary']['active_packages']} 个",
            "",
            "## 差异详情",
            ""
        ]
        
        diff = data["differences"]
        summary = diff["summary"]
        details = diff["details"]
        
        md_lines.extend([
            f"- **预期总数**: {summary['total_expected']}",
            f"- **实际总数**: {summary['total_actual']}",
            f"- **匹配**: {summary['matched']}",
            f"- **缺失**: {summary['missing']}",
            f"- **不匹配**: {summary['mismatched']}",
            f"- **冗余**: {summary['extra']}",
            ""
        ])
        
        for seed_type, type_diff in details.items():
            md_lines.extend([
                f"### {seed_type.capitalize()}",
                "",
                f"- 预期: {type_diff['expected_count']}, 实际: {type_diff['actual_count']}",
                f"- 匹配: {len(type_diff['matched'])}, 缺失: {len(type_diff['missing'])}, 不匹配: {len(type_diff['mismatched'])}, 冗余: {len(type_diff['extra'])}",
                ""
            ])
            
            if type_diff["missing"]:
                md_lines.extend(["#### 缺失项", ""])
                for item in type_diff["missing"]:
                    md_lines.append(f"- **{item['id']}**: {item['expected'].get('name', 'N/A')}")
                md_lines.append("")
            
            if type_diff["mismatched"]:
                md_lines.extend(["#### 不匹配项", ""])
                for item in type_diff["mismatched"]:
                    md_lines.append(f"- **{item['id']}**:")
                    for df in item["diff_fields"]:
                        md_lines.append(f"  - `{df['field']}`: 预期 `{df['expected']}` vs 实际 `{df['actual']}`")
                md_lines.append("")
            
            if type_diff["extra"]:
                md_lines.extend(["#### 冗余项（需人工确认）", ""])
                for item in type_diff["extra"]:
                    md_lines.append(f"- **{item['id']}**: {item['data'].get('name', 'N/A')}")
                md_lines.append("")
        
        md_lines.extend([
            "## 批次历史",
            "",
            "| 批次号 | 来源 | 状态 | 创建时间 |",
            "|--------|------|------|----------|",
        ])
        for batch in data["batch_history"]:
            md_lines.append(f"| {batch['batch_number']} | {batch['source']} | {batch['status']} | {batch['created_at']} |")
        md_lines.append("")
        
        if data["manual_fixes"]:
            md_lines.extend([
                "## 人工修复记录",
                "",
                "| 类型 | ID | 字段 | 旧值 | 新值 | 原因 | 时间 |",
                "|------|-----|------|------|------|------|------|",
            ])
            for fix in data["manual_fixes"]:
                md_lines.append(f"| {fix['seed_type']} | {fix['seed_id']} | {fix['field_name']} | {fix['old_value'][:30] if fix['old_value'] else '-'} | {fix['new_value'][:30] if fix['new_value'] else '-'} | {fix['reason']} | {fix['fixed_at']} |")
            md_lines.append("")
        
        return "\n".join(md_lines)
