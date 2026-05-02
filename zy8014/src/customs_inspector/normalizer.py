import re
from typing import Dict, List, Optional, Tuple

from .models import (
    Manifest, ManifestItem, PackingList, PackingItem,
    ValidationError, ValidationErrorType, RiskLevel
)


WEIGHT_CONVERSIONS = {
    'KG': 1.0,
    'KGS': 1.0,
    'G': 0.001,
    'GRAMS': 0.001,
    'LB': 0.453592,
    'LBS': 0.453592,
    'POUND': 0.453592,
    'POUNDS': 0.453592,
    'T': 1000.0,
    'TON': 1000.0,
    'TONS': 1000.0,
    'MT': 1000.0,
}

VOLUME_CONVERSIONS = {
    'CBM': 1.0,
    'M3': 1.0,
    'CUBIC_METER': 1.0,
    'CUBIC_METERS': 1.0,
    'L': 0.001,
    'LITER': 0.001,
    'LITERS': 0.001,
    'ML': 0.000001,
    'GAL': 0.00378541,
    'GALLON': 0.00378541,
    'GALLONS': 0.00378541,
}

COUNTRY_CODE_MAPPING = {
    '中国': 'CN', 'CHINA': 'CN', '中华人民共和国': 'CN',
    '美国': 'US', 'USA': 'US', 'UNITED STATES': 'US',
    '日本': 'JP', 'JAPAN': 'JP',
    '韩国': 'KR', 'KOREA': 'KR', '南韩': 'KR',
    '德国': 'DE', 'GERMANY': 'DE',
    '英国': 'GB', 'UK': 'GB', 'UNITED KINGDOM': 'GB',
    '法国': 'FR', 'FRANCE': 'FR',
    '意大利': 'IT', 'ITALY': 'IT',
    '加拿大': 'CA', 'CANADA': 'CA',
    '澳大利亚': 'AU', 'AUSTRALIA': 'AU',
    '新加坡': 'SG', 'SINGAPORE': 'SG',
    '马来西亚': 'MY', 'MALAYSIA': 'MY',
    '泰国': 'TH', 'THAILAND': 'TH',
    '越南': 'VN', 'VIETNAM': 'VN',
    '印度': 'IN', 'INDIA': 'IN',
    '巴西': 'BR', 'BRAZIL': 'BR',
    '墨西哥': 'MX', 'MEXICO': 'MX',
    '俄罗斯': 'RU', 'RUSSIA': 'RU',
    '南非': 'ZA', 'SOUTH AFRICA': 'ZA',
    '阿联酋': 'AE', 'UNITED ARAB EMIRATES': 'AE',
    '沙特': 'SA', 'SAUDI ARABIA': 'SA',
    '土耳其': 'TR', 'TURKEY': 'TR',
    '荷兰': 'NL', 'NETHERLANDS': 'NL',
    '比利时': 'BE', 'BELGIUM': 'BE',
    '瑞士': 'CH', 'SWITZERLAND': 'CH',
    '瑞典': 'SE', 'SWEDEN': 'SE',
    '丹麦': 'DK', 'DENMARK': 'DK',
    '挪威': 'NO', 'NORWAY': 'NO',
    '芬兰': 'FI', 'FINLAND': 'FI',
    '波兰': 'PL', 'POLAND': 'PL',
    '西班牙': 'ES', 'SPAIN': 'ES',
    '葡萄牙': 'PT', 'PORTUGAL': 'PT',
    '希腊': 'GR', 'GREECE': 'GR',
    '奥地利': 'AT', 'AUSTRIA': 'AT',
    '爱尔兰': 'IE', 'IRELAND': 'IE',
    '捷克': 'CZ', 'CZECH REPUBLIC': 'CZ',
    '匈牙利': 'HU', 'HUNGARY': 'HU',
    '罗马尼亚': 'RO', 'ROMANIA': 'RO',
    '保加利亚': 'BG', 'BULGARIA': 'BG',
    '克罗地亚': 'HR', 'CROATIA': 'HR',
    '斯洛伐克': 'SK', 'SLOVAKIA': 'SK',
    '斯洛文尼亚': 'SI', 'SLOVENIA': 'SI',
    '爱沙尼亚': 'EE', 'ESTONIA': 'EE',
    '拉脱维亚': 'LV', 'LATVIA': 'LV',
    '立陶宛': 'LT', 'LITHUANIA': 'LT',
    '冰岛': 'IS', 'ICELAND': 'IS',
    '新西兰': 'NZ', 'NEW ZEALAND': 'NZ',
    '印度尼西亚': 'ID', 'INDONESIA': 'ID',
    '菲律宾': 'PH', 'PHILIPPINES': 'PH',
    '缅甸': 'MM', 'MYANMAR': 'MM',
    '柬埔寨': 'KH', 'CAMBODIA': 'KH',
    '老挝': 'LA', 'LAOS': 'LA',
    '蒙古': 'MN', 'MONGOLIA': 'MN',
    '朝鲜': 'KP', 'NORTH KOREA': 'KP',
    '巴基斯坦': 'PK', 'PAKISTAN': 'PK',
    '孟加拉国': 'BD', 'BANGLADESH': 'BD',
    '斯里兰卡': 'LK', 'SRI LANKA': 'LK',
    '尼泊尔': 'NP', 'NEPAL': 'NP',
    '不丹': 'BT', 'BHUTAN': 'BT',
    '马尔代夫': 'MV', 'MALDIVES': 'MV',
    '哈萨克斯坦': 'KZ', 'KAZAKHSTAN': 'KZ',
    '乌兹别克斯坦': 'UZ', 'UZBEKISTAN': 'UZ',
    '吉尔吉斯斯坦': 'KG', 'KYRGYZSTAN': 'KG',
    '塔吉克斯坦': 'TJ', 'TAJIKISTAN': 'TJ',
    '土库曼斯坦': 'TM', 'TURKMENISTAN': 'TM',
    '阿塞拜疆': 'AZ', 'AZERBAIJAN': 'AZ',
    '格鲁吉亚': 'GE', 'GEORGIA': 'GE',
    '亚美尼亚': 'AM', 'ARMENIA': 'AM',
    '以色列': 'IL', 'ISRAEL': 'IL',
    '巴勒斯坦': 'PS', 'PALESTINE': 'PS',
    '约旦': 'JO', 'JORDAN': 'JO',
    '黎巴嫩': 'LB', 'LEBANON': 'LB',
    '叙利亚': 'SY', 'SYRIA': 'SY',
    '伊拉克': 'IQ', 'IRAQ': 'IQ',
    '伊朗': 'IR', 'IRAN': 'IR',
    '科威特': 'KW', 'KUWAIT': 'KW',
    '巴林': 'BH', 'BAHRAIN': 'BH',
    '卡塔尔': 'QA', 'QATAR': 'QA',
    '阿曼': 'OM', 'OMAN': 'OM',
    '也门': 'YE', 'YEMEN': 'YE',
    '埃及': 'EG', 'EGYPT': 'EG',
    '利比亚': 'LY', 'LIBYA': 'LY',
    '突尼斯': 'TN', 'TUNISIA': 'TN',
    '阿尔及利亚': 'DZ', 'ALGERIA': 'DZ',
    '摩洛哥': 'MA', 'MOROCCO': 'MA',
    '苏丹': 'SD', 'SUDAN': 'SD',
    '南苏丹': 'SS', 'SOUTH SUDAN': 'SS',
    '埃塞俄比亚': 'ET', 'ETHIOPIA': 'ET',
    '肯尼亚': 'KE', 'KENYA': 'KE',
    '坦桑尼亚': 'TZ', 'TANZANIA': 'TZ',
    '乌干达': 'UG', 'UGANDA': 'UG',
    '卢旺达': 'RW', 'RWANDA': 'RW',
    '布隆迪': 'BI', 'BURUNDI': 'BI',
    '索马里': 'SO', 'SOMALIA': 'SO',
    '吉布提': 'DJ', 'DJIBOUTI': 'DJ',
    '厄立特里亚': 'ER', 'ERITREA': 'ER',
    '尼日利亚': 'NG', 'NIGERIA': 'NG',
    '加纳': 'GH', 'GHANA': 'GH',
    '科特迪瓦': 'CI', 'IVORY COAST': 'CI',
    '塞内加尔': 'SN', 'SENEGAL': 'SN',
    '马里': 'ML', 'MALI': 'ML',
    '布基纳法索': 'BF', 'BURKINA FASO': 'BF',
    '尼日尔': 'NE', 'NIGER': 'NE',
    '乍得': 'TD', 'CHAD': 'TD',
    '喀麦隆': 'CM', 'CAMEROON': 'CM',
    '加蓬': 'GA', 'GABON': 'GA',
    '刚果': 'CG', 'CONGO': 'CG',
    '刚果民主共和国': 'CD', 'DR CONGO': 'CD',
    '安哥拉': 'AO', 'ANGOLA': 'AO',
    '赞比亚': 'ZM', 'ZAMBIA': 'ZM',
    '津巴布韦': 'ZW', 'ZIMBABWE': 'ZW',
    '莫桑比克': 'MZ', 'MOZAMBIQUE': 'MZ',
    '马达加斯加': 'MG', 'MADAGASCAR': 'MG',
    '毛里求斯': 'MU', 'MAURITIUS': 'MU',
    '塞舌尔': 'SC', 'SEYCHELLES': 'SC',
    '科摩罗': 'KM', 'COMOROS': 'KM',
    '阿根廷': 'AR', 'ARGENTINA': 'AR',
    '智利': 'CL', 'CHILE': 'CL',
    '秘鲁': 'PE', 'PERU': 'PE',
    '哥伦比亚': 'CO', 'COLOMBIA': 'CO',
    '委内瑞拉': 'VE', 'VENEZUELA': 'VE',
    '厄瓜多尔': 'EC', 'ECUADOR': 'EC',
    '玻利维亚': 'BO', 'BOLIVIA': 'BO',
    '巴拉圭': 'PY', 'PARAGUAY': 'PY',
    '乌拉圭': 'UY', 'URUGUAY': 'UY',
    '古巴': 'CU', 'CUBA': 'CU',
    '多米尼加': 'DO', 'DOMINICAN REPUBLIC': 'DO',
    '海地': 'HT', 'HAITI': 'HT',
    '牙买加': 'JM', 'JAMAICA': 'JM',
    '波多黎各': 'PR', 'PUERTO RICO': 'PR',
    '巴拿马': 'PA', 'PANAMA': 'PA',
    '哥斯达黎加': 'CR', 'COSTA RICA': 'CR',
    '尼加拉瓜': 'NI', 'NICARAGUA': 'NI',
    '洪都拉斯': 'HN', 'HONDURAS': 'HN',
    '萨尔瓦多': 'SV', 'EL SALVADOR': 'SV',
    '危地马拉': 'GT', 'GUATEMALA': 'GT',
    '伯利兹': 'BZ', 'BELIZE': 'BZ',
    '巴哈马': 'BS', 'BAHAMAS': 'BS',
    '巴巴多斯': 'BB', 'BARBADOS': 'BB',
    '特立尼达和多巴哥': 'TT', 'TRINIDAD AND TOBAGO': 'TT',
}


class Normalizer:
    
    def __init__(self):
        self.errors: List[ValidationError] = []
    
    def normalize_manifest(self, manifest: Manifest) -> Manifest:
        self.errors = []
        
        normalized_items = []
        for item in manifest.items:
            normalized_item = self._normalize_manifest_item(item)
            normalized_items.append(normalized_item)
        
        return Manifest(
            voyage_no=self._normalize_voyage_no(manifest.voyage_no),
            vessel_name=self._normalize_vessel_name(manifest.vessel_name),
            eta=manifest.eta,
            etd=manifest.etd,
            items=normalized_items,
            raw_data=manifest.raw_data
        )
    
    def normalize_packing_list(self, packing_list: PackingList) -> PackingList:
        normalized_items = []
        for item in packing_list.items:
            normalized_item = self._normalize_packing_item(item)
            normalized_items.append(normalized_item)
        
        return PackingList(
            ticket_no=self._normalize_ticket_no(packing_list.ticket_no),
            packing_date=packing_list.packing_date,
            items=normalized_items,
            total_weight=packing_list.total_weight,
            total_volume=packing_list.total_volume,
            raw_data=packing_list.raw_data
        )
    
    def _normalize_manifest_item(self, item: ManifestItem) -> ManifestItem:
        normalized_hs = self._normalize_hs_code(item.hs_code, item.ticket_no, item.container_no)
        normalized_weight, weight_errors = self._normalize_weight(item.weight, item.weight_unit, item.ticket_no, item.container_no)
        normalized_volume, volume_errors = self._normalize_volume(item.volume, item.volume_unit, item.ticket_no, item.container_no)
        
        self.errors.extend(weight_errors)
        self.errors.extend(volume_errors)
        
        return ManifestItem(
            ticket_no=self._normalize_ticket_no(item.ticket_no),
            container_no=self._normalize_container_no(item.container_no, item.ticket_no),
            description=self._normalize_description(item.description),
            hs_code=normalized_hs,
            weight=normalized_weight,
            weight_unit='KG',
            volume=normalized_volume,
            volume_unit='CBM',
            quantity=item.quantity,
            origin_country=self._normalize_country(item.origin_country),
            destination_country=self._normalize_country(item.destination_country),
            is_cancelled=item.is_cancelled,
            raw_data=item.raw_data
        )
    
    def _normalize_packing_item(self, item: PackingItem) -> PackingItem:
        normalized_hs = self._normalize_hs_code(item.hs_code, item.ticket_no, item.container_no)
        normalized_weight, weight_errors = self._normalize_weight(item.weight, item.weight_unit, item.ticket_no, item.container_no)
        normalized_volume, volume_errors = self._normalize_volume(item.volume, item.volume_unit, item.ticket_no, item.container_no)
        
        self.errors.extend(weight_errors)
        self.errors.extend(volume_errors)
        
        return PackingItem(
            ticket_no=self._normalize_ticket_no(item.ticket_no),
            container_no=self._normalize_container_no(item.container_no, item.ticket_no),
            description=self._normalize_description(item.description),
            hs_code=normalized_hs,
            weight=normalized_weight,
            weight_unit='KG',
            volume=normalized_volume,
            volume_unit='CBM',
            quantity=item.quantity,
            package_type=item.package_type,
            marks=item.marks,
            raw_data=item.raw_data
        )
    
    def _normalize_hs_code(self, hs_code: Optional[str], ticket_no: str, container_no: str) -> Optional[str]:
        if not hs_code:
            return None
        
        cleaned = re.sub(r'[^\d.]', '', hs_code)
        cleaned = cleaned.replace('.', '')
        
        if len(cleaned) < 4:
            self.errors.append(ValidationError(
                error_type=ValidationErrorType.INVALID_HS_CODE,
                message=f"HS编码格式无效，长度不足: {hs_code}",
                ticket_no=ticket_no,
                container_no=container_no,
                risk_level=RiskLevel.HIGH,
                metadata={'original_hs': hs_code}
            ))
            return hs_code
        
        if len(cleaned) >= 8:
            normalized = cleaned[:4] + ' ' + cleaned[4:6] + ' ' + cleaned[6:8]
            if len(cleaned) > 8:
                normalized += cleaned[8:]
            return normalized
        elif len(cleaned) >= 6:
            return cleaned[:4] + ' ' + cleaned[4:6]
        
        return cleaned
    
    def _normalize_weight(self, weight: Optional[float], unit: str, ticket_no: str, container_no: str) -> Tuple[Optional[float], List[ValidationError]]:
        errors = []
        
        if weight is None:
            return None, errors
        
        unit_upper = unit.upper().strip()
        factor = WEIGHT_CONVERSIONS.get(unit_upper)
        
        if factor is None:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_WEIGHT,
                message=f"未知的重量单位: {unit}，无法转换",
                ticket_no=ticket_no,
                container_no=container_no,
                risk_level=RiskLevel.MEDIUM,
                metadata={'original_unit': unit}
            ))
            return weight, errors
        
        normalized = weight * factor
        return round(normalized, 3), errors
    
    def _normalize_volume(self, volume: Optional[float], unit: str, ticket_no: str, container_no: str) -> Tuple[Optional[float], List[ValidationError]]:
        errors = []
        
        if volume is None:
            return None, errors
        
        unit_upper = unit.upper().strip()
        factor = VOLUME_CONVERSIONS.get(unit_upper)
        
        if factor is None:
            errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_VOLUME,
                message=f"未知的体积单位: {unit}，无法转换",
                ticket_no=ticket_no,
                container_no=container_no,
                risk_level=RiskLevel.MEDIUM,
                metadata={'original_unit': unit}
            ))
            return volume, errors
        
        normalized = volume * factor
        return round(normalized, 4), errors
    
    def _normalize_container_no(self, container_no: str, ticket_no: str) -> str:
        if not container_no:
            return container_no
        
        cleaned = re.sub(r'[^A-Z0-9]', '', container_no.upper())
        
        if len(cleaned) == 11:
            owner_code = cleaned[:4]
            serial = cleaned[4:10]
            check_digit = cleaned[10]
            return f"{owner_code}{serial}{check_digit}"
        
        return cleaned
    
    def _normalize_ticket_no(self, ticket_no: str) -> str:
        if not ticket_no:
            return ticket_no
        return ticket_no.strip().upper()
    
    def _normalize_voyage_no(self, voyage_no: str) -> str:
        if not voyage_no:
            return voyage_no
        return voyage_no.strip().upper()
    
    def _normalize_vessel_name(self, vessel_name: str) -> str:
        if not vessel_name:
            return vessel_name
        return ' '.join(word.capitalize() for word in vessel_name.strip().split())
    
    def _normalize_description(self, description: str) -> str:
        if not description:
            return description
        return description.strip()
    
    def _normalize_country(self, country: Optional[str]) -> Optional[str]:
        if not country:
            return None
        
        country_upper = country.strip().upper()
        country_title = country.strip().title()
        
        if country_upper in COUNTRY_CODE_MAPPING:
            return COUNTRY_CODE_MAPPING[country_upper]
        if country_title in COUNTRY_CODE_MAPPING:
            return COUNTRY_CODE_MAPPING[country_title]
        
        if len(country.strip()) == 2:
            return country.upper()
        
        return country.strip()
    
    def get_errors(self) -> List[ValidationError]:
        return self.errors
