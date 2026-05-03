# USB HID 宏键盘映射预检报告

**生成时间**: 2026-05-03 16:00:09

---

## 设备能力

| 参数 | 值 |
|------|-----|
| 最大层数 | 4 |
| 每层最大按键数 | 12 |
| 单宏最大字节 | 256 |
| 总宏最大字节 | 2048 |
| 支持的修饰键 | KC_LCTL, KC_RCTL, KC_LSFT, KC_RSFT, KC_LALT, KC_RALT, KC_LGUI, KC_RGUI |

## 按键映射概览

**总层数**: 3

### Base Layer (ID: 0)

**按键数**: 10

| 位置 | 按键码 | 修饰键 | 层切换 | 宏 |
|------|--------|--------|--------|-----|
| 0 | KC_F13 | - | TO(1) | 否 |
| 1 | KC_F14 | - | TO(2) | 否 |
| 2 | KC_MUTE | - | - | 否 |
| 3 | KC_VOLU | - | - | 否 |
| 4 | KC_VOLD | - | - | 否 |
| 5 | KC_MPLY | - | - | 否 |
| 6 | KC_A | KC_LCTL | - | 是 |
| 7 | KC_C | KC_LCTL | - | 是 |
| 8 | KC_V | KC_LCTL | - | 是 |
| 9 | KC_Z | KC_LCTL | - | 是 |

### Media Layer (ID: 1)

**按键数**: 9

| 位置 | 按键码 | 修饰键 | 层切换 | 宏 |
|------|--------|--------|--------|-----|
| 0 | KC_MPRV | - | - | 否 |
| 1 | KC_MNXT | - | - | 否 |
| 2 | KC_MSTP | - | - | 否 |
| 3 | KC_MPLY | - | - | 否 |
| 4 | KC_MUTE | - | - | 否 |
| 5 | KC_VOLU | - | - | 否 |
| 6 | KC_VOLD | - | - | 否 |
| 7 | KC_BRIGHTNESS_UP | - | - | 否 |
| 8 | KC_BRIGHTNESS_DOWN | - | - | 否 |

### Dev Layer (ID: 2)

**按键数**: 9

| 位置 | 按键码 | 修饰键 | 层切换 | 宏 |
|------|--------|--------|--------|-----|
| 0 | KC_F1 | - | - | 否 |
| 1 | KC_S | KC_LCTL | - | 是 |
| 2 | KC_I | KC_LCTL+KC_LSFT | - | 是 |
| 3 | KC_F5 | - | - | 否 |
| 4 | KC_F10 | - | - | 否 |
| 5 | KC_F11 | - | - | 否 |
| 6 | KC_B | KC_LCTL+KC_LSFT | - | 否 |
| 7 | KC_P | KC_LCTL+KC_LSFT | - | 否 |
| 8 | KC_GRAVE | KC_LCTL+KC_LSFT | - | 否 |

## 监测的软件快捷键

**共监测 149 个快捷键**

| 软件 | 功能 | Windows | macOS | 上下文 |
|------|------|---------|-------|--------|
| VS Code | 保存 | Ctrl+S | Cmd+S | 全局 |
| VS Code | 全选 | Ctrl+A | Cmd+A | 全局 |
| VS Code | 复制 | Ctrl+C | Cmd+C | 全局 |
| VS Code | 粘贴 | Ctrl+V | Cmd+V | 全局 |
| VS Code | 撤销 | Ctrl+Z | Cmd+Z | 全局 |
| VS Code | 重做 | Ctrl+Y | Cmd+Shift+Z | 全局 |
| VS Code | 格式化代码 | Ctrl+Shift+I | Option+Shift+F | 编辑器 |
| VS Code | 命令面板 | Ctrl+Shift+P | Cmd+Shift+P | 全局 |
| VS Code | 快速打开文件 | Ctrl+P | Cmd+P | 全局 |
| VS Code | 切换终端 | Ctrl+` | Cmd+` | 全局 |
| VS Code | 添加注释 | Ctrl+/ | Cmd+/ | 编辑器 |
| VS Code | 查找 | Ctrl+F | Cmd+F | 全局 |
| VS Code | 替换 | Ctrl+H | Option+Cmd+F | 全局 |
| VS Code | 查找文件 | Ctrl+Shift+F | Cmd+Shift+F | 全局 |
| Chrome | 新建标签页 | Ctrl+T | Cmd+T | 浏览器 |
| Chrome | 关闭标签页 | Ctrl+W | Cmd+W | 浏览器 |
| Chrome | 重新打开标签页 | Ctrl+Shift+T | Cmd+Shift+T | 浏览器 |
| Chrome | 新建窗口 | Ctrl+N | Cmd+N | 浏览器 |
| Chrome | 隐身窗口 | Ctrl+Shift+N | Cmd+Shift+N | 浏览器 |
| Chrome | 刷新 | Ctrl+R | Cmd+R | 浏览器 |
| ... | 共 149 个 | ... | ... | ... |

## 冲突分析

### MEDIUM (30 个)

**1. 软件快捷键冲突**

描述: 层 'Dev Layer' 按键 1 映射 'KC_LCTL+KC_S' 与 VS Code 的 '保存' (Windows) 冲突

影响: Dev Layer[1], VS Code:保存

建议: 考虑修改按键映射或选择不同的快捷键

---

**2. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 6 映射 'KC_LCTL+KC_A' 与 VS Code 的 '全选' (Windows) 冲突

影响: Base Layer[6], VS Code:全选

建议: 考虑修改按键映射或选择不同的快捷键

---

**3. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 7 映射 'KC_LCTL+KC_C' 与 VS Code 的 '复制' (Windows) 冲突

影响: Base Layer[7], VS Code:复制

建议: 考虑修改按键映射或选择不同的快捷键

---

**4. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 8 映射 'KC_LCTL+KC_V' 与 VS Code 的 '粘贴' (Windows) 冲突

影响: Base Layer[8], VS Code:粘贴

建议: 考虑修改按键映射或选择不同的快捷键

---

**5. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 9 映射 'KC_LCTL+KC_Z' 与 VS Code 的 '撤销' (Windows) 冲突

影响: Base Layer[9], VS Code:撤销

建议: 考虑修改按键映射或选择不同的快捷键

---

**6. 软件快捷键冲突**

描述: 层 'Dev Layer' 按键 2 映射 'KC_LCTL+KC_LSFT+KC_I' 与 VS Code 的 '格式化代码' (Windows) 冲突

影响: Dev Layer[2], VS Code:格式化代码

建议: 考虑修改按键映射或选择不同的快捷键

---

**7. 软件快捷键冲突**

描述: 层 'Dev Layer' 按键 7 映射 'KC_LCTL+KC_LSFT+KC_P' 与 VS Code 的 '命令面板' (Windows) 冲突

影响: Dev Layer[7], VS Code:命令面板

建议: 考虑修改按键映射或选择不同的快捷键

---

**8. 软件快捷键冲突**

描述: 层 'Dev Layer' 按键 5 映射 'KC_F11' 与 Windows 的 '显示桌面' (macOS) 冲突

影响: Dev Layer[5], Windows:显示桌面

建议: 考虑修改按键映射或选择不同的快捷键

---

**9. 软件快捷键冲突**

描述: 层 'Dev Layer' 按键 1 映射 'KC_LCTL+KC_S' 与 Photoshop 的 '保存' (Windows) 冲突

影响: Dev Layer[1], Photoshop:保存

建议: 考虑修改按键映射或选择不同的快捷键

---

**10. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 9 映射 'KC_LCTL+KC_Z' 与 Photoshop 的 '撤销' (Windows) 冲突

影响: Base Layer[9], Photoshop:撤销

建议: 考虑修改按键映射或选择不同的快捷键

---

**11. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 7 映射 'KC_LCTL+KC_C' 与 Photoshop 的 '复制' (Windows) 冲突

影响: Base Layer[7], Photoshop:复制

建议: 考虑修改按键映射或选择不同的快捷键

---

**12. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 8 映射 'KC_LCTL+KC_V' 与 Photoshop 的 '粘贴' (Windows) 冲突

影响: Base Layer[8], Photoshop:粘贴

建议: 考虑修改按键映射或选择不同的快捷键

---

**13. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 6 映射 'KC_LCTL+KC_A' 与 Photoshop 的 '全选' (Windows) 冲突

影响: Base Layer[6], Photoshop:全选

建议: 考虑修改按键映射或选择不同的快捷键

---

**14. 软件快捷键冲突**

描述: 层 'Dev Layer' 按键 2 映射 'KC_LCTL+KC_LSFT+KC_I' 与 Photoshop 的 '反选' (Windows) 冲突

影响: Dev Layer[2], Photoshop:反选

建议: 考虑修改按键映射或选择不同的快捷键

---

**15. 软件快捷键冲突**

描述: 层 'Dev Layer' 按键 1 映射 'KC_LCTL+KC_S' 与 Excel 的 '保存' (Windows) 冲突

影响: Dev Layer[1], Excel:保存

建议: 考虑修改按键映射或选择不同的快捷键

---

**16. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 9 映射 'KC_LCTL+KC_Z' 与 Excel 的 '撤销' (Windows) 冲突

影响: Base Layer[9], Excel:撤销

建议: 考虑修改按键映射或选择不同的快捷键

---

**17. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 7 映射 'KC_LCTL+KC_C' 与 Excel 的 '复制' (Windows) 冲突

影响: Base Layer[7], Excel:复制

建议: 考虑修改按键映射或选择不同的快捷键

---

**18. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 8 映射 'KC_LCTL+KC_V' 与 Excel 的 '粘贴' (Windows) 冲突

影响: Base Layer[8], Excel:粘贴

建议: 考虑修改按键映射或选择不同的快捷键

---

**19. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 6 映射 'KC_LCTL+KC_A' 与 Excel 的 '全选' (Windows) 冲突

影响: Base Layer[6], Excel:全选

建议: 考虑修改按键映射或选择不同的快捷键

---

**20. 软件快捷键冲突**

描述: 层 'Dev Layer' 按键 1 映射 'KC_LCTL+KC_S' 与 Word 的 '保存' (Windows) 冲突

影响: Dev Layer[1], Word:保存

建议: 考虑修改按键映射或选择不同的快捷键

---

**21. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 9 映射 'KC_LCTL+KC_Z' 与 Word 的 '撤销' (Windows) 冲突

影响: Base Layer[9], Word:撤销

建议: 考虑修改按键映射或选择不同的快捷键

---

**22. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 7 映射 'KC_LCTL+KC_C' 与 Word 的 '复制' (Windows) 冲突

影响: Base Layer[7], Word:复制

建议: 考虑修改按键映射或选择不同的快捷键

---

**23. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 8 映射 'KC_LCTL+KC_V' 与 Word 的 '粘贴' (Windows) 冲突

影响: Base Layer[8], Word:粘贴

建议: 考虑修改按键映射或选择不同的快捷键

---

**24. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 6 映射 'KC_LCTL+KC_A' 与 Word 的 '全选' (Windows) 冲突

影响: Base Layer[6], Word:全选

建议: 考虑修改按键映射或选择不同的快捷键

---

**25. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 7 映射 'KC_LCTL+KC_C' 与 Figma 的 '复制' (Windows) 冲突

影响: Base Layer[7], Figma:复制

建议: 考虑修改按键映射或选择不同的快捷键

---

**26. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 8 映射 'KC_LCTL+KC_V' 与 Figma 的 '粘贴' (Windows) 冲突

影响: Base Layer[8], Figma:粘贴

建议: 考虑修改按键映射或选择不同的快捷键

---

**27. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 9 映射 'KC_LCTL+KC_Z' 与 Figma 的 '撤销' (Windows) 冲突

影响: Base Layer[9], Figma:撤销

建议: 考虑修改按键映射或选择不同的快捷键

---

**28. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 6 映射 'KC_LCTL+KC_A' 与 Figma 的 '选择全部' (Windows) 冲突

影响: Base Layer[6], Figma:选择全部

建议: 考虑修改按键映射或选择不同的快捷键

---

**29. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 7 映射 'KC_LCTL+KC_C' 与 Terminal 的 '中断命令' (Windows) 冲突

影响: Base Layer[7], Terminal:中断命令

建议: 考虑修改按键映射或选择不同的快捷键

---

**30. 软件快捷键冲突**

描述: 层 'Base Layer' 按键 7 映射 'KC_LCTL+KC_C' 与 Terminal 的 '中断命令' (macOS) 冲突

影响: Base Layer[7], Terminal:中断命令

建议: 考虑修改按键映射或选择不同的快捷键

---

## 统计摘要

| 项目 | 数量 |
|------|------|
| 总层数 | 3 |
| 宏定义数 | 8 |
| 监测软件快捷键 | 149 |
| **严重冲突** | 0 |
| **高危冲突** | 0 |
| **中危冲突** | 30 |
| **低危提示** | 0 |

