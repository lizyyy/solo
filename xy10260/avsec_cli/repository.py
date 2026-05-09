from typing import Optional, List
import json
from datetime import datetime

from .db import get_conn
from .models import (
    AircraftRule, FlightPlan, PassengerSpecialMeal, LoadingRecord,
    VerificationResult, OperationHistory, SpecialMealType, now_str
)

def record_history(conn, entity_type: str, entity_id: str, operation: str,
                   operator: str, before_data: Optional[dict] = None,
                   after_data: Optional[dict] = None):
    cursor = conn.cursor()
    before_json = json.dumps(before_data, ensure_ascii=False) if before_data else None
    after_json = json.dumps(after_data, ensure_ascii=False) if after_data else None
    cursor.execute("""
        INSERT INTO operation_history 
        (entity_type, entity_id, operation, operator, before_data, after_data, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (entity_type, entity_id, operation, operator, before_json, after_json, now_str()))

class AircraftRuleRepo:
    @staticmethod
    def create(rule: AircraftRule, operator: str = "system") -> AircraftRule:
        rule.created_at = now_str()
        rule.updated_at = now_str()
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO aircraft_rules (
                    aircraft_type, economy_meals, business_meals, first_class_meals,
                    snacks, beverages, cutlery_sets, blankets, pillows, headsets, amenity_kits,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rule.aircraft_type, rule.economy_meals, rule.business_meals,
                rule.first_class_meals, rule.snacks, rule.beverages, rule.cutlery_sets,
                rule.blankets, rule.pillows, rule.headsets, rule.amenity_kits,
                rule.created_at, rule.updated_at
            ))
            rule.id = cursor.lastrowid
            record_history(conn, "aircraft_rule", rule.aircraft_type, "CREATE",
                          operator, after_data=rule.to_dict())
        return rule

    @staticmethod
    def update(rule: AircraftRule, operator: str = "system") -> AircraftRule:
        existing = AircraftRuleRepo.get_by_type(rule.aircraft_type)
        if not existing:
            return AircraftRuleRepo.create(rule, operator)
        rule.updated_at = now_str()
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE aircraft_rules SET
                    economy_meals=?, business_meals=?, first_class_meals=?,
                    snacks=?, beverages=?, cutlery_sets=?, blankets=?, pillows=?,
                    headsets=?, amenity_kits=?, updated_at=?
                WHERE aircraft_type=?
            """, (
                rule.economy_meals, rule.business_meals, rule.first_class_meals,
                rule.snacks, rule.beverages, rule.cutlery_sets,
                rule.blankets, rule.pillows, rule.headsets, rule.amenity_kits,
                rule.updated_at, rule.aircraft_type
            ))
            rule.id = existing.id
            rule.created_at = existing.created_at
            record_history(conn, "aircraft_rule", rule.aircraft_type, "UPDATE",
                          operator, before_data=existing.to_dict(), after_data=rule.to_dict())
        return rule

    @staticmethod
    def get_by_type(aircraft_type: str) -> Optional[AircraftRule]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM aircraft_rules WHERE aircraft_type=?", (aircraft_type,))
            row = cursor.fetchone()
            if row:
                return AircraftRule(
                    id=row["id"], aircraft_type=row["aircraft_type"],
                    economy_meals=row["economy_meals"], business_meals=row["business_meals"],
                    first_class_meals=row["first_class_meals"], snacks=row["snacks"],
                    beverages=row["beverages"], cutlery_sets=row["cutlery_sets"],
                    blankets=row["blankets"], pillows=row["pillows"],
                    headsets=row["headsets"], amenity_kits=row["amenity_kits"],
                    created_at=row["created_at"], updated_at=row["updated_at"]
                )
        return None

    @staticmethod
    def list_all() -> List[AircraftRule]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM aircraft_rules")
            rules = []
            for row in cursor.fetchall():
                rules.append(AircraftRule(
                    id=row["id"], aircraft_type=row["aircraft_type"],
                    economy_meals=row["economy_meals"], business_meals=row["business_meals"],
                    first_class_meals=row["first_class_meals"], snacks=row["snacks"],
                    beverages=row["beverages"], cutlery_sets=row["cutlery_sets"],
                    blankets=row["blankets"], pillows=row["pillows"],
                    headsets=row["headsets"], amenity_kits=row["amenity_kits"],
                    created_at=row["created_at"], updated_at=row["updated_at"]
                ))
        return rules

class SpecialMealTypeRepo:
    @staticmethod
    def create(sm: SpecialMealType, operator: str = "system") -> SpecialMealType:
        sm.created_at = now_str()
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO special_meal_types (code, description, created_at)
                VALUES (?, ?, ?)
            """, (sm.code, sm.description, sm.created_at))
            sm.id = cursor.lastrowid
        return sm

    @staticmethod
    def get_by_code(code: str) -> Optional[SpecialMealType]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM special_meal_types WHERE code=?", (code,))
            row = cursor.fetchone()
            if row:
                return SpecialMealType(id=row["id"], code=row["code"],
                                       description=row["description"],
                                       created_at=row["created_at"])
        return None

    @staticmethod
    def list_all() -> List[SpecialMealType]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM special_meal_types")
            return [SpecialMealType(id=r["id"], code=r["code"],
                                    description=r["description"],
                                    created_at=r["created_at"]) for r in cursor.fetchall()]

class FlightPlanRepo:
    @staticmethod
    def create(fp: FlightPlan, operator: str = "system") -> FlightPlan:
        fp.created_at = now_str()
        fp.updated_at = now_str()
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO flight_plans (
                    flight_number, aircraft_type, route, scheduled_departure,
                    economy_passengers, business_passengers, first_class_passengers,
                    status, version, previous_aircraft_type, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                fp.flight_number, fp.aircraft_type, fp.route, fp.scheduled_departure,
                fp.economy_passengers, fp.business_passengers, fp.first_class_passengers,
                fp.status, fp.version, fp.previous_aircraft_type,
                fp.created_at, fp.updated_at
            ))
            fp.id = cursor.lastrowid
            record_history(conn, "flight_plan", fp.flight_number, "CREATE",
                          operator, after_data={
                              "flight_number": fp.flight_number,
                              "aircraft_type": fp.aircraft_type,
                              "route": fp.route,
                              "status": fp.status,
                              "version": fp.version
                          })
        return fp

    @staticmethod
    def update(fp: FlightPlan, operator: str = "system") -> FlightPlan:
        existing = FlightPlanRepo.get_by_flight_number(fp.flight_number)
        if not existing:
            return FlightPlanRepo.create(fp, operator)
        fp.updated_at = now_str()
        fp.version = existing.version + 1
        if existing.aircraft_type != fp.aircraft_type:
            fp.previous_aircraft_type = existing.aircraft_type
        else:
            fp.previous_aircraft_type = existing.previous_aircraft_type
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE flight_plans SET
                    aircraft_type=?, route=?, scheduled_departure=?,
                    economy_passengers=?, business_passengers=?, first_class_passengers=?,
                    status=?, version=?, previous_aircraft_type=?, updated_at=?
                WHERE flight_number=?
            """, (
                fp.aircraft_type, fp.route, fp.scheduled_departure,
                fp.economy_passengers, fp.business_passengers, fp.first_class_passengers,
                fp.status, fp.version, fp.previous_aircraft_type,
                fp.updated_at, fp.flight_number
            ))
            fp.id = existing.id
            fp.created_at = existing.created_at
            record_history(conn, "flight_plan", fp.flight_number, "UPDATE",
                          operator,
                          before_data={
                              "aircraft_type": existing.aircraft_type,
                              "route": existing.route,
                              "version": existing.version,
                              "status": existing.status
                          },
                          after_data={
                              "aircraft_type": fp.aircraft_type,
                              "route": fp.route,
                              "version": fp.version,
                              "status": fp.status,
                              "previous_aircraft_type": fp.previous_aircraft_type
                          })
        return fp

    @staticmethod
    def get_by_flight_number(flight_number: str) -> Optional[FlightPlan]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM flight_plans WHERE flight_number=?", (flight_number,))
            row = cursor.fetchone()
            if row:
                return FlightPlan(
                    id=row["id"], flight_number=row["flight_number"],
                    aircraft_type=row["aircraft_type"], route=row["route"],
                    scheduled_departure=row["scheduled_departure"],
                    economy_passengers=row["economy_passengers"],
                    business_passengers=row["business_passengers"],
                    first_class_passengers=row["first_class_passengers"],
                    status=row["status"], version=row["version"],
                    previous_aircraft_type=row["previous_aircraft_type"],
                    created_at=row["created_at"], updated_at=row["updated_at"]
                )
        return None

    @staticmethod
    def list_all(status: Optional[str] = None) -> List[FlightPlan]:
        with get_conn() as conn:
            cursor = conn.cursor()
            if status:
                cursor.execute("SELECT * FROM flight_plans WHERE status=?", (status,))
            else:
                cursor.execute("SELECT * FROM flight_plans")
            plans = []
            for row in cursor.fetchall():
                plans.append(FlightPlan(
                    id=row["id"], flight_number=row["flight_number"],
                    aircraft_type=row["aircraft_type"], route=row["route"],
                    scheduled_departure=row["scheduled_departure"],
                    economy_passengers=row["economy_passengers"],
                    business_passengers=row["business_passengers"],
                    first_class_passengers=row["first_class_passengers"],
                    status=row["status"], version=row["version"],
                    previous_aircraft_type=row["previous_aircraft_type"],
                    created_at=row["created_at"], updated_at=row["updated_at"]
                ))
        return plans

class PassengerSpecialMealRepo:
    @staticmethod
    def create_or_update(psm: PassengerSpecialMeal, operator: str = "system") -> PassengerSpecialMeal:
        psm.created_at = now_str()
        with get_conn() as conn:
            cursor = conn.cursor()
            existing = PassengerSpecialMealRepo.get_by_flight_and_meal(psm.flight_number, psm.meal_code)
            if existing:
                cursor.execute("""
                    UPDATE passenger_special_meals SET
                        count=?, passenger_names=?
                    WHERE flight_number=? AND meal_code=?
                """, (psm.count, psm.passenger_names, psm.flight_number, psm.meal_code))
                psm.id = existing.id
                record_history(conn, "special_meal_request", f"{psm.flight_number}:{psm.meal_code}",
                              "UPDATE", operator,
                              before_data={"count": existing.count},
                              after_data={"count": psm.count})
            else:
                cursor.execute("""
                    INSERT INTO passenger_special_meals (flight_number, meal_code, count, passenger_names, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (psm.flight_number, psm.meal_code, psm.count, psm.passenger_names, psm.created_at))
                psm.id = cursor.lastrowid
                record_history(conn, "special_meal_request", f"{psm.flight_number}:{psm.meal_code}",
                              "CREATE", operator,
                              after_data={"meal_code": psm.meal_code, "count": psm.count})
        return psm

    @staticmethod
    def get_by_flight_and_meal(flight_number: str, meal_code: str) -> Optional[PassengerSpecialMeal]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM passenger_special_meals WHERE flight_number=? AND meal_code=?
            """, (flight_number, meal_code))
            row = cursor.fetchone()
            if row:
                return PassengerSpecialMeal(
                    id=row["id"], flight_number=row["flight_number"],
                    meal_code=row["meal_code"], count=row["count"],
                    passenger_names=row["passenger_names"], created_at=row["created_at"]
                )
        return None

    @staticmethod
    def get_by_flight(flight_number: str) -> List[PassengerSpecialMeal]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM passenger_special_meals WHERE flight_number=?", (flight_number,))
            return [PassengerSpecialMeal(
                id=r["id"], flight_number=r["flight_number"],
                meal_code=r["meal_code"], count=r["count"],
                passenger_names=r["passenger_names"], created_at=r["created_at"]
            ) for r in cursor.fetchall()]

class LoadingRecordRepo:
    @staticmethod
    def create(record: LoadingRecord, operator: str = "system") -> LoadingRecord:
        record.created_at = now_str()
        record.updated_at = now_str()
        if not record.load_time:
            record.load_time = now_str()
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO loading_records (
                    flight_number, aircraft_type, plan_version,
                    economy_meals_loaded, business_meals_loaded, first_class_meals_loaded,
                    snacks_loaded, beverages_loaded, cutlery_sets_loaded,
                    blankets_loaded, pillows_loaded, headsets_loaded, amenity_kits_loaded,
                    loader_name, load_time, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.flight_number, record.aircraft_type, record.plan_version,
                record.economy_meals_loaded, record.business_meals_loaded,
                record.first_class_meals_loaded, record.snacks_loaded,
                record.beverages_loaded, record.cutlery_sets_loaded,
                record.blankets_loaded, record.pillows_loaded,
                record.headsets_loaded, record.amenity_kits_loaded,
                record.loader_name, record.load_time, record.status,
                record.created_at, record.updated_at
            ))
            record.id = cursor.lastrowid
            for sm in record.special_meals:
                cursor.execute("""
                    INSERT INTO loading_special_meals (loading_record_id, flight_number, meal_code, loaded_count, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (record.id, record.flight_number, sm.get("meal_code"), sm.get("loaded_count", 0), now_str()))
            record_history(conn, "loading_record", f"{record.flight_number}:{record.id}",
                          "CREATE", operator,
                          after_data={
                              "flight_number": record.flight_number,
                              "aircraft_type": record.aircraft_type,
                              "status": record.status,
                              "load_time": record.load_time
                          })
        return record

    @staticmethod
    def update(record: LoadingRecord, operator: str = "system") -> LoadingRecord:
        existing = LoadingRecordRepo.get_by_id(record.id)
        if not existing:
            return LoadingRecordRepo.create(record, operator)
        record.updated_at = now_str()
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE loading_records SET
                    aircraft_type=?, plan_version=?,
                    economy_meals_loaded=?, business_meals_loaded=?, first_class_meals_loaded=?,
                    snacks_loaded=?, beverages_loaded=?, cutlery_sets_loaded=?,
                    blankets_loaded=?, pillows_loaded=?, headsets_loaded=?, amenity_kits_loaded=?,
                    loader_name=?, load_time=?, status=?, updated_at=?
                WHERE id=?
            """, (
                record.aircraft_type, record.plan_version,
                record.economy_meals_loaded, record.business_meals_loaded,
                record.first_class_meals_loaded, record.snacks_loaded,
                record.beverages_loaded, record.cutlery_sets_loaded,
                record.blankets_loaded, record.pillows_loaded,
                record.headsets_loaded, record.amenity_kits_loaded,
                record.loader_name, record.load_time, record.status,
                record.updated_at, record.id
            ))
            cursor.execute("DELETE FROM loading_special_meals WHERE loading_record_id=?", (record.id,))
            for sm in record.special_meals:
                cursor.execute("""
                    INSERT INTO loading_special_meals (loading_record_id, flight_number, meal_code, loaded_count, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (record.id, record.flight_number, sm.get("meal_code"), sm.get("loaded_count", 0), now_str()))
            record_history(conn, "loading_record", f"{record.flight_number}:{record.id}",
                          "UPDATE", operator,
                          before_data={"status": existing.status},
                          after_data={"status": record.status})
        return record

    @staticmethod
    def get_by_id(record_id: int) -> Optional[LoadingRecord]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM loading_records WHERE id=?", (record_id,))
            row = cursor.fetchone()
            if row:
                record = LoadingRecord(
                    id=row["id"], flight_number=row["flight_number"],
                    aircraft_type=row["aircraft_type"], plan_version=row["plan_version"],
                    economy_meals_loaded=row["economy_meals_loaded"],
                    business_meals_loaded=row["business_meals_loaded"],
                    first_class_meals_loaded=row["first_class_meals_loaded"],
                    snacks_loaded=row["snacks_loaded"],
                    beverages_loaded=row["beverages_loaded"],
                    cutlery_sets_loaded=row["cutlery_sets_loaded"],
                    blankets_loaded=row["blankets_loaded"],
                    pillows_loaded=row["pillows_loaded"],
                    headsets_loaded=row["headsets_loaded"],
                    amenity_kits_loaded=row["amenity_kits_loaded"],
                    loader_name=row["loader_name"], load_time=row["load_time"],
                    status=row["status"], created_at=row["created_at"],
                    updated_at=row["updated_at"]
                )
                cursor.execute("SELECT * FROM loading_special_meals WHERE loading_record_id=?", (record.id,))
                record.special_meals = [{"meal_code": r["meal_code"], "loaded_count": r["loaded_count"]}
                                       for r in cursor.fetchall()]
                return record
        return None

    @staticmethod
    def get_by_flight(flight_number: str) -> List[LoadingRecord]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM loading_records WHERE flight_number=? ORDER BY created_at DESC",
                          (flight_number,))
            records = []
            for row in cursor.fetchall():
                record = LoadingRecordRepo.get_by_id(row["id"])
                if record:
                    records.append(record)
        return records

    @staticmethod
    def list_all() -> List[LoadingRecord]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM loading_records ORDER BY created_at DESC")
            records = []
            for row in cursor.fetchall():
                record = LoadingRecordRepo.get_by_id(row["id"])
                if record:
                    records.append(record)
        return records

class VerificationResultRepo:
    @staticmethod
    def create(vr: VerificationResult) -> VerificationResult:
        vr.created_at = now_str()
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO verification_results (flight_number, check_run_id, check_type, status, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (vr.flight_number, vr.check_run_id, vr.check_type, vr.status,
                  vr.details, vr.created_at))
            vr.id = cursor.lastrowid
        return vr

    @staticmethod
    def get_by_check_run(check_run_id: str) -> List[VerificationResult]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM verification_results WHERE check_run_id=?", (check_run_id,))
            results = []
            for row in cursor.fetchall():
                results.append(VerificationResult(
                    id=row["id"], flight_number=row["flight_number"],
                    check_run_id=row["check_run_id"], check_type=row["check_type"],
                    status=row["status"], details=row["details"],
                    created_at=row["created_at"]
                ))
        return results

    @staticmethod
    def get_by_flight(flight_number: str) -> List[VerificationResult]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM verification_results WHERE flight_number=? ORDER BY created_at DESC",
                          (flight_number,))
            results = []
            for row in cursor.fetchall():
                results.append(VerificationResult(
                    id=row["id"], flight_number=row["flight_number"],
                    check_run_id=row["check_run_id"], check_type=row["check_type"],
                    status=row["status"], details=row["details"],
                    created_at=row["created_at"]
                ))
        return results

    @staticmethod
    def list_all() -> List[VerificationResult]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM verification_results ORDER BY created_at DESC")
            results = []
            for row in cursor.fetchall():
                results.append(VerificationResult(
                    id=row["id"], flight_number=row["flight_number"],
                    check_run_id=row["check_run_id"], check_type=row["check_type"],
                    status=row["status"], details=row["details"],
                    created_at=row["created_at"]
                ))
        return results

class OperationHistoryRepo:
    @staticmethod
    def list_by_entity(entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> List[OperationHistory]:
        with get_conn() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM operation_history WHERE 1=1"
            params = []
            if entity_type:
                query += " AND entity_type=?"
                params.append(entity_type)
            if entity_id:
                query += " AND entity_id=?"
                params.append(entity_id)
            query += " ORDER BY timestamp DESC"
            cursor.execute(query, params)
            histories = []
            for row in cursor.fetchall():
                histories.append(OperationHistory(
                    id=row["id"], entity_type=row["entity_type"],
                    entity_id=row["entity_id"], operation=row["operation"],
                    operator=row["operator"], before_data=row["before_data"],
                    after_data=row["after_data"], timestamp=row["timestamp"]
                ))
        return histories

    @staticmethod
    def list_recent(limit: int = 50) -> List[OperationHistory]:
        with get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM operation_history ORDER BY timestamp DESC LIMIT ?", (limit,))
            histories = []
            for row in cursor.fetchall():
                histories.append(OperationHistory(
                    id=row["id"], entity_type=row["entity_type"],
                    entity_id=row["entity_id"], operation=row["operation"],
                    operator=row["operator"], before_data=row["before_data"],
                    after_data=row["after_data"], timestamp=row["timestamp"]
                ))
        return histories
