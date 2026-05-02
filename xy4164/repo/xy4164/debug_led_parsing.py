#!/usr/bin/env python3
"""调试LED灯谱解析问题"""

import sys
import os
import csv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def debug_led_parsing():
    """调试LED灯谱CSV解析"""
    examples_dir = os.path.join(os.path.dirname(__file__), "examples")
    spectra_path = os.path.join(examples_dir, "led_spectra.csv")
    
    print("=" * 60)
    print("调试LED灯谱CSV解析")
    print("=" * 60)
    print()
    
    print(f"文件路径: {spectra_path}")
    print()
    
    print("[1] 原始文件内容:")
    with open(spectra_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            print(f"  行{i}: {line.strip()}")
    print()
    
    print("[2] CSV DictReader解析:")
    with open(spectra_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        print(f"  列名: {reader.fieldnames}")
        print(f"  列数: {len(reader.fieldnames)}")
        print()
        
        for row_num, row in enumerate(reader, 2):
            print(f"  行{row_num}:")
            for key, value in row.items():
                print(f"    {key}='{value}'")
            print()


def debug_with_validator():
    """使用验证器调试"""
    from lighting_previewer.validators import CSVParser
    
    examples_dir = os.path.join(os.path.dirname(__file__), "examples")
    spectra_path = os.path.join(examples_dir, "led_spectra.csv")
    
    print("=" * 60)
    print("使用CSVParser调试")
    print("=" * 60)
    print()
    
    parser = CSVParser()
    spectra = parser.parse_led_spectra(spectra_path)
    
    print(f"解析到的灯谱数: {len(spectra)}")
    print()
    
    for i, s in enumerate(spectra):
        print(f"灯谱{i}: {s.spectrum_id} - {s.spectrum_name}")
        print(f"  功率: {s.total_power} W")
        print(f"  PPFD: {s.photon_flux_density} μmol/m²/s")
        print(f"  通道数: {len(s.channels)}")
        print(f"  蓝光比例: {s.blue_ratio:.2%}")
        print(f"  红光比例: {s.red_ratio:.2%}")
        print(f"  远红光比例: {s.far_red_ratio:.2%}")
        print(f"  蓝红比: {s.blue_red_ratio:.2f}")
        print()
        
        for j, ch in enumerate(s.channels):
            print(f"    通道{j}: {ch.wavelength_range} ({ch.wavelength_nm}nm)")
            print(f"      强度比例: {ch.intensity_ratio:.2%}")
            print(f"      光子效率: {ch.photon_efficiency} μmol/J")
            print()
    
    if parser.get_last_errors():
        print("错误:")
        for e in parser.get_last_errors():
            print(f"  - {e}")
    
    if parser.get_last_warnings():
        print("警告:")
        for w in parser.get_last_warnings():
            print(f"  - {w}")


if __name__ == "__main__":
    debug_led_parsing()
    debug_with_validator()
