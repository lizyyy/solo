#!/usr/bin/env python3
"""
USB HID 宏键盘映射冲突预检工具
用于在刷固件前检查 keymap.json、device_caps.yaml 和 app_shortcuts.csv
"""

import argparse
import json
import csv
import os
import re
from typing import Dict, List, Any, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
import yaml


class RiskLevel(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class Conflict:
    level: RiskLevel
    category: str
    description: str
    affected_keys: List[str]
    suggestion: str


@dataclass
class DeviceCaps:
    max_layers: int
    max_keys: int
    max_macro_size: int
    max_total_macros_size: int
    supported_modifiers: List[str]
    supported_special_keys: List[str]


@dataclass
class AppShortcut:
    app_name: str
    action: str
    windows_key: str
    macos_key: str
    context: str


@dataclass
class KeyAction:
    key_code: str
    modifiers: List[str] = field(default_factory=list)
    tap_action: str = ""
    hold_action: str = ""
    macro: List[Dict[str, Any]] = field(default_factory=list)
    layer_toggle: int = -1
    is_hold: bool = False
    is_tap: bool = False


@dataclass
class Layer:
    layer_id: int
    layer_name: str
    keys: Dict[int, KeyAction] = field(default_factory=dict)


class HIDKeymapValidator:
    MODIFIER_KEYS = {
        "LEFT_CTRL": "KC_LCTL",
        "RIGHT_CTRL": "KC_RCTL",
        "LEFT_SHIFT": "KC_LSFT",
        "RIGHT_SHIFT": "KC_RSFT",
        "LEFT_ALT": "KC_LALT",
        "RIGHT_ALT": "KC_RALT",
        "LEFT_GUI": "KC_LGUI",
        "RIGHT_GUI": "KC_RGUI",
    }

    WIN_MAC_MODIFIER_MAP = {
        "KC_LGUI": "KC_LALT",
        "KC_LALT": "KC_LGUI",
        "KC_RGUI": "KC_RALT",
        "KC_RALT": "KC_RGUI",
    }

    def __init__(self):
        self.conflicts: List[Conflict] = []
        self.layers: List[Layer] = []
        self.device_caps: DeviceCaps = None
        self.app_shortcuts: List[AppShortcut] = []
        self.macros: Dict[str, List[Dict[str, Any]]] = {}

    def load_device_caps(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)

            caps = data.get('device_capabilities', {})
            self.device_caps = DeviceCaps(
                max_layers=caps.get('max_layers', 4),
                max_keys=caps.get('max_keys_per_layer', 16),
                max_macro_size=caps.get('max_macro_size_bytes', 256),
                max_total_macros_size=caps.get('max_total_macros_size_bytes', 2048),
                supported_modifiers=caps.get('supported_modifiers', list(self.MODIFIER_KEYS.values())),
                supported_special_keys=caps.get('supported_special_keys', ['KC_ENTER', 'KC_ESC', 'KC_TAB'])
            )
            return True
        except Exception as e:
            self.conflicts.append(Conflict(
                level=RiskLevel.CRITICAL,
                category="文件解析错误",
                description=f"无法加载设备能力文件: {str(e)}",
                affected_keys=[],
                suggestion="请检查 device_caps.yaml 格式是否正确"
            ))
            return False

    def load_keymap(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            layers_data = data.get('layers', [])
            self.macros = data.get('macros', {})

            for layer_data in layers_data:
                layer = Layer(
                    layer_id=layer_data.get('layer_id', 0),
                    layer_name=layer_data.get('layer_name', f'Layer_{layer_data.get("layer_id", 0)}')
                )

                keys_data = layer_data.get('keys', {})
                for key_pos, key_action_data in keys_data.items():
                    pos = int(key_pos) if key_pos.isdigit() else int(re.findall(r'\d+', key_pos)[0])
                    key_action = self._parse_key_action(key_action_data)
                    layer.keys[pos] = key_action

                self.layers.append(layer)

            return True
        except Exception as e:
            self.conflicts.append(Conflict(
                level=RiskLevel.CRITICAL,
                category="文件解析错误",
                description=f"无法加载按键映射文件: {str(e)}",
                affected_keys=[],
                suggestion="请检查 keymap.json 格式是否正确"
            ))
            return False

    def _parse_key_action(self, data: Dict[str, Any]) -> KeyAction:
        action = KeyAction(key_code=data.get('key_code', ''))

        action.modifiers = data.get('modifiers', [])
        action.tap_action = data.get('tap_action', '')
        action.hold_action = data.get('hold_action', '')
        action.layer_toggle = data.get('layer_toggle', -1)
        action.is_hold = data.get('is_hold', False)
        action.is_tap = data.get('is_tap', False)

        macro_ref = data.get('macro_ref', '')
        if macro_ref and macro_ref in self.macros:
            action.macro = self.macros[macro_ref]
        elif 'macro' in data:
            action.macro = data['macro']

        return action

    def load_app_shortcuts(self, filepath: str) -> bool:
        try:
            with open(filepath, 'r', encoding='utf-8', newline='') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    shortcut = AppShortcut(
                        app_name=row.get('app_name', ''),
                        action=row.get('action', ''),
                        windows_key=row.get('windows_key', ''),
                        macos_key=row.get('macos_key', ''),
                        context=row.get('context', '')
                    )
                    self.app_shortcuts.append(shortcut)
            return True
        except Exception as e:
            self.conflicts.append(Conflict(
                level=RiskLevel.HIGH,
                category="文件解析错误",
                description=f"无法加载软件快捷键文件: {str(e)}",
                affected_keys=[],
                suggestion="请检查 app_shortcuts.csv 格式是否正确"
            ))
            return False

    def validate_all(self) -> List[Conflict]:
        self.conflicts = []

        if self.device_caps:
            self._validate_layers_count()
            self._validate_keys_per_layer()
            self._validate_macro_memory()

        if self.layers:
            self._validate_layer_cycles()
            self._validate_macro_cycles()
            self._validate_modifier_conflicts()
            self._validate_duplicate_actions()
            self._validate_cross_os_inconsistency()

        if self.layers and self.app_shortcuts:
            self._validate_app_shortcut_conflicts()

        return self.conflicts

    def _validate_layers_count(self):
        if len(self.layers) > self.device_caps.max_layers:
            self.conflicts.append(Conflict(
                level=RiskLevel.CRITICAL,
                category="设备能力限制",
                description=f"层数超出设备上限: 定义了 {len(self.layers)} 层，但设备最多支持 {self.device_caps.max_layers} 层",
                affected_keys=[],
                suggestion=f"请合并或删除 {len(self.layers) - self.device_caps.max_layers} 层"
            ))

    def _validate_keys_per_layer(self):
        for layer in self.layers:
            if len(layer.keys) > self.device_caps.max_keys:
                self.conflicts.append(Conflict(
                    level=RiskLevel.CRITICAL,
                    category="设备能力限制",
                    description=f"层 '{layer.layer_name}' 按键数超出上限: 定义了 {len(layer.keys)} 个按键，但设备每层最多支持 {self.device_caps.max_keys} 个",
                    affected_keys=[f"{layer.layer_name}"],
                    suggestion=f"请减少该层 {len(layer.keys) - self.device_caps.max_keys} 个按键"
                ))

    def _validate_macro_memory(self):
        total_size = 0
        for macro_name, macro_steps in self.macros.items():
            macro_size = self._calculate_macro_size(macro_steps)
            total_size += macro_size

            if macro_size > self.device_caps.max_macro_size:
                self.conflicts.append(Conflict(
                    level=RiskLevel.HIGH,
                    category="宏内存限制",
                    description=f"宏 '{macro_name}' 大小超出限制: {macro_size} 字节，设备最大单宏 {self.device_caps.max_macro_size} 字节",
                    affected_keys=[macro_name],
                    suggestion="请精简该宏，减少按键序列长度"
                ))

        if total_size > self.device_caps.max_total_macros_size:
            self.conflicts.append(Conflict(
                level=RiskLevel.CRITICAL,
                category="宏内存限制",
                description=f"所有宏总大小超出设备上限: {total_size} 字节，设备最大总宏内存 {self.device_caps.max_total_macros_size} 字节",
                affected_keys=list(self.macros.keys()),
                suggestion=f"需要减少 {total_size - self.device_caps.max_total_macros_size} 字节的宏定义"
            ))

    def _calculate_macro_size(self, macro: List[Dict[str, Any]]) -> int:
        size = 0
        for step in macro:
            action = step.get('action', '')
            if action in ['tap', 'press', 'release']:
                size += 4
            elif action == 'delay':
                size += 8
            elif action == 'text':
                size += len(step.get('text', '')) + 4
        return size

    def _validate_layer_cycles(self):
        layer_deps: Dict[int, Set[int]] = {}
        for layer in self.layers:
            layer_id = layer.layer_id
            layer_deps[layer_id] = set()
            for pos, action in layer.keys.items():
                if action.layer_toggle >= 0:
                    layer_deps[layer_id].add(action.layer_toggle)

        for start_layer in layer_deps:
            visited = set()
            path = []
            if self._has_cycle_dfs(start_layer, layer_deps, visited, path):
                cycle_path = " → ".join(f"Layer_{l}" for l in path + [path[0]])
                self.conflicts.append(Conflict(
                    level=RiskLevel.CRITICAL,
                    category="循环依赖",
                    description=f"检测到层切换循环: {cycle_path}",
                    affected_keys=[f"Layer_{l}" for l in path],
                    suggestion="请检查层切换配置，避免形成循环"
                ))

    def _has_cycle_dfs(self, current: int, deps: Dict[int, Set[int]],
                       visited: Set[int], path: List[int]) -> bool:
        if current in visited:
            return current in path

        visited.add(current)
        path.append(current)

        for neighbor in deps.get(current, set()):
            if self._has_cycle_dfs(neighbor, deps, visited, path):
                return True

        path.pop()
        return False

    def _validate_macro_cycles(self):
        for macro_name, macro_steps in self.macros.items():
            referenced_macros = set()
            for step in macro_steps:
                if step.get('action') == 'macro_call':
                    ref = step.get('macro_ref', '')
                    if ref:
                        referenced_macros.add(ref)

            for ref in referenced_macros:
                if ref == macro_name:
                    self.conflicts.append(Conflict(
                        level=RiskLevel.CRITICAL,
                        category="循环依赖",
                        description=f"宏 '{macro_name}' 直接调用自身，形成无限循环",
                        affected_keys=[macro_name],
                        suggestion="请删除自引用的宏调用"
                    ))
                elif ref in self.macros:
                    ref_macro = self.macros[ref]
                    for step in ref_macro:
                        if step.get('action') == 'macro_call' and step.get('macro_ref') == macro_name:
                            self.conflicts.append(Conflict(
                                level=RiskLevel.CRITICAL,
                                category="循环依赖",
                                description=f"检测到宏调用循环: {macro_name} ↔ {ref}",
                                affected_keys=[macro_name, ref],
                                suggestion="请检查宏调用链，避免形成循环"
                            ))

    def _validate_modifier_conflicts(self):
        for layer in self.layers:
            for pos, action in layer.keys.items():
                for mod in action.modifiers:
                    if mod not in self.MODIFIER_KEYS.values() and mod not in self.device_caps.supported_modifiers:
                        self.conflicts.append(Conflict(
                            level=RiskLevel.MEDIUM,
                            category="修饰键冲突",
                            description=f"层 '{layer.layer_name}' 按键 {pos} 使用了不支持的修饰键: {mod}",
                            affected_keys=[f"{layer.layer_name}[{pos}]"],
                            suggestion=f"使用支持的修饰键: {', '.join(self.device_caps.supported_modifiers)}"
                        ))

    def _validate_duplicate_actions(self):
        for layer in self.layers:
            action_map: Dict[str, List[int]] = {}
            for pos, action in layer.keys.items():
                action_key = self._action_to_key(action)
                if action_key:
                    if action_key in action_map:
                        action_map[action_key].append(pos)
                    else:
                        action_map[action_key] = [pos]

            for action_key, positions in action_map.items():
                if len(positions) > 1:
                    self.conflicts.append(Conflict(
                        level=RiskLevel.LOW,
                        category="重复按键",
                        description=f"层 '{layer.layer_name}' 中多个按键定义了相同行为: 按键 {', '.join(map(str, positions))} 都映射到 {action_key}",
                        affected_keys=[f"{layer.layer_name}[{p}]" for p in positions],
                        suggestion="这可能不是问题，但请确认是否为故意设计"
                    ))

    def _action_to_key(self, action: KeyAction) -> str:
        parts = []
        if action.modifiers:
            parts.append('+'.join(sorted(action.modifiers)))
        if action.key_code:
            parts.append(action.key_code)
        if action.layer_toggle >= 0:
            parts.append(f"TO({action.layer_toggle})")
        if action.macro:
            parts.append("MACRO")
        return '+'.join(parts) if parts else None

    def _validate_app_shortcut_conflicts(self):
        for shortcut in self.app_shortcuts:
            win_keycode = self._shortcut_to_keycode(shortcut.windows_key)
            mac_keycode = self._shortcut_to_keycode(shortcut.macos_key)

            for layer in self.layers:
                for pos, action in layer.keys.items():
                    action_key = self._action_to_display(action)

                    if win_keycode and win_keycode == action_key:
                        self.conflicts.append(Conflict(
                            level=RiskLevel.MEDIUM,
                            category="软件快捷键冲突",
                            description=f"层 '{layer.layer_name}' 按键 {pos} 映射 '{action_key}' 与 {shortcut.app_name} 的 '{shortcut.action}' (Windows) 冲突",
                            affected_keys=[f"{layer.layer_name}[{pos}]", f"{shortcut.app_name}:{shortcut.action}"],
                            suggestion="考虑修改按键映射或选择不同的快捷键"
                        ))

                    if mac_keycode and mac_keycode == action_key:
                        self.conflicts.append(Conflict(
                            level=RiskLevel.MEDIUM,
                            category="软件快捷键冲突",
                            description=f"层 '{layer.layer_name}' 按键 {pos} 映射 '{action_key}' 与 {shortcut.app_name} 的 '{shortcut.action}' (macOS) 冲突",
                            affected_keys=[f"{layer.layer_name}[{pos}]", f"{shortcut.app_name}:{shortcut.action}"],
                            suggestion="考虑修改按键映射或选择不同的快捷键"
                        ))

    def _shortcut_to_keycode(self, shortcut: str) -> str:
        if not shortcut:
            return ''

        parts = shortcut.replace(' ', '').split('+')
        modifiers = []
        key = ''

        for part in parts:
            part_lower = part.lower()
            if part_lower in ['ctrl', 'control']:
                modifiers.append('KC_LCTL')
            elif part_lower in ['shift']:
                modifiers.append('KC_LSFT')
            elif part_lower in ['alt', 'option']:
                modifiers.append('KC_LALT')
            elif part_lower in ['win', 'windows', 'cmd', 'command']:
                modifiers.append('KC_LGUI')
            else:
                key = f"KC_{part.upper()}"

        if modifiers:
            return '+'.join(sorted(modifiers)) + '+' + key if key else '+'.join(sorted(modifiers))
        return key

    def _action_to_display(self, action: KeyAction) -> str:
        parts = []
        if action.modifiers:
            parts.extend(sorted(action.modifiers))
        if action.key_code:
            parts.append(action.key_code)
        return '+'.join(parts)

    def _validate_cross_os_inconsistency(self):
        for layer in self.layers:
            for pos, action in layer.keys.items():
                if not action.modifiers:
                    continue

                has_win_mod = any('KC_LGUI' in m or 'KC_RGUI' in m for m in action.modifiers)
                has_mac_mod = any('KC_LALT' in m or 'KC_RALT' in m for m in action.modifiers)

                if (has_win_mod or has_mac_mod) and not (has_win_mod and has_mac_mod):
                    win_version = self._convert_modifiers_for_os(action.modifiers, 'windows')
                    mac_version = self._convert_modifiers_for_os(action.modifiers, 'macos')

                    if win_version != mac_version:
                        self.conflicts.append(Conflict(
                            level=RiskLevel.HIGH,
                            category="跨系统不一致",
                            description=f"层 '{layer.layer_name}' 按键 {pos} 的修饰键映射在 Windows 和 macOS 上行为不同",
                            affected_keys=[f"{layer.layer_name}[{pos}]"],
                            suggestion=f"Windows版本: {'+'.join(win_version)}, macOS版本: {'+'.join(mac_version)}。考虑使用 OS 切换层或统一修饰键逻辑"
                        ))

    def _convert_modifiers_for_os(self, modifiers: List[str], os_type: str) -> List[str]:
        result = []
        for mod in modifiers:
            if os_type == 'macos' and mod in self.WIN_MAC_MODIFIER_MAP:
                result.append(self.WIN_MAC_MODIFIER_MAP[mod])
            else:
                result.append(mod)
        return sorted(result)

    def generate_compact_keymap(self) -> Dict[str, Any]:
        compact = {
            "device_version": "1.0.0",
            "layers": [],
            "macros": {}
        }

        used_macros = set()
        for layer in self.layers:
            layer_compact = {
                "layer_id": layer.layer_id,
                "layer_name": layer.layer_name,
                "keys": {}
            }

            for pos, action in layer.keys.items():
                key_data = {}
                if action.key_code:
                    key_data["k"] = action.key_code
                if action.modifiers:
                    key_data["m"] = action.modifiers
                if action.layer_toggle >= 0:
                    key_data["lt"] = action.layer_toggle
                if action.is_hold:
                    key_data["h"] = 1
                if action.is_tap:
                    key_data["t"] = 1
                if action.tap_action:
                    key_data["ta"] = action.tap_action
                if action.hold_action:
                    key_data["ha"] = action.hold_action
                if action.macro:
                    macro_hash = self._hash_macro(action.macro)
                    key_data["macro"] = macro_hash
                    used_macros.add(macro_hash)
                    compact["macros"][macro_hash] = action.macro

                if key_data:
                    layer_compact["keys"][str(pos)] = key_data

            compact["layers"].append(layer_compact)

        return compact

    def _hash_macro(self, macro: List[Dict[str, Any]]) -> str:
        import hashlib
        content = json.dumps(macro, sort_keys=True)
        return 'M_' + hashlib.md5(content.encode()).hexdigest()[:8]

    def generate_markdown_report(self, output_path: str = None) -> str:
        lines = [
            "# USB HID 宏键盘映射预检报告",
            "",
            f"**生成时间**: {self._get_timestamp()}",
            "",
            "---",
            "",
        ]

        if self.device_caps:
            lines.extend([
                "## 设备能力",
                "",
                f"| 参数 | 值 |",
                f"|------|-----|",
                f"| 最大层数 | {self.device_caps.max_layers} |",
                f"| 每层最大按键数 | {self.device_caps.max_keys} |",
                f"| 单宏最大字节 | {self.device_caps.max_macro_size} |",
                f"| 总宏最大字节 | {self.device_caps.max_total_macros_size} |",
                f"| 支持的修饰键 | {', '.join(self.device_caps.supported_modifiers)} |",
                "",
            ])

        if self.layers:
            lines.extend([
                "## 按键映射概览",
                "",
                f"**总层数**: {len(self.layers)}",
                "",
            ])

            for layer in self.layers:
                lines.extend([
                    f"### {layer.layer_name} (ID: {layer.layer_id})",
                    "",
                    f"**按键数**: {len(layer.keys)}",
                    "",
                    "| 位置 | 按键码 | 修饰键 | 层切换 | 宏 |",
                    "|------|--------|--------|--------|-----|",
                ])

                for pos in sorted(layer.keys.keys()):
                    action = layer.keys[pos]
                    mods = '+'.join(action.modifiers) if action.modifiers else '-'
                    layer_toggle = f"TO({action.layer_toggle})" if action.layer_toggle >= 0 else '-'
                    has_macro = "是" if action.macro else "否"
                    lines.append(f"| {pos} | {action.key_code or '-'} | {mods} | {layer_toggle} | {has_macro} |")

                lines.append("")

        if self.app_shortcuts:
            lines.extend([
                "## 监测的软件快捷键",
                "",
                f"**共监测 {len(self.app_shortcuts)} 个快捷键**",
                "",
                "| 软件 | 功能 | Windows | macOS | 上下文 |",
                "|------|------|---------|-------|--------|",
            ])

            for shortcut in self.app_shortcuts[:20]:
                lines.append(f"| {shortcut.app_name} | {shortcut.action} | {shortcut.windows_key} | {shortcut.macos_key} | {shortcut.context} |")

            if len(self.app_shortcuts) > 20:
                lines.append(f"| ... | 共 {len(self.app_shortcuts)} 个 | ... | ... | ... |")

            lines.append("")

        lines.extend([
            "## 冲突分析",
            "",
        ])

        if self.conflicts:
            by_level: Dict[str, List[Conflict]] = {}
            for c in self.conflicts:
                level = c.level.value
                if level not in by_level:
                    by_level[level] = []
                by_level[level].append(c)

            for level in [RiskLevel.CRITICAL.value, RiskLevel.HIGH.value,
                         RiskLevel.MEDIUM.value, RiskLevel.LOW.value]:
                if level in by_level:
                    lines.extend([
                        f"### {level} ({len(by_level[level])} 个)",
                        "",
                    ])

                    for i, conflict in enumerate(by_level[level], 1):
                        lines.extend([
                            f"**{i}. {conflict.category}**",
                            "",
                            f"描述: {conflict.description}",
                            "",
                        ])
                        if conflict.affected_keys:
                            lines.append(f"影响: {', '.join(conflict.affected_keys)}")
                            lines.append("")
                        lines.append(f"建议: {conflict.suggestion}")
                        lines.append("")
                        lines.append("---")
                        lines.append("")
        else:
            lines.append("✅ **未检测到任何冲突**")
            lines.append("")

        lines.extend([
            "## 统计摘要",
            "",
            f"| 项目 | 数量 |",
            f"|------|------|",
            f"| 总层数 | {len(self.layers)} |",
            f"| 宏定义数 | {len(self.macros)} |",
            f"| 监测软件快捷键 | {len(self.app_shortcuts)} |",
            f"| **严重冲突** | {sum(1 for c in self.conflicts if c.level == RiskLevel.CRITICAL)} |",
            f"| **高危冲突** | {sum(1 for c in self.conflicts if c.level == RiskLevel.HIGH)} |",
            f"| **中危冲突** | {sum(1 for c in self.conflicts if c.level == RiskLevel.MEDIUM)} |",
            f"| **低危提示** | {sum(1 for c in self.conflicts if c.level == RiskLevel.LOW)} |",
            "",
        ])

        if self.conflicts:
            critical_count = sum(1 for c in self.conflicts if c.level == RiskLevel.CRITICAL)
            high_count = sum(1 for c in self.conflicts if c.level == RiskLevel.HIGH)

            if critical_count > 0:
                lines.append("⚠️ **存在严重冲突，不建议刷入固件！**")
            elif high_count > 0:
                lines.append("⚠️ **存在高危冲突，建议修复后再刷入固件。**")
        else:
            lines.append("✅ **所有检查通过，可以安全刷入固件。**")

        lines.append("")

        report = '\n'.join(lines)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(report)

        return report

    def _get_timestamp(self) -> str:
        from datetime import datetime
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def main():
    parser = argparse.ArgumentParser(
        description='USB HID 宏键盘映射冲突预检工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  # 基础检查
  python hid_keymap_validator.py --keymap keymap.json --caps device_caps.yaml

  # 完整检查（含软件快捷键冲突）
  python hid_keymap_validator.py --keymap keymap.json --caps device_caps.yaml --shortcuts app_shortcuts.csv

  # 输出精简映射包
  python hid_keymap_validator.py --keymap keymap.json --caps device_caps.yaml --output compact_keymap.json

  # 生成 Markdown 报告
  python hid_keymap_validator.py --keymap keymap.json --caps device_caps.yaml --shortcuts app_shortcuts.csv --report validation_report.md

  # 完整流程
  python hid_keymap_validator.py -k keymap.json -c device_caps.yaml -s app_shortcuts.csv -o compact.json -r report.md
        '''
    )

    parser.add_argument('-k', '--keymap', required=True,
                        help='按键映射文件路径 (keymap.json)')
    parser.add_argument('-c', '--caps', required=True,
                        help='设备能力文件路径 (device_caps.yaml)')
    parser.add_argument('-s', '--shortcuts',
                        help='软件快捷键文件路径 (app_shortcuts.csv)')
    parser.add_argument('-o', '--output',
                        help='输出精简映射包的 JSON 文件路径')
    parser.add_argument('-r', '--report',
                        help='输出 Markdown 复核报告的文件路径')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='显示详细输出')

    args = parser.parse_args()

    validator = HIDKeymapValidator()

    print("=" * 60)
    print("  USB HID 宏键盘映射冲突预检工具")
    print("=" * 60)
    print()

    print("[1/5] 加载设备能力配置...")
    if not validator.load_device_caps(args.caps):
        print("❌ 设备能力文件加载失败")
        return 1
    print(f"    ✓ 已加载: 最大层数={validator.device_caps.max_layers}, "
          f"每层按键={validator.device_caps.max_keys}")

    print("[2/5] 加载按键映射...")
    if not validator.load_keymap(args.keymap):
        print("❌ 按键映射文件加载失败")
        return 1
    print(f"    ✓ 已加载: {len(validator.layers)} 层, {len(validator.macros)} 个宏定义")

    if args.shortcuts:
        print("[3/5] 加载软件快捷键...")
        if not validator.load_app_shortcuts(args.shortcuts):
            print("⚠️  软件快捷键文件加载失败，跳过该部分检查")
        else:
            print(f"    ✓ 已加载: {len(validator.app_shortcuts)} 个快捷键定义")
    else:
        print("[3/5] 跳过软件快捷键检查（未提供文件）")

    print("[4/5] 执行冲突检查...")
    conflicts = validator.validate_all()

    critical = sum(1 for c in conflicts if c.level == RiskLevel.CRITICAL)
    high = sum(1 for c in conflicts if c.level == RiskLevel.HIGH)
    medium = sum(1 for c in conflicts if c.level == RiskLevel.MEDIUM)
    low = sum(1 for c in conflicts if c.level == RiskLevel.LOW)

    print(f"    ✓ 检查完成")
    print()
    print("-" * 60)
    print("冲突统计:")
    print(f"  🔴 严重: {critical}")
    print(f"  🟠 高危: {high}")
    print(f"  🟡 中危: {medium}")
    print(f"  🟢 低危: {low}")
    print("-" * 60)
    print()

    if conflicts and args.verbose:
        print("冲突详情:")
        for i, c in enumerate(conflicts, 1):
            level_icon = {
                RiskLevel.CRITICAL: '🔴',
                RiskLevel.HIGH: '🟠',
                RiskLevel.MEDIUM: '🟡',
                RiskLevel.LOW: '🟢',
            }.get(c.level, '⚪')
            print(f"\n{level_icon} [{c.level.value}] {c.category}")
            print(f"   描述: {c.description}")
            if c.affected_keys:
                print(f"   影响: {', '.join(c.affected_keys)}")
            print(f"   建议: {c.suggestion}")

    print()
    if args.output:
        print("[5/5] 生成精简映射包...")
        compact = validator.generate_compact_keymap()
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(compact, f, ensure_ascii=False, indent=2)
        print(f"    ✓ 已写入: {args.output}")

    if args.report:
        print("生成 Markdown 报告...")
        validator.generate_markdown_report(args.report)
        print(f"    ✓ 已写入: {args.report}")

    print()
    print("=" * 60)
    if critical > 0:
        print("❌ 存在严重冲突，不建议刷入固件！")
    elif high > 0:
        print("⚠️  存在高危冲突，建议修复后再刷入。")
    elif medium > 0 or low > 0:
        print("⚠️  存在一些需要注意的问题，请查看报告详情。")
    else:
        print("✅ 所有检查通过，可以安全刷入固件。")
    print("=" * 60)

    return 0 if critical == 0 else 1


if __name__ == '__main__':
    import sys
    sys.exit(main())
