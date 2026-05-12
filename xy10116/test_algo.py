import sys
sys.path.insert(0, '.')

from utils.deduplicator import ResumeDeduplicator
import pandas as pd

df = pd.read_csv('sample_data.csv')

resumes = []
for idx, row in df.iterrows():
    resume = {
        'id': idx + 1,
        'name': str(row['姓名']),
        'phone': str(row['手机']),
        'email': str(row['邮箱']),
        'id_number': str(row['身份证']),
        'birth_date': str(row['出生日期']),
        'school': str(row['学校']),
        'major': str(row['专业']),
        'current_company': str(row['公司']),
        'work_years': str(row['工作年限']),
        'address': str(row['地址']),
    }
    resumes.append(resume)

deduplicator = ResumeDeduplicator()

print('=' * 80)
print('两两对比测试:')
print('=' * 80)

for i in range(len(resumes)):
    for j in range(i + 1, len(resumes)):
        r1, r2 = resumes[i], resumes[j]
        score, fields, reason, rule_risk = deduplicator.calculate_similarity(r1, r2)
        risk = deduplicator.determine_risk_level(score)
        if score >= 30:
            print(f'\n[{r1["name"]}(#{r1["id"]}) vs {r2["name"]}(#{r2["id"]})]')
            print(f'  分数: {score:.1f} | 风险: {risk} | 匹配字段: {fields}')
            print(f'  原因: {reason}')

print('\n' + '=' * 80)
print('检测结果汇总:')
print('=' * 80)
results = deduplicator.detect_duplicates(resumes)
for r in results:
    print(f'#{r["resume_id"]} <-> #{r["matched_resume_id"]}: '
          f'风险={r["risk_level"]}, 分数={r["score"]:.1f}, 标注={r["auto_label"]}')
