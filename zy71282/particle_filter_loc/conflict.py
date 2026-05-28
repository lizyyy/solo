def check_conflicts(inputs):
    conflicts = []
    id_registry = {}

    for category in ["maps", "odometry", "observations", "params"]:
        seen_ids = {}
        for item in inputs.get(category, []):
            item_id = item.get("id", "")
            source = item.get("_source_file", "未知文件")

            if item_id in seen_ids:
                prev_source = seen_ids[item_id]
                conflicts.append({
                    "type": "duplicate_id",
                    "category": category,
                    "id": item_id,
                    "source_1": prev_source,
                    "source_2": source,
                    "reason": (
                        f"类别'{category}'中发现重复编号'{item_id}'："
                        f"文件'{prev_source}'与'{source}'均含此编号，"
                        f"后到材料不会覆盖前一版，请确认使用哪一份"
                    )
                })
            else:
                seen_ids[item_id] = source

            if item_id in id_registry:
                prev_cat, prev_source = id_registry[item_id]
                if prev_cat != category:
                    conflicts.append({
                        "type": "cross_category_id",
                        "id": item_id,
                        "category_1": prev_cat,
                        "source_1": prev_source,
                        "category_2": category,
                        "source_2": source,
                        "reason": (
                            f"编号'{item_id}'跨类别重复："
                            f"'{prev_cat}'({prev_source})与'{category}'({source})，"
                            f"建议为不同类别使用不同编号前缀以避免混淆"
                        )
                    })
            else:
                id_registry[item_id] = (category, source)

    for category in ["maps", "odometry", "observations", "params"]:
        items = inputs.get(category, [])
        if len(items) < 2:
            continue
        versions = []
        for item in items:
            v = item.get("version", 1)
            source = item.get("_source_file", "未知文件")
            versions.append((v, source))
        versions.sort(key=lambda x: x[0])
        for i in range(1, len(versions)):
            if versions[i][0] <= versions[i - 1][0]:
                conflicts.append({
                    "type": "late_material",
                    "category": category,
                    "source": versions[i][1],
                    "version": versions[i][0],
                    "earlier_source": versions[i - 1][1],
                    "earlier_version": versions[i - 1][0],
                    "reason": (
                        f"类别'{category}'中文件'{versions[i][1]}'版本号{versions[i][0]}"
                        f"不大于前一份'{versions[i - 1][1]}'的版本号{versions[i - 1][0]}，"
                        f"属于晚到材料且版本号未递增，将保留此前版本不做覆盖"
                    )
                })

    return conflicts
