with open('reviewer.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = '''        summary.pending_review = summary.discrepancy_records + (summary.reviewed_records - summary.approved_records - summary.rejected_records - summary.needs_more_info)
        return summary'''

new_code = '''        summary.pending_review = 0
        for record in records:
            if record.verification_status in [
                VerificationStatus.PENDING,
                VerificationStatus.DISCREPANCY,
                VerificationStatus.REVIEWED
            ]:
                summary.pending_review += 1
        return summary'''

content = content.replace(old_code, new_code, 1)

with open('reviewer.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed!')
