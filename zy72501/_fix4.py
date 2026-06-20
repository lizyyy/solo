with open("src/models.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# 找到第440-449行的函数，在 saveStore(store); 前面插入更新逻辑
insert_before = "  saveStore(store);\n"
insert_lines = [
    "  \n",
    "  // 更新最新的 exportResult 中的 phoneIssuesSummary\n",
    "  if (store.exportResults.length > 0) {\n",
    "    const latestExport = store.exportResults[store.exportResults.length - 1];\n",
    "    const allIssues = store.phoneMaskIssues;\n",
    "    const pending = allIssues.filter(i => i.status === 'pending_review').length;\n",
    "    const confirmed = allIssues.filter(i => i.status === 'confirmed').length;\n",
    "    const items = allIssues.map(p => ({\n",
    "      phone: p.phoneNumber,\n",
    "      fieldName: p.rawMaterialSnapshot ? p.rawMaterialSnapshot.fieldName : null,\n",
    "      source: p.sourceType,\n",
    "      sourceId: p.sourceId,\n",
    "      sourceName: p.sourceName,\n",
    "      status: p.status,\n",
    "      context: p.rawMaterialSnapshot ? p.rawMaterialSnapshot.context : null,\n",
    "      traceId: p.traceId,\n",
    "      reviewedBy: p.reviewedBy,\n",
    "      reviewNote: p.reviewNote\n",
    "    }));\n",
    "    latestExport.phoneIssuesSummary = { pending, confirmed, items };\n",
    "  }\n",
]

for i, line in enumerate(lines):
    if line == insert_before and i > 440 and i < 450:
        for j, il in enumerate(insert_lines):
            lines.insert(i + j, il)
        break

with open("src/models.js", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("done")
