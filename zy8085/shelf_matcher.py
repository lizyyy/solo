from typing import Dict, List, Optional, Tuple

class ShelfMatcher:
    def __init__(self, shelf_map: Dict[str, List[str]]):
        self.shelf_map = shelf_map
        self.temp_shelf_mapping = {}

    def get_shelf_name(self, shelf_code: str) -> str:
        for shelf_name, codes in self.shelf_map.items():
            if shelf_code in codes:
                return shelf_name
        return shelf_code

    def get_shelf_code_from_name(self, shelf_name: str) -> Optional[str]:
        codes = self.shelf_map.get(shelf_name, [])
        return codes[0] if codes else None

    def map_order_to_shelf(self, order: Dict) -> Tuple[str, str]:
        shelf_code = order.get('shelf_code', '')
        shelf_name = self.get_shelf_name(shelf_code)
        
        if shelf_code in self.temp_shelf_mapping:
            new_shelf_code = self.temp_shelf_mapping[shelf_code]
            new_shelf_name = self.get_shelf_name(new_shelf_code)
            return new_shelf_code, new_shelf_name
        
        return shelf_code, shelf_name

    def add_temp_mapping(self, original_shelf: str, new_shelf: str):
        self.temp_shelf_mapping[original_shelf] = new_shelf

    def remove_temp_mapping(self, original_shelf: str):
        if original_shelf in self.temp_shelf_mapping:
            del self.temp_shelf_mapping[original_shelf]

    def get_all_shelves(self) -> List[str]:
        return list(self.shelf_map.keys())

    def get_all_shelf_codes(self) -> List[str]:
        codes = []
        for shelf_codes in self.shelf_map.values():
            codes.extend(shelf_codes)
        return codes