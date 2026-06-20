import re

with open('src/pages/HistoryPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 添加 CanopyRecord 导入
content = content.replace(
    "import { STATUS_LABELS } from '@/types';\nimport { HistoryRecord } from '@/types';",
    "import { STATUS_LABELS, HistoryRecord, CanopyRecord } from '@/types';"
)

# 2. 在 map 内添加 currentValue 和 canRollback
old_block = "const isLatest = idx === 0;\n                  const isRollback = isRollbackReason(h.changeReason);\n                  const chain = isRollback ? getRollbackChain(h.id) : [];"

new_block = "const isLatest = idx === 0;\n                  const isRollback = isRollbackReason(h.changeReason);\n                  const chain = isRollback ? getRollbackChain(h.id) : [];\n                  const currentValue = String(record[h.fieldName as keyof CanopyRecord] ?? '');"
new_block += "\n                  const canRollback = currentValue === h.newValue && h.oldValue !== h.newValue;"

content = content.replace(old_block, new_block)

# 3. 把 !isLatest 改成 canRollback
content = content.replace("{!isLatest && (", "{canRollback && (")

with open('src/pages/HistoryPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('HistoryPage.tsx 修复完成')
