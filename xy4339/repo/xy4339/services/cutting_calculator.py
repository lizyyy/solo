import math
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
from enum import Enum

class GrainDirection(Enum):
    SHORT = 'short'
    LONG = 'long'
    ANY = 'any'

@dataclass
class LayoutResult:
    cols: int
    rows: int
    total_per_sheet: int
    piece_width: float
    piece_height: float
    sheet_width: float
    sheet_height: float
    horizontal_gap: float = 0
    vertical_gap: float = 0
    left_margin: float = 0
    right_margin: float = 0
    top_margin: float = 0
    bottom_margin: float = 0
    is_rotated: bool = False
    efficiency: float = 0.0
    waste_area: float = 0.0
    waste_percent: float = 0.0
    
    @property
    def used_area(self) -> float:
        return self.total_per_sheet * self.piece_width * self.piece_height
    
    @property
    def sheet_area(self) -> float:
        return self.sheet_width * self.sheet_height
    
    def calculate_efficiency(self) -> float:
        if self.sheet_area == 0:
            return 0.0
        self.efficiency = self.used_area / self.sheet_area
        self.waste_area = self.sheet_area - self.used_area
        self.waste_percent = 1.0 - self.efficiency
        return self.efficiency

class CuttingCalculator:
    DEFAULT_CUTTING_LOSS = 3.0
    DEFAULT_MARGIN = 10.0
    
    def __init__(self, cutting_loss: float = None, margin: float = None):
        self.cutting_loss = cutting_loss if cutting_loss is not None else self.DEFAULT_CUTTING_LOSS
        self.margin = margin if margin is not None else self.DEFAULT_MARGIN
    
    def calculate_layouts(
        self,
        sheet_width: float,
        sheet_height: float,
        piece_width: float,
        piece_height: float,
        grain_direction: str = 'any',
        margin: Optional[float] = None,
        cutting_loss: Optional[float] = None,
        consider_rotation: bool = True
    ) -> List[LayoutResult]:
        effective_margin = margin if margin is not None else self.margin
        effective_cutting_loss = cutting_loss if cutting_loss is not None else self.cutting_loss
        
        effective_piece_width = piece_width + effective_cutting_loss
        effective_piece_height = piece_height + effective_cutting_loss
        
        available_width = sheet_width - (2 * effective_margin)
        available_height = sheet_height - (2 * effective_margin)
        
        layouts = []
        
        if grain_direction in ['any', 'short']:
            layout = self._calculate_single_layout(
                available_width, available_height,
                effective_piece_width, effective_piece_height,
                sheet_width, sheet_height,
                piece_width, piece_height,
                effective_margin, effective_cutting_loss,
                is_rotated=False
            )
            if layout.total_per_sheet > 0:
                layouts.append(layout)
        
        if consider_rotation and grain_direction in ['any', 'long']:
            if piece_width != piece_height:
                layout = self._calculate_single_layout(
                    available_width, available_height,
                    effective_piece_height, effective_piece_width,
                    sheet_width, sheet_height,
                    piece_height, piece_width,
                    effective_margin, effective_cutting_loss,
                    is_rotated=True
                )
                if layout.total_per_sheet > 0:
                    layouts.append(layout)
        
        layouts.sort(key=lambda x: (-x.total_per_sheet, -x.efficiency))
        
        return layouts
    
    def _calculate_single_layout(
        self,
        available_width: float,
        available_height: float,
        effective_piece_w: float,
        effective_piece_h: float,
        sheet_width: float,
        sheet_height: float,
        original_piece_w: float,
        original_piece_h: float,
        margin: float,
        cutting_loss: float,
        is_rotated: bool
    ) -> LayoutResult:
        cols = int(math.floor(available_width / effective_piece_w))
        rows = int(math.floor(available_height / effective_piece_h))
        
        total_per_sheet = cols * rows
        
        if cols == 0 or rows == 0:
            return LayoutResult(
                cols=cols, rows=rows, total_per_sheet=0,
                piece_width=original_piece_w, piece_height=original_piece_h,
                sheet_width=sheet_width, sheet_height=sheet_height,
                is_rotated=is_rotated
            )
        
        total_effective_width = cols * effective_piece_w
        total_effective_height = rows * effective_piece_h
        
        remaining_width = available_width - total_effective_width
        remaining_height = available_height - total_effective_height
        
        left_margin = margin + remaining_width / 2
        right_margin = margin + remaining_width / 2
        top_margin = margin + remaining_height / 2
        bottom_margin = margin + remaining_height / 2
        
        layout = LayoutResult(
            cols=cols,
            rows=rows,
            total_per_sheet=total_per_sheet,
            piece_width=original_piece_w,
            piece_height=original_piece_h,
            sheet_width=sheet_width,
            sheet_height=sheet_height,
            horizontal_gap=cutting_loss,
            vertical_gap=cutting_loss,
            left_margin=left_margin,
            right_margin=right_margin,
            top_margin=top_margin,
            bottom_margin=bottom_margin,
            is_rotated=is_rotated
        )
        
        layout.calculate_efficiency()
        
        return layout
    
    def find_best_layout(
        self,
        sheet_width: float,
        sheet_height: float,
        piece_width: float,
        piece_height: float,
        grain_direction: str = 'any',
        margin: Optional[float] = None,
        cutting_loss: Optional[float] = None
    ) -> Optional[LayoutResult]:
        layouts = self.calculate_layouts(
            sheet_width, sheet_height,
            piece_width, piece_height,
            grain_direction, margin, cutting_loss
        )
        
        if layouts:
            return layouts[0]
        return None
    
    def calculate_sheets_needed(
        self,
        total_pieces: int,
        pieces_per_sheet: int,
        wastage_rate: float = 0.03
    ) -> Dict:
        if pieces_per_sheet <= 0:
            raise ValueError("pieces_per_sheet must be greater than 0")
        
        base_sheets = math.ceil(total_pieces / pieces_per_sheet)
        
        wastage_sheets = math.ceil(base_sheets * wastage_rate)
        
        total_sheets = base_sheets + wastage_sheets
        
        actual_pieces = total_sheets * pieces_per_sheet
        extra_pieces = actual_pieces - total_pieces
        
        return {
            'base_sheets': base_sheets,
            'wastage_sheets': wastage_sheets,
            'total_sheets': total_sheets,
            'actual_pieces': actual_pieces,
            'extra_pieces': extra_pieces,
            'wastage_rate_used': wastage_rate
        }
    
    def calculate_all(
        self,
        sheet_width: float,
        sheet_height: float,
        piece_width: float,
        piece_height: float,
        total_pieces: int,
        grain_direction: str = 'any',
        margin: Optional[float] = None,
        cutting_loss: Optional[float] = None,
        wastage_rate: float = 0.03
    ) -> Dict:
        best_layout = self.find_best_layout(
            sheet_width, sheet_height,
            piece_width, piece_height,
            grain_direction, margin, cutting_loss
        )
        
        if not best_layout:
            return {
                'success': False,
                'error': '无法在该规格纸张上布局成品'
            }
        
        sheets_calc = self.calculate_sheets_needed(
            total_pieces,
            best_layout.total_per_sheet,
            wastage_rate
        )
        
        all_layouts = self.calculate_layouts(
            sheet_width, sheet_height,
            piece_width, piece_height,
            grain_direction, margin, cutting_loss
        )
        
        return {
            'success': True,
            'best_layout': best_layout,
            'all_layouts': all_layouts,
            'sheets_calculation': sheets_calc,
            'piece_size': {
                'width': piece_width,
                'height': piece_height
            },
            'sheet_size': {
                'width': sheet_width,
                'height': sheet_height
            },
            'total_pieces_needed': total_pieces,
            'grain_direction': grain_direction
        }
    
    @staticmethod
    def get_open_format_name(cols: int, rows: int) -> str:
        total = cols * rows
        if total <= 0:
            return '无效'
        return f'{total}开'
    
    @staticmethod
    def format_efficiency(efficiency: float) -> str:
        return f'{efficiency * 100:.1f}%'
    
    @staticmethod
    def format_waste_percent(waste_percent: float) -> str:
        return f'{waste_percent * 100:.1f}%'
