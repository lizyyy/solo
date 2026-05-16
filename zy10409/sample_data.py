#!/usr/bin/env python3
import json
import sys
from datetime import datetime, timedelta

sys.path.insert(0, '.')

from app import app, db, SuppressionRecord, StateHistory, HitSample, init_db

SAMPLE_SUPPRESSIONS = [
    {
        "rule_id": "R001",
        "rule_name": "SQL注入检测",
        "scanner_type": "semgrep",
        "sample_content": "db.execute(f\"SELECT * FROM users WHERE id = {user_input}\")",
        "file_path": "src/auth/login.py",
        "line_number": 42,
        "reason": "该输入已在上游经过严格校验，为误报",
        "suppressor": "developer_a",
        "expires_days": 90
    },
    {
        "rule_id": "R002",
        "rule_name": "硬编码密钥",
        "scanner_type": "gitleaks",
        "sample_content": "API_KEY = 'test_key_12345'",
        "file_path": "tests/fixtures/config.py",
        "line_number": 15,
        "reason": "测试用例中的假密钥，非生产环境",
        "suppressor": "qa_engineer",
        "expires_days": 180
    },
    {
        "rule_id": "R003",
        "rule_name": "XSS漏洞",
        "scanner_type": "eslint",
        "sample_content": "<div dangerouslySetInnerHTML={{__html: content}} />",
        "file_path": "src/components/Markdown.jsx",
        "line_number": 28,
        "reason": "内容已通过DOMPurify净化",
        "suppressor": "frontend_dev",
        "expires_days": 365
    },
    {
        "rule_id": "R004",
        "rule_name": "命令注入",
        "scanner_type": "bandit",
        "sample_content": "subprocess.run(f'echo {msg}', shell=True)",
        "file_path": "scripts/debug.py",
        "line_number": 12,
        "reason": "仅内部调试脚本，无外部输入风险",
        "suppressor": "devops_b",
        "expires_days": 30
    },
    {
        "rule_id": "R005",
        "rule_name": "敏感数据暴露",
        "scanner_type": "semgrep",
        "sample_content": "print(f'Debug: {user_data}')",
        "file_path": "src/utils/logger.py",
        "line_number": 77,
        "reason": "仅在DEBUG模式输出，生产环境自动禁用",
        "suppressor": "backend_dev",
        "expires_days": 60
    }
]

def generate_idempotency_key(data):
    sorted_data = json.dumps(data, sort_keys=True)
    import hashlib
    return hashlib.sha256(sorted_data.encode()).hexdigest()[:32]

def populate_sample_data():
    init_db()
    
    with app.app_context():
        print("Clearing existing data...")
        db.session.query(StateHistory).delete()
        db.session.query(HitSample).delete()
        db.session.query(SuppressionRecord).delete()
        db.session.commit()
        
        print("Populating sample suppression records...")
        
        for i, data in enumerate(SAMPLE_SUPPRESSIONS):
            record_id = generate_idempotency_key({
                'rule_id': data['rule_id'],
                'sample_content': data['sample_content'],
                'timestamp': datetime.utcnow().isoformat() + str(i)
            })
            
            idempotency_key = generate_idempotency_key({
                'rule_id': data['rule_id'],
                'sample_content': data['sample_content'],
                'suppressor': data['suppressor']
            })
            
            days = data.get('expires_days', 90)
            expires_at = datetime.utcnow() + timedelta(days=days)
            sample_hash = generate_idempotency_key({'content': data['sample_content']})
            
            states = ['pending', 'under_review', 'approved', 'rejected', 'approved']
            state = states[i % len(states)]
            
            conclusions = {
                'approved': 'false_positive',
                'rejected': 'true_positive'
            }
            conclusion = conclusions.get(state)
            
            reviewers = {
                'under_review': 'reviewer_1',
                'approved': 'security_lead',
                'rejected': 'security_lead'
            }
            reviewer = reviewers.get(state)
            
            record = SuppressionRecord(
                id=record_id,
                rule_id=data['rule_id'],
                rule_name=data['rule_name'],
                scanner_type=data['scanner_type'],
                sample_hash=sample_hash,
                sample_content=data['sample_content'],
                file_path=data['file_path'],
                line_number=data['line_number'],
                reason=data['reason'],
                suppressor=data['suppressor'],
                reviewer=reviewer,
                state=state,
                conclusion=conclusion,
                comment="复核完成，按团队标准处理" if conclusion else None,
                expires_at=expires_at,
                idempotency_key=idempotency_key,
                original_request=json.dumps(data)
            )
            
            sample = HitSample(
                suppression_id=record_id,
                sample_hash=sample_hash,
                sample_content=data['sample_content'],
                file_path=data['file_path'],
                line_number=data['line_number'],
                scanner_output=json.dumps({
                    "severity": "HIGH",
                    "confidence": "MEDIUM",
                    "scanner_version": "1.0.0"
                })
            )
            
            history = StateHistory(
                suppression_id=record_id,
                from_state=None,
                to_state='pending',
                transition_reason='Initial creation',
                operator=data['suppressor']
            )
            
            db.session.add(record)
            db.session.add(sample)
            db.session.add(history)
            
            if state != 'pending':
                if state == 'under_review':
                    history2 = StateHistory(
                        suppression_id=record_id,
                        from_state='pending',
                        to_state='under_review',
                        transition_reason='开始复核',
                        operator=reviewer
                    )
                    db.session.add(history2)
                else:
                    history2 = StateHistory(
                        suppression_id=record_id,
                        from_state='pending',
                        to_state='under_review',
                        transition_reason='开始复核',
                        operator=reviewer
                    )
                    history3 = StateHistory(
                        suppression_id=record_id,
                        from_state='under_review',
                        to_state=state,
                        transition_reason=f'复核结论: {conclusion}',
                        operator=reviewer
                    )
                    db.session.add(history2)
                    db.session.add(history3)
            
            db.session.commit()
            print(f"  Created record {i+1}: {data['rule_name']} ({state})")
        
        print("\nSample data populated successfully!")
        print(f"Total suppression records: {SuppressionRecord.query.count()}")
        print(f"Total state history records: {StateHistory.query.count()}")
        print(f"Total hit sample records: {HitSample.query.count()}")

if __name__ == '__main__':
    populate_sample_data()
    print("\nRun 'python app.py' to start the server.")
