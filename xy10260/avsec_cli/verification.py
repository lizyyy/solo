from typing import List, Dict, Optional
import uuid
import json

from .models import (
    FlightPlan, AircraftRule, LoadingRecord,
    VerificationResult, PassengerSpecialMeal
)
from .repository import (
    FlightPlanRepo, AircraftRuleRepo, LoadingRecordRepo,
    PassengerSpecialMealRepo, VerificationResultRepo, SpecialMealTypeRepo
)

def generate_check_run_id() -> str:
    return f"chk-{uuid.uuid4().hex[:8]}"

class VerificationEngine:
    def __init__(self):
        pass

    def check_aircraft_type_mismatch(self, flight_plan: FlightPlan,
                                     loading_record: LoadingRecord) -> Optional[VerificationResult]:
        check_run_id = generate_check_run_id()
        if flight_plan.aircraft_type != loading_record.aircraft_type:
            details = json.dumps({
                "flight_aircraft_type": flight_plan.aircraft_type,
                "loading_aircraft_type": loading_record.aircraft_type,
                "previous_aircraft_type": flight_plan.previous_aircraft_type,
                "message": "装载记录机型与当前航班计划机型不匹配",
                "risk": "已换机但装载清单未更新" if flight_plan.previous_aircraft_type else "机型配置不一致"
            }, ensure_ascii=False)
            return VerificationResult(
                flight_number=flight_plan.flight_number,
                check_run_id=check_run_id,
                check_type="aircraft_type_mismatch",
                status="FAIL",
                details=details
            )
        return VerificationResult(
            flight_number=flight_plan.flight_number,
            check_run_id=check_run_id,
            check_type="aircraft_type_mismatch",
            status="PASS",
            details=json.dumps({"aircraft_type": flight_plan.aircraft_type}, ensure_ascii=False)
        )

    def check_meal_quantities(self, flight_plan: FlightPlan,
                             aircraft_rule: AircraftRule,
                             loading_record: LoadingRecord) -> List[VerificationResult]:
        results = []
        meal_classes = [
            ("economy", flight_plan.economy_passengers,
             aircraft_rule.economy_meals, loading_record.economy_meals_loaded),
            ("business", flight_plan.business_passengers,
             aircraft_rule.business_meals, loading_record.business_meals_loaded),
            ("first_class", flight_plan.first_class_passengers,
             aircraft_rule.first_class_meals, loading_record.first_class_meals_loaded),
        ]
        
        for cabin, passengers, rule_qty, loaded_qty in meal_classes:
            check_run_id = generate_check_run_id()
            required_qty = rule_qty if rule_qty > 0 else passengers
            status = "PASS" if loaded_qty >= required_qty else "FAIL"
            details = json.dumps({
                "cabin": cabin,
                "passengers": passengers,
                "rule_quantity": rule_qty,
                "required_quantity": required_qty,
                "loaded_quantity": loaded_qty,
                "deficit": max(0, required_qty - loaded_qty),
                "surplus": max(0, loaded_qty - required_qty)
            }, ensure_ascii=False)
            results.append(VerificationResult(
                flight_number=flight_plan.flight_number,
                check_run_id=check_run_id,
                check_type=f"{cabin}_meals",
                status=status,
                details=details
            ))
        return results

    def check_special_meals(self, flight_plan: FlightPlan,
                           loading_record: LoadingRecord) -> List[VerificationResult]:
        results = []
        requested_meals = PassengerSpecialMealRepo.get_by_flight(flight_plan.flight_number)
        loaded_meals_dict = {sm["meal_code"]: sm["loaded_count"] for sm in loading_record.special_meals}
        
        all_codes = set(sm.meal_code for sm in requested_meals) | set(loaded_meals_dict.keys())
        
        for code in all_codes:
            check_run_id = generate_check_run_id()
            requested = next((sm.count for sm in requested_meals if sm.meal_code == code), 0)
            loaded = loaded_meals_dict.get(code, 0)
            
            meal_type = SpecialMealTypeRepo.get_by_code(code)
            description = meal_type.description if meal_type else code
            
            if loaded < requested:
                status = "FAIL"
                details = json.dumps({
                    "meal_code": code,
                    "description": description,
                    "required_quantity": requested,
                    "loaded_quantity": loaded,
                    "deficit": requested - loaded,
                    "message": f"特殊餐{code}({description})装载不足，缺{requested - loaded}份"
                }, ensure_ascii=False)
            elif loaded > requested:
                status = "WARN"
                details = json.dumps({
                    "meal_code": code,
                    "description": description,
                    "required_quantity": requested,
                    "loaded_quantity": loaded,
                    "surplus": loaded - requested,
                    "message": f"特殊餐{code}({description})多装{loaded - requested}份"
                }, ensure_ascii=False)
            else:
                status = "PASS"
                details = json.dumps({
                    "meal_code": code,
                    "description": description,
                    "required_quantity": requested,
                    "loaded_quantity": loaded
                }, ensure_ascii=False)
            
            results.append(VerificationResult(
                flight_number=flight_plan.flight_number,
                check_run_id=check_run_id,
                check_type=f"special_meal_{code}",
                status=status,
                details=details
            ))
        
        if not all_codes:
            check_run_id = generate_check_run_id()
            results.append(VerificationResult(
                flight_number=flight_plan.flight_number,
                check_run_id=check_run_id,
                check_type="special_meal_none",
                status="PASS",
                details=json.dumps({"message": "无特殊餐需求"}, ensure_ascii=False)
            ))
        
        return results

    def check_supplies(self, flight_plan: FlightPlan,
                      aircraft_rule: AircraftRule,
                      loading_record: LoadingRecord) -> List[VerificationResult]:
        results = []
        total_pax = flight_plan.total_passengers()
        
        supplies_list = [
            ("snacks", aircraft_rule.snacks, loading_record.snacks_loaded),
            ("beverages", aircraft_rule.beverages, loading_record.beverages_loaded),
            ("cutlery_sets", aircraft_rule.cutlery_sets, loading_record.cutlery_sets_loaded),
            ("blankets", aircraft_rule.blankets, loading_record.blankets_loaded),
            ("pillows", aircraft_rule.pillows, loading_record.pillows_loaded),
            ("headsets", aircraft_rule.headsets, loading_record.headsets_loaded),
            ("amenity_kits", aircraft_rule.amenity_kits, loading_record.amenity_kits_loaded),
        ]
        
        for name, rule_qty, loaded_qty in supplies_list:
            check_run_id = generate_check_run_id()
            required_qty = rule_qty if rule_qty > 0 else total_pax
            status = "PASS" if loaded_qty >= required_qty else "FAIL"
            details = json.dumps({
                "supply_name": name,
                "rule_quantity": rule_qty,
                "required_quantity": required_qty,
                "loaded_quantity": loaded_qty,
                "deficit": max(0, required_qty - loaded_qty),
                "surplus": max(0, loaded_qty - required_qty)
            }, ensure_ascii=False)
            results.append(VerificationResult(
                flight_number=flight_plan.flight_number,
                check_run_id=check_run_id,
                check_type=f"supply_{name}",
                status=status,
                details=details
            ))
        return results

    def run_verification_for_flight(self, flight_number: str,
                                   operator: str = "system") -> Dict:
        master_run_id = generate_check_run_id()
        flight_plan = FlightPlanRepo.get_by_flight_number(flight_number)
        if not flight_plan:
            return {
                "master_run_id": master_run_id,
                "flight_number": flight_number,
                "status": "ERROR",
                "message": f"未找到航班计划：{flight_number}"
            }
        
        aircraft_rule = AircraftRuleRepo.get_by_type(flight_plan.aircraft_type)
        if not aircraft_rule:
            return {
                "master_run_id": master_run_id,
                "flight_number": flight_number,
                "status": "ERROR",
                "message": f"未找到机型装载规则：{flight_plan.aircraft_type}"
            }
        
        loading_records = LoadingRecordRepo.get_by_flight(flight_number)
        if not loading_records:
            return {
                "master_run_id": master_run_id,
                "flight_number": flight_number,
                "status": "ERROR",
                "message": f"未找到航班装载记录：{flight_number}"
            }
        
        latest_loading = loading_records[0]
        all_results = []
        
        type_check = self.check_aircraft_type_mismatch(flight_plan, latest_loading)
        all_results.append(type_check)
        VerificationResultRepo.create(type_check)
        
        meal_results = self.check_meal_quantities(flight_plan, aircraft_rule, latest_loading)
        all_results.extend(meal_results)
        for r in meal_results:
            VerificationResultRepo.create(r)
        
        sp_results = self.check_special_meals(flight_plan, latest_loading)
        all_results.extend(sp_results)
        for r in sp_results:
            VerificationResultRepo.create(r)
        
        supply_results = self.check_supplies(flight_plan, aircraft_rule, latest_loading)
        all_results.extend(supply_results)
        for r in supply_results:
            VerificationResultRepo.create(r)
        
        fail_count = sum(1 for r in all_results if r.status == "FAIL")
        warn_count = sum(1 for r in all_results if r.status == "WARN")
        pass_count = sum(1 for r in all_results if r.status == "PASS")
        
        overall = "FAIL" if fail_count > 0 else ("WARN" if warn_count > 0 else "PASS")
        
        return {
            "master_run_id": master_run_id,
            "flight_number": flight_number,
            "status": overall,
            "fail_count": fail_count,
            "warn_count": warn_count,
            "pass_count": pass_count,
            "total_count": len(all_results),
            "flight_plan": {
                "flight_number": flight_plan.flight_number,
                "aircraft_type": flight_plan.aircraft_type,
                "previous_aircraft_type": flight_plan.previous_aircraft_type,
                "route": flight_plan.route,
                "version": flight_plan.version
            },
            "loading_record": {
                "id": latest_loading.id,
                "aircraft_type": latest_loading.aircraft_type,
                "plan_version": latest_loading.plan_version
            },
            "results": [
                {
                    "check_type": r.check_type,
                    "status": r.status,
                    "details": json.loads(r.details) if r.details else {}
                } for r in all_results
            ]
        }

    def run_verification_all(self, operator: str = "system") -> Dict:
        flight_plans = FlightPlanRepo.list_all(status="active")
        results = []
        total_fail = 0
        total_warn = 0
        total_pass = 0
        
        for fp in flight_plans:
            vr = self.run_verification_for_flight(fp.flight_number, operator)
            results.append(vr)
            if vr.get("status") == "FAIL":
                total_fail += 1
            elif vr.get("status") == "WARN":
                total_warn += 1
            elif vr.get("status") == "PASS":
                total_pass += 1
        
        overall = "FAIL" if total_fail > 0 else ("WARN" if total_warn > 0 else "PASS")
        
        return {
            "status": overall,
            "total_flights": len(results),
            "fail_count": total_fail,
            "warn_count": total_warn,
            "pass_count": total_pass,
            "flights": results
        }
