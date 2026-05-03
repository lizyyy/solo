import yaml
import os
from typing import Dict, Any, List, Optional


class ConfigLoader:
    def __init__(self, config_dir: str = None):
        if config_dir is None:
            config_dir = os.path.join(os.path.dirname(__file__), '..', 'config')
        self.config_dir = config_dir
        self.compatibility_config: Dict[str, Any] = {}
        self.campus_config: Dict[str, Any] = {}

    def load_compatibility_config(self, filename: str = 'blood_compatibility.yaml') -> Dict[str, Any]:
        file_path = os.path.join(self.config_dir, filename)
        with open(file_path, 'r', encoding='utf-8') as f:
            self.compatibility_config = yaml.safe_load(f)
        return self.compatibility_config

    def load_campus_config(self, filename: str = 'campus_distance.yaml') -> Dict[str, Any]:
        file_path = os.path.join(self.config_dir, filename)
        with open(file_path, 'r', encoding='utf-8') as f:
            self.campus_config = yaml.safe_load(f)
        return self.campus_config

    def get_abo_compatible_donors(self, recipient_abo: str) -> List[str]:
        compatible = []
        donor_map = self.compatibility_config.get('abo_compatibility', {}).get('donor_to_recipient', {})
        for donor_abo, recipients in donor_map.items():
            if recipient_abo in recipients:
                compatible.append(donor_abo)
        return compatible

    def get_abo_compatible_recipients(self, donor_abo: str) -> List[str]:
        donor_map = self.compatibility_config.get('abo_compatibility', {}).get('donor_to_recipient', {})
        return donor_map.get(donor_abo, [])

    def is_rh_compatible(self, donor_rh: str, recipient_rh: str) -> bool:
        positive_to_negative = self.compatibility_config.get('rh_compatibility', {}).get('positive_to_negative', False)
        if donor_rh == '-' and recipient_rh == '+':
            return True
        if donor_rh == '+' and recipient_rh == '-':
            return positive_to_negative
        return donor_rh == recipient_rh

    def get_campus_distance(self, from_campus: str, to_campus: str) -> int:
        matrix = self.campus_config.get('distance_matrix', {}).get('matrix', {})
        return matrix.get(from_campus, {}).get(to_campus, 999)

    def get_campus_name(self, campus_id: str) -> str:
        campuses = self.campus_config.get('campuses', [])
        for campus in campuses:
            if campus.get('id') == campus_id:
                return campus.get('name', campus_id)
        return campus_id

    def get_all_campuses(self) -> List[Dict[str, str]]:
        return self.campus_config.get('campuses', [])

    def is_rare_blood_type(self, blood_type: str) -> bool:
        rare_types = self.compatibility_config.get('blood_type_groups', {}).get('rare_types', [])
        return blood_type in rare_types

    def get_max_transfer_time(self) -> int:
        return self.campus_config.get('distance_matrix', {}).get('max_transfer_time', 30)
