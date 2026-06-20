with open('app.py','r') as f:
    content = f.read()

# 1. 函数名 conflict_samples -> conflicts
content = content.replace('def conflict_samples():', 'def conflicts():')

# 2. get_batch_info -> get_batch_detail
content = content.replace('get_batch_info(batch_id)', 'get_batch_detail(batch_id)')

# 3. get_batch_history -> []
content = content.replace('ManualReviewRecord.get_batch_history(batch_id)', '[]')

# 4. get_batch_rollback_logs -> get_rollback_logs
content = content.replace('get_batch_rollback_logs(batch_id)', 'get_rollback_logs(batch_id)')

# 5. rollback_batch 参数顺序调整
content = content.replace('rollback_batch(batch_id, rollback_type, operator, reason)', 'rollback_batch(batch_id, rollback_type, reason, operator)')

# 6. url_for conflict_samples -> conflicts
content = content.replace("url_for('conflict_samples')", "url_for('conflicts')")

# 7. resolve_conflict -> update_product_review
content = content.replace("ManualReviewRecord.resolve_conflict(record_id, 'reviewed', operator, reason)", "ManualReviewRecord.update_product_review(record_id, 'reviewed', reason, operator)")
content = content.replace("ManualReviewRecord.resolve_conflict(record_id, 'rejected', operator, reason)", "ManualReviewRecord.update_product_review(record_id, 'rejected', reason, operator)")

# 8. update_record 参数改为 dict
content = content.replace('ManualReviewRecord.update_record(record_id, field, new_value, operator, change_reason)', 'ManualReviewRecord.update_record(record_id, {field: new_value}, operator, change_reason)')

# 9. import_batch 参数
content = content.replace('ManualReviewRecord.import_batch(batch_id, records, operator)', 'ManualReviewRecord.import_batch(batch_id, records, None, operator)')

# 10. conflicts 路由变量名和模板名
content = content.replace('conflicts = ManualReviewRecord.get_conflict_samples()', 'samples = ManualReviewRecord.get_conflict_samples()')
content = content.replace("return render_template('conflict_samples.html', conflicts=conflicts)", "return render_template('conflicts.html', samples=samples)")

with open('app.py','w') as f:
    f.write(content)
print('Done')
