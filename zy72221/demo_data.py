from models import CounterRecord, InstitutionMapping, ManagerEmail
from typing import List, Dict


def get_counter_records() -> List[CounterRecord]:
    return [
        CounterRecord(
            tail_number="8823",
            institution_name="华信证券",
            trade_date="2026-05-28",
            amount=1250000.00,
            slippage=0.00085
        ),
        CounterRecord(
            tail_number="8823",
            institution_name="华信证券股份",
            trade_date="2026-05-29",
            amount=980000.00,
            slippage=0.00092
        ),
        CounterRecord(
            tail_number="6617",
            institution_name="国泰君安",
            trade_date="2026-05-28",
            amount=2100000.00,
            slippage=0.00056
        ),
        CounterRecord(
            tail_number="6617",
            institution_name="国泰君安证券",
            trade_date="2026-05-29",
            amount=1750000.00,
            slippage=0.00061
        ),
        CounterRecord(
            tail_number="4452",
            institution_name="中信建投",
            trade_date="2026-05-28",
            amount=3200000.00,
            slippage=0.00123
        ),
        CounterRecord(
            tail_number="4452",
            institution_name="中信建投",
            trade_date="2026-05-29",
            amount=2800000.00,
            slippage=0.00118
        )
    ]


def get_institution_mapping() -> Dict[str, InstitutionMapping]:
    return {
        "8823": InstitutionMapping(
            tail_number="8823",
            official_name="华信证券",
            historical_aliases=["上海华信证券"]
        ),
        "6617": InstitutionMapping(
            tail_number="6617",
            official_name="国泰君安证券",
            historical_aliases=[]
        ),
        "4452": InstitutionMapping(
            tail_number="4452",
            official_name="中信建投证券",
            historical_aliases=["中信建投", "华夏证券"]
        )
    }


def get_manager_emails() -> List[ManagerEmail]:
    return [
        ManagerEmail(
            email_id="EML-2026-0530-001",
            tail_number="6617",
            institution_name_old="国泰君安",
            supplement_date="2026-05-30",
            operator="阿南",
            remark="客户经理张总补发5月28日旧口径说明，当时系统还在用国泰君安简称",
            source="客户经理补充邮件"
        ),
        ManagerEmail(
            email_id="EML-2026-0530-002",
            tail_number="8823",
            institution_name_old="华信证券股份",
            supplement_date="2026-05-30",
            operator="阿南",
            remark="客户经理李总说明5月29日使用了全称，系柜台录入时误操作",
            source="客户经理补充邮件"
        )
    ]


def get_historical_records() -> List[Dict]:
    return [
        {
            "tail_number": "6617",
            "institution_name": "国泰君安",
            "trade_date": "2026-05-20",
            "amount": 1900000.00,
            "slippage": 0.00058,
            "source": "历史归档数据"
        },
        {
            "tail_number": "6617",
            "institution_name": "国泰君安",
            "trade_date": "2026-05-25",
            "amount": 2050000.00,
            "slippage": 0.00054,
            "source": "历史归档数据"
        },
        {
            "tail_number": "4452",
            "institution_name": "中信建投",
            "trade_date": "2026-05-18",
            "amount": 3000000.00,
            "slippage": 0.00121,
            "source": "历史归档数据"
        }
    ]
