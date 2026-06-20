#!/usr/bin/env python3
import sys

def main():
    with open('drift_system.py', 'r', encoding='utf-8') as f:
        content = f.read()

    marker = '''    @staticmethod
    def get_report_summary_text(report: Dict) -> str:'''

    new_method = '''    @staticmethod
    def get_import_breakdown(batch_id: Optional[int] = None) -> Dict:
        conn = get_db()
        if batch_id:
            batches = conn.execute(
                "SELECT * FROM import_batches WHERE id = ? ORDER BY import_time DESC",
                (batch_id,)
            ).fetchall()
        else:
            batches = conn.execute(
                "SELECT * FROM import_batches ORDER BY import_time DESC LIMIT 10"
            ).fetchall()

        total_new = 0
        total_history_dup = 0
        total_current_dup = 0
        total_file_dup = 0
        batch_details = []

        for b in batches:
            b_dict = dict(b)
            bid = b_dict["id"]
            btype = b_dict.get("batch_type", "")

            new_count = 0
            history_dup_count = 0
            current_dup_count = 0
            file_dup_count = 0

            if btype == "annotator":
                file_hash = b_dict.get("import_hash")
                if file_hash:
                    hash_count = conn.execute(
                        "SELECT COUNT(*) as cnt FROM import_batches WHERE import_hash = ? AND id < ?",
                        (file_hash, bid)
                    ).fetchone()["cnt"]
                    if hash_count > 0:
                        file_dup_count = b_dict.get("record_count", 0)

                annotator_records = conn.execute(
                    "SELECT comment_id, original_line_no FROM annotator_comments WHERE batch_id = ?",
                    (bid,)
                ).fetchall()

                seen_keys = set()
                for ar in annotator_records:
                    key = "{}#{}".format(ar["comment_id"], ar["original_line_no"])
                    if key in seen_keys:
                        current_dup_count += 1
                    seen_keys.add(key)

                    history_exists = conn.execute(
                        "SELECT COUNT(*) as cnt FROM annotator_comments ac "
                        "WHERE ac.comment_id = ? AND ac.original_line_no = ? AND ac.batch_id < ?",
                        (ar["comment_id"], ar["original_line_no"], bid)
                    ).fetchone()["cnt"]

                    if history_exists > 0:
                        history_dup_count += 1
                    else:
                        drift_exists = conn.execute(
                            "SELECT COUNT(*) as cnt FROM sentiment_drift_records sdr "
                            "WHERE sdr.comment_id = ? AND "
                            "(SELECT MIN(batch_id) FROM annotator_comments WHERE comment_id = sdr.comment_id) = ?",
                            (ar["comment_id"], bid)
                        ).fetchone()["cnt"]
                        if drift_exists > 0:
                            new_count += 1

            batch_details.append({
                **b_dict,
                "new_count": new_count,
                "history_dup_count": history_dup_count,
                "current_dup_count": current_dup_count,
                "file_dup_count": file_dup_count,
                "batch_type_label": "标注员留言" if btype == "annotator" else "模型输出" if btype == "model" else btype,
            })

            total_new += new_count
            total_history_dup += history_dup_count
            total_current_dup += current_dup_count
            total_file_dup += file_dup_count

        conn.close()

        return {
            "total_new": total_new,
            "total_history_dup": total_history_dup,
            "total_current_dup": total_current_dup,
            "total_file_dup": total_file_dup,
            "batch_details": batch_details,
            "generated_at": datetime.now().isoformat(),
        }

'''

    if marker in content:
        pos = content.find(marker)
        new_content = content[:pos] + new_method + content[pos:]
        
        with open('drift_system.py', 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("✅ 方法插入成功")
    else:
        print("❌ 找不到标记位置")
        sys.exit(1)

    import ast
    try:
        ast.parse(new_content)
        print("✅ 语法验证通过")
    except SyntaxError as e:
        print(f"❌ 语法错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
