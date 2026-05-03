import csv
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional
import yaml

from .models import (
    Order, Press, PressFormat, PaperStock, CutRules, WastageRules,
    Configuration, ColorMode
)
from .units import Dimension, Size


def load_orders(file_path: Path) -> List[Order]:
    orders = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                due_date = datetime.strptime(row['due_date'], '%Y-%m-%d').date()
            except ValueError:
                raise ValueError(f"无法解析日期: {row['due_date']}，格式应为 YYYY-MM-DD")
            
            color_mode = ColorMode.COLOR
            if row['color_mode'] == '单色':
                color_mode = ColorMode.MONO
            elif row['color_mode'] == '专色':
                color_mode = ColorMode.SPOT
            
            order = Order(
                order_id=row['order_id'],
                product_name=row['product_name'],
                finished_size=Size.parse(row['width'], row['height']),
                bleed=Dimension.parse(row['bleed']),
                quantity=int(row['quantity']),
                due_date=due_date,
                paper_type=row['paper_type'],
                color_mode=color_mode
            )
            orders.append(order)
    return orders


def load_presses(file_path: Path) -> Dict[str, Press]:
    presses = {}
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    for press_data in data.get('presses', []):
        formats = []
        for fmt in press_data.get('formats', []):
            formats.append(PressFormat(
                name=fmt['name'],
                size=Size.parse(fmt['width'], fmt['height'])
            ))
        
        press = Press(
            name=press_data['name'],
            max_size=Size.parse(press_data['max_width'], press_data['max_height']),
            min_size=Size.parse(press_data['min_width'], press_data['min_height']),
            color_capacity=press_data['color_capacity'],
            formats=formats,
            default_formats=press_data.get('default_formats', []),
            wastage_base=press_data.get('wastage_base', 50),
            wastage_per_run=press_data.get('wastage_per_run', 20)
        )
        presses[press.name] = press
    
    return presses


def load_paper_stock(file_path: Path) -> List[PaperStock]:
    stock = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            stock.append(PaperStock(
                paper_type=row['paper_type'],
                size=Size.parse(row['width'], row['height']),
                stock_quantity=int(row['stock_quantity']),
                price_per_sheet=float(row['price_per_sheet'])
            ))
    return stock


def load_cut_rules(file_path: Path) -> CutRules:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    cut_rules_data = data.get('cut_rules', {})
    default_gutter = cut_rules_data.get('default_gutter', {})
    min_margin = cut_rules_data.get('minimum_margin', {})
    
    return CutRules(
        default_gutter_horizontal=Dimension.parse(default_gutter.get('horizontal', '10mm')),
        default_gutter_vertical=Dimension.parse(default_gutter.get('vertical', '10mm')),
        minimum_margin_top=Dimension.parse(min_margin.get('top', '15mm')),
        minimum_margin_bottom=Dimension.parse(min_margin.get('bottom', '15mm')),
        minimum_margin_left=Dimension.parse(min_margin.get('left', '15mm')),
        minimum_margin_right=Dimension.parse(min_margin.get('right', '15mm')),
        grip_margin=Dimension.parse(cut_rules_data.get('grip_margin', '10mm')),
        tail_margin=Dimension.parse(cut_rules_data.get('tail_margin', '5mm'))
    )


def load_wastage_rules(file_path: Path) -> WastageRules:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    wastage_data = data.get('wastage_rules', {})
    
    return WastageRules(
        base_wastage_per_run=wastage_data.get('base_wastage_per_run', 50),
        additional_wastage_per_10k=wastage_data.get('additional_wastage_per_10k', 10),
        minimum_wastage=wastage_data.get('minimum_wastage', 30),
        maximum_wastage_percent=wastage_data.get('maximum_wastage_percent', 5.0)
    )


def load_configuration(
    orders_path: Optional[Path] = None,
    presses_path: Optional[Path] = None,
    paper_stock_path: Optional[Path] = None,
    cut_rules_path: Optional[Path] = None
) -> Configuration:
    config = Configuration()
    
    if presses_path and presses_path.exists():
        config.presses = load_presses(presses_path)
    
    if paper_stock_path and paper_stock_path.exists():
        config.paper_stock = load_paper_stock(paper_stock_path)
    
    if cut_rules_path and cut_rules_path.exists():
        config.cut_rules = load_cut_rules(cut_rules_path)
        config.wastage_rules = load_wastage_rules(cut_rules_path)
    
    return config
