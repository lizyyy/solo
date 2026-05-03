from typing import Dict, Any, List, Tuple, Optional
from .config_loader import ConfigLoader


class CompatibilityChecker:
    def __init__(self, config_loader: ConfigLoader):
        self.config = config_loader

    def parse_blood_type(self, blood_type: str) -> Tuple[str, str]:
        if len(blood_type) < 2:
            return blood_type, '+'
        abo = blood_type[:-1]
        rh = blood_type[-1]
        if rh not in ['+', '-']:
            abo = blood_type
            rh = '+'
        return abo, rh

    def is_compatible(self, donor_blood_type: str, recipient_blood_type: str) -> Tuple[bool, str]:
        donor_abo, donor_rh = self.parse_blood_type(donor_blood_type)
        recipient_abo, recipient_rh = self.parse_blood_type(recipient_blood_type)

        abo_compatible = recipient_abo in self.config.get_abo_compatible_recipients(donor_abo)
        rh_compatible = self.config.is_rh_compatible(donor_rh, recipient_rh)

        if not abo_compatible and not rh_compatible:
            return False, f"ABO血型不相容({donor_abo}→{recipient_abo})且Rh血型不相容({donor_rh}→{recipient_rh})"
        elif not abo_compatible:
            return False, f"ABO血型不相容({donor_abo}→{recipient_abo})"
        elif not rh_compatible:
            return False, f"Rh血型不相容({donor_rh}→{recipient_rh})"

        return True, "相容"

    def get_compatibility_level(self, donor_blood_type: str, recipient_blood_type: str) -> int:
        donor_abo, donor_rh = self.parse_blood_type(donor_blood_type)
        recipient_abo, recipient_rh = self.parse_blood_type(recipient_blood_type)

        same_abo = donor_abo == recipient_abo
        same_rh = donor_rh == recipient_rh

        if same_abo and same_rh:
            return 1
        elif same_abo and not same_rh:
            return 2
        elif not same_abo and same_rh:
            return 3
        else:
            return 4

    def get_compatible_blood_types_for_recipient(self, recipient_blood_type: str) -> List[str]:
        recipient_abo, recipient_rh = self.parse_blood_type(recipient_blood_type)
        compatible_abo = self.config.get_abo_compatible_donors(recipient_abo)

        compatible_types = []
        for abo in compatible_abo:
            if recipient_rh == '+':
                compatible_types.append(f"{abo}+")
                compatible_types.append(f"{abo}-")
            else:
                compatible_types.append(f"{abo}-")

        return compatible_types

    def check_appointment_compatibility(self, appointment: Dict[str, Any], blood_bag: Dict[str, Any]) -> Dict[str, Any]:
        required_type = appointment.get('required_blood_type', '')
        bag_type = blood_bag.get('blood_type', '')

        is_compat, reason = self.is_compatible(bag_type, required_type)
        level = self.get_compatibility_level(bag_type, required_type)

        return {
            'is_compatible': is_compat,
            'reason': reason,
            'compatibility_level': level,
            'donor_type': bag_type,
            'recipient_type': required_type
        }

    def get_priority_label(self, level: int) -> str:
        labels = {
            1: "完全匹配(同ABO同Rh)",
            2: "ABO匹配Rh不同",
            3: "ABO相容Rh匹配",
            4: "ABO相容Rh不同"
        }
        return labels.get(level, "未知")
