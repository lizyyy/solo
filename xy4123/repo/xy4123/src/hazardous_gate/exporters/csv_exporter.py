import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.models.schemas import RiskItem
from hazardous_gate.rules.engine import RiskAssessmentEngine


class CSVExporter:
    @staticmethod
    def format_decimal(value: Optional[Decimal]) -> str:
        if value is None:
            return ""
        return f"{value.normalize():f}"

    @staticmethod
    def format_date(value: Optional[date]) -> str:
        if value is None:
            return ""
        return value.strftime("%Y-%m-%d")

    @staticmethod
    def format_datetime(value: Optional[datetime]) -> str:
        if value is None:
            return ""
        return value.strftime("%Y-%m-%d %H:%M:%S")

    @classmethod
    async def export_risk_list(
        cls,
        db: AsyncSession,
    ) -> str:
        risk_engine = RiskAssessmentEngine(db)
        risks = await risk_engine.get_all_risks()

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "试剂名称",
            "CAS号",
            "批号",
            "风险类型",
            "风险等级",
            "描述",
            "当前数量",
            "单位",
            "有效期",
            "生成时间",
        ])

        generated_at = cls.format_datetime(datetime.now())
        for risk in risks:
            writer.writerow([
                risk.reagent_name,
                risk.cas_number,
                risk.batch_number,
                risk.risk_type,
                risk.risk_level,
                risk.description,
                cls.format_decimal(risk.current_quantity),
                risk.unit,
                cls.format_date(risk.expiry_date),
                generated_at,
            ])

        return output.getvalue()

    @classmethod
    async def export_risk_list_bytes(
        cls,
        db: AsyncSession,
        encoding: str = "utf-8-sig",
    ) -> bytes:
        csv_content = await cls.export_risk_list(db)
        return csv_content.encode(encoding)

    @classmethod
    def export_custom_csv(
        cls,
        headers: list[str],
        rows: list[list],
    ) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)

        return output.getvalue()
