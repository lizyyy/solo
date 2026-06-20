with open('app.py','r') as f:
    content = f.read()

# 1. review_conflict 参数名 record_id -> conflict_id
content = content.replace('/conflict/<int:record_id>/review', '/conflict/<int:conflict_id>/review')
content = content.replace('def review_conflict(record_id):', 'def review_conflict(conflict_id):')
content = content.replace('update_product_review(record_id,', 'update_product_review(conflict_id,')

# 2. conflicts 接收 batch_id
old_line = '    samples = ManualReviewRecord.get_conflict_samples()'
new_line = "    batch_id = request.args.get('batch_id')" + chr(10) + '    samples = ManualReviewRecord.get_conflict_samples(batch_id=batch_id)' + chr(10) + "    batches = ManualReviewRecord.get_batches()"
content = content.replace(old_line, new_line)

old_ret = "return render_template('conflicts.html', samples=samples)"
new_ret = "return render_template('conflicts.html', samples=samples, batches=batches, selected_batch=batch_id)"
content = content.replace(old_ret, new_ret)

with open('app.py','w') as f:
    f.write(content)
print('Done')
