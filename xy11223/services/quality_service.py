from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from database import SessionLocal
from models import (
    FoodSample, TemperatureRecord, WasteRecord,
    Store, RuleResult, ReviewRecord, RecordStatus, ExceptionType
)


class QualityService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or SessionLocal()

    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()

    def query_samples(self,
                      store_id: Optional[str] = None,
                      manager_id: Optional[str] = None,
                      status: Optional[str] = None,
                      start_time: Optional[datetime] = None,
                      end_time: Optional[datetime] = None,
                      has_exception: Optional[bool] = None,
                      exception_type: Optional[str] = None,
                      batch_id: Optional[str] = None,
                      offset: int = 0,
                      limit: int = 100) -> Dict[str, Any]:

        query = self.db.query(FoodSample).join(Store, FoodSample.store_id == Store.id)

        if store_id:
            query = query.filter(FoodSample.store_id == store_id)
        if manager_id:
            query = query.filter(Store.manager_id == manager_id)
        if status:
            query = query.filter(FoodSample.status == status)
        if start_time:
            query = query.filter(FoodSample.sample_time >= start_time)
        if end_time:
            query = query.filter(FoodSample.sample_time <= end_time)
        if batch_id:
            query = query.filter(FoodSample.batch_id == batch_id)

        if exception_type:
            query = query.join(RuleResult, RuleResult.sample_id == FoodSample.id)
            query = query.filter(RuleResult.exception_type == exception_type)
        elif has_exception is True:
            query = query.join(RuleResult, RuleResult.sample_id == FoodSample.id)
        elif has_exception is False:
            subquery = self.db.query(RuleResult.sample_id).filter(RuleResult.sample_id.isnot(None)).distinct()
            query = query.filter(~FoodSample.id.in_(subquery))

        total = query.count()
        samples = query.order_by(FoodSample.sample_time.desc()).offset(offset).limit(limit).all()

        return {
            "total": total,
            "items": [self._enrich_sample(s) for s in samples]
        }

    def _enrich_sample(self, sample: FoodSample) -> Dict[str, Any]:
        data = sample.to_dict(include_relations=True)

        rule_results = self.db.query(RuleResult).filter(RuleResult.sample_id == sample.id).all()
        data["rule_results"] = [r.to_dict() for r in rule_results]
        data["has_exception"] = len(rule_results) > 0
        data["is_blocked"] = any(r.is_blocked for r in rule_results)

        reviews = self.db.query(ReviewRecord).filter(ReviewRecord.sample_id == sample.id).all()
        data["reviews"] = [r.to_dict() for r in reviews]
        data["review_status"] = reviews[0].review_status if reviews else "unreviewed"

        return data

    def query_temperature_records(self,
                                   store_id: Optional[str] = None,
                                   manager_id: Optional[str] = None,
                                   fridge_id: Optional[str] = None,
                                   status: Optional[str] = None,
                                   start_time: Optional[datetime] = None,
                                   end_time: Optional[datetime] = None,
                                   has_exception: Optional[bool] = None,
                                   exception_type: Optional[str] = None,
                                   offset: int = 0,
                                   limit: int = 100) -> Dict[str, Any]:

        query = self.db.query(TemperatureRecord).join(Store, TemperatureRecord.store_id == Store.id)

        if store_id:
            query = query.filter(TemperatureRecord.store_id == store_id)
        if manager_id:
            query = query.filter(Store.manager_id == manager_id)
        if fridge_id:
            query = query.filter(TemperatureRecord.fridge_id == fridge_id)
        if status:
            query = query.filter(TemperatureRecord.status == status)
        if start_time:
            query = query.filter(TemperatureRecord.record_time >= start_time)
        if end_time:
            query = query.filter(TemperatureRecord.record_time <= end_time)

        if exception_type:
            query = query.join(RuleResult, RuleResult.temperature_record_id == TemperatureRecord.id)
            query = query.filter(RuleResult.exception_type == exception_type)
        elif has_exception is True:
            query = query.join(RuleResult, RuleResult.temperature_record_id == TemperatureRecord.id)
        elif has_exception is False:
            subquery = self.db.query(RuleResult.temperature_record_id).filter(
                RuleResult.temperature_record_id.isnot(None)).distinct()
            query = query.filter(~TemperatureRecord.id.in_(subquery))

        total = query.count()
        records = query.order_by(TemperatureRecord.record_time.desc()).offset(offset).limit(limit).all()

        return {
            "total": total,
            "items": [self._enrich_temperature(r) for r in records]
        }

    def _enrich_temperature(self, record: TemperatureRecord) -> Dict[str, Any]:
        data = record.to_dict(include_relations=True)

        rule_results = self.db.query(RuleResult).filter(RuleResult.temperature_record_id == record.id).all()
        data["rule_results"] = [r.to_dict() for r in rule_results]
        data["has_exception"] = len(rule_results) > 0

        reviews = self.db.query(ReviewRecord).filter(ReviewRecord.temperature_record_id == record.id).all()
        data["reviews"] = [r.to_dict() for r in reviews]
        data["review_status"] = reviews[0].review_status if reviews else "unreviewed"

        return data

    def query_waste_records(self,
                            store_id: Optional[str] = None,
                            manager_id: Optional[str] = None,
                            status: Optional[str] = None,
                            start_time: Optional[datetime] = None,
                            end_time: Optional[datetime] = None,
                            has_exception: Optional[bool] = None,
                            exception_type: Optional[str] = None,
                            batch_id: Optional[str] = None,
                            offset: int = 0,
                            limit: int = 100) -> Dict[str, Any]:

        query = self.db.query(WasteRecord).join(Store, WasteRecord.store_id == Store.id)

        if store_id:
            query = query.filter(WasteRecord.store_id == store_id)
        if manager_id:
            query = query.filter(Store.manager_id == manager_id)
        if status:
            query = query.filter(WasteRecord.status == status)
        if start_time:
            query = query.filter(WasteRecord.waste_time >= start_time)
        if end_time:
            query = query.filter(WasteRecord.waste_time <= end_time)
        if batch_id:
            query = query.filter(WasteRecord.batch_id == batch_id)

        if exception_type:
            query = query.join(RuleResult, RuleResult.waste_record_id == WasteRecord.id)
            query = query.filter(RuleResult.exception_type == exception_type)
        elif has_exception is True:
            query = query.join(RuleResult, RuleResult.waste_record_id == WasteRecord.id)
        elif has_exception is False:
            subquery = self.db.query(RuleResult.waste_record_id).filter(
                RuleResult.waste_record_id.isnot(None)).distinct()
            query = query.filter(~WasteRecord.id.in_(subquery))

        total = query.count()
        records = query.order_by(WasteRecord.waste_time.desc()).offset(offset).limit(limit).all()

        return {
            "total": total,
            "items": [self._enrich_waste(r) for r in records]
        }

    def _enrich_waste(self, record: WasteRecord) -> Dict[str, Any]:
        data = record.to_dict(include_relations=True)

        rule_results = self.db.query(RuleResult).filter(RuleResult.waste_record_id == record.id).all()
        data["rule_results"] = [r.to_dict() for r in rule_results]
        data["has_exception"] = len(rule_results) > 0

        reviews = self.db.query(ReviewRecord).filter(ReviewRecord.waste_record_id == record.id).all()
        data["reviews"] = [r.to_dict() for r in reviews]
        data["review_status"] = reviews[0].review_status if reviews else "unreviewed"

        return data

    def get_exception_summary(self,
                               store_id: Optional[str] = None,
                               start_time: Optional[datetime] = None,
                               end_time: Optional[datetime] = None) -> Dict[str, Any]:

        summary = {
            "by_type": {},
            "by_store": {},
            "by_status": {},
            "total_exceptions": 0,
            "total_blocked": 0
        }

        query = self.db.query(RuleResult)

        if start_time or end_time:
            query = query.filter(RuleResult.applied_at.isnot(None))
            if start_time:
                query = query.filter(RuleResult.applied_at >= start_time)
            if end_time:
                query = query.filter(RuleResult.applied_at <= end_time)

        results = query.all()
        summary["total_exceptions"] = len(results)
        summary["total_blocked"] = sum(1 for r in results if r.is_blocked)

        for result in results:
            ex_type = result.exception_type
            summary["by_type"][ex_type] = summary["by_type"].get(ex_type, 0) + 1

            if result.sample_id:
                sample = self.db.query(FoodSample).get(result.sample_id)
                if sample:
                    store_id_val = sample.store_id
                    status = sample.status
                    summary["by_store"][store_id_val] = summary["by_store"].get(store_id_val, 0) + 1
                    summary["by_status"][status] = summary["by_status"].get(status, 0) + 1
            elif result.temperature_record_id:
                temp = self.db.query(TemperatureRecord).get(result.temperature_record_id)
                if temp:
                    store_id_val = temp.store_id
                    status = temp.status
                    summary["by_store"][store_id_val] = summary["by_store"].get(store_id_val, 0) + 1
                    summary["by_status"][status] = summary["by_status"].get(status, 0) + 1
            elif result.waste_record_id:
                waste = self.db.query(WasteRecord).get(result.waste_record_id)
                if waste:
                    store_id_val = waste.store_id
                    status = waste.status
                    summary["by_store"][store_id_val] = summary["by_store"].get(store_id_val, 0) + 1
                    summary["by_status"][status] = summary["by_status"].get(status, 0) + 1

        return summary

    def get_batch_summary(self, batch_id: str) -> Dict[str, Any]:
        samples = self.db.query(FoodSample).filter(FoodSample.batch_id == batch_id).all()
        waste_records = self.db.query(WasteRecord).filter(WasteRecord.batch_id == batch_id).all()

        store_ids = set()
        for s in samples:
            store_ids.add(s.store_id)
        for w in waste_records:
            store_ids.add(w.store_id)

        stores = []
        for sid in store_ids:
            store = self.db.query(Store).get(sid)
            if store:
                stores.append({
                    "store_id": store.id,
                    "store_name": store.name,
                    "manager_name": store.manager_name
                })

        return {
            "batch_id": batch_id,
            "sample_count": len(samples),
            "waste_count": len(waste_records),
            "store_count": len(stores),
            "stores": stores,
            "total_weight_samples": sum(s.sample_weight or 0 for s in samples),
            "total_weight_waste": sum(w.waste_weight or 0 for w in waste_records)
        }
