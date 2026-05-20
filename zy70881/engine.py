import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple
import numpy as np

from models import (
    MeterData, TenantContract, TemperatureZone,
    AllocationRecord, ProcessedResult, RecordStatus
)


class AllocationEngine:
    def __init__(self):
        self.price_per_kwh = 0.8
        self.abnormal_threshold = 2.0

    def process_allocation(
        self,
        batch_id: str,
        meter_data: List[MeterData],
        contracts: List[TenantContract],
        zones: List[TemperatureZone]
    ) -> ProcessedResult:
        contract_map = {c.tenant_id: c for c in contracts}
        zone_map = {z.zone_id: z for z in zones}
        
        success_items: List[AllocationRecord] = []
        pending_items: List[AllocationRecord] = []
        failed_items: List[AllocationRecord] = []
        
        total_kwh = sum(m.total_kwh for m in meter_data)
        total_amount = 0.0
        
        for meter in meter_data:
            record, status = self._allocate_meter_record(
                meter, contract_map, zone_map
            )
            
            if status == RecordStatus.SUCCESS:
                success_items.append(record)
                total_amount += record.amount
            elif status == RecordStatus.PENDING:
                pending_items.append(record)
            else:
                failed_items.append(record)
        
        summary = {
            "total_kwh": sum(m.total_kwh for m in meter_data),
            "total_amount": total_amount,
            "avg_multiplier": float(np.mean([r.power_multiplier for r in success_items])) if success_items else 1.0,
            "contracts_count": len(contracts),
            "zones_count": len(zones)
        }
        
        return ProcessedResult(
            batch_id=batch_id,
            processed_at=datetime.now(),
            total_records=len(meter_data),
            success_count=len(success_items),
            pending_count=len(pending_items),
            failed_count=len(failed_items),
            success_items=success_items,
            pending_items=pending_items,
            failed_items=failed_items,
            summary=summary
        )

    def _allocate_meter_record(
        self,
        meter: MeterData,
        contract_map: Dict[str, TenantContract],
        zone_map: Dict[str, TemperatureZone]
    ) -> Tuple[AllocationRecord, RecordStatus]:
        record_id = str(uuid.uuid4())
        tenant_id = meter.tenant_id
        zone_id = meter.zone_id
        
        error_messages = []
        suggestions = []
        source_trace = {
            "meter_id": meter.meter_id,
            "reading_date": meter.reading_date.isoformat(),
            "original_kwh": meter.total_kwh
        }
        
        contract = None
        zone = None
        status = RecordStatus.SUCCESS
        power_multiplier = 1.0
        
        if not tenant_id and not zone_id:
            error_messages.append("电表数据缺少租户ID和温区ID")
            suggestions.extend([
                "请在电表CSV中补充 tenant_id 或 zone_id 字段",
                "检查该电表是否已分配给特定租户或温区"
            ])
            status = RecordStatus.FAILED
        
        if tenant_id:
            contract = contract_map.get(tenant_id)
            if not contract:
                error_messages.append(f"未找到租户 {tenant_id} 的有效合同")
                suggestions.append(f"请在合同JSON中添加该租户的合同信息")
                status = RecordStatus.FAILED
            else:
                source_trace["contract_id"] = contract.contract_id
                source_trace["contract_name"] = contract.tenant_name
                power_multiplier, multiplier_source = self._get_applicable_multiplier(
                    contract, meter.reading_date
                )
                source_trace["multiplier_source"] = multiplier_source
                
                if not contract.is_active:
                    error_messages.append("租户合同已失效")
                    suggestions.append("请检查租户合同状态是否正确")
                    status = RecordStatus.PENDING
        
        if zone_id:
            zone = zone_map.get(zone_id)
            if not zone:
                error_messages.append(f"未找到温区 {zone_id} 的配置")
                suggestions.append(f"请在温区CSV中添加该温区配置")
                if status != RecordStatus.FAILED:
                    status = RecordStatus.PENDING
            else:
                source_trace["zone_name"] = zone.zone_name
                source_trace["zone_multiplier"] = zone.power_multiplier
                power_multiplier *= zone.power_multiplier
        
        if contract:
            is_vacant, vacancy_msg = self._check_vacancy(contract, meter.reading_date)
            if is_vacant:
                error_messages.append(vacancy_msg)
                suggestions.extend([
                    "确认该时段是否为真正空置期",
                    "空置期电费需单独计入园区公摊"
                ])
                source_trace["vacancy_detected"] = True
                if status == RecordStatus.SUCCESS:
                    status = RecordStatus.PENDING
        
        is_abnormal, abnormal_msg = self._check_abnormal_peak(meter)
        if is_abnormal:
            error_messages.append(abnormal_msg)
            suggestions.extend([
                "检查是否有临时加班或设备异常",
                "核对电表读数是否正确",
                "确认是否有新增制冷设备"
            ])
            source_trace["abnormal_peak"] = True
            if status == RecordStatus.SUCCESS:
                status = RecordStatus.PENDING
        
        allocated_kwh = meter.total_kwh * power_multiplier
        amount = allocated_kwh * 0.8
        
        record = AllocationRecord(
            record_id=record_id,
            status=status,
            tenant_id=tenant_id,
            tenant_name=contract.tenant_name if contract else None,
            meter_id=meter.meter_id,
            zone_id=zone_id,
            reading_date=meter.reading_date,
            original_kwh=meter.total_kwh,
            allocated_kwh=allocated_kwh,
            power_multiplier=power_multiplier,
            amount=amount,
            error_message="; ".join(error_messages) if error_messages else None,
            suggestions=suggestions if suggestions else None,
            source_trace=source_trace,
            raw_data=meter.raw_data
        )
        
        return record, status

    def _get_applicable_multiplier(self, contract: TenantContract, reading_date: datetime) -> Tuple[float, str]:
        if contract.multiplier_effective_date:
            if reading_date >= contract.multiplier_effective_date:
                return contract.power_multiplier, "new_multiplier"
            else:
                return 1.0, "base_rate"
        return contract.power_multiplier, "contract_multiplier"

    def _check_vacancy(self, contract: TenantContract, reading_date: datetime) -> Tuple[bool, str]:
        if reading_date < contract.start_date:
            days_diff = (contract.start_date - reading_date).days
            return True, f"读数日期在合同生效前{days_diff}天，可能为空置期"
        
        if contract.end_date and reading_date > contract.end_date:
            days_diff = (reading_date - contract.end_date).days
            return True, f"读数日期在合同到期后{days_diff}天，可能为空置期"
        
        return False, ""

    def _check_abnormal_peak(self, meter: MeterData) -> Tuple[bool, str]:
        if meter.total_kwh <= 0:
            return False, ""
        
        peak_ratio = meter.peak_kwh / meter.total_kwh if meter.total_kwh > 0 else 0
        
        if peak_ratio > 0.6:
            return True, f"尖峰用电占比异常: {peak_ratio:.1%}，可能存在临时加班或设备异常"
        
        if meter.peak_kwh > 1000:
            return True, f"尖峰用电量异常高: {meter.peak_kwh}kWh，超出正常范围"
        
        return False, ""
