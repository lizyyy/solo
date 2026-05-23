content = open('/Users/lzy/pro/solo/workspaces/zy70913/app/services/rules_engine.py', 'r').read()

old_code = '''    def evaluate_grievance(self, grievance: Grievance) -> List[RuleResult]:
        results = []
        for rule in self.rules:
            result = rule.evaluate(grievance)
            results.append(result)
        all_passed = all(r.passed for r in results)
        if all_passed:
            grievance.status = GrievanceStatus.APPROVED
        else:
            grievance.status = GrievanceStatus.REJECTED
        self.db.commit()
        return results'''

new_code = '''    def evaluate_grievance(self, grievance: Grievance) -> List[RuleResult]:
        results = []
        for rule in self.rules:
            result = rule.evaluate(grievance)
            results.append(result)
        
        result_map = {r.rule_code: r for r in results}
        
        responsible_result = result_map.get("RULE_002")
        if responsible_result and not responsible_result.passed:
            grievance.status = GrievanceStatus.REJECTED
            self.db.commit()
            return results
        
        overdue_result = result_map.get("RULE_001")
        if overdue_result and not overdue_result.passed:
            days_diff = overdue_result.detail.get("days_diff", 0)
            if days_diff > 45:
                grievance.status = GrievanceStatus.REJECTED
                self.db.commit()
                return results
        
        photo_result = result_map.get("RULE_004")
        compensation_result = result_map.get("RULE_003")
        
        has_pending_issue = False
        if photo_result and not photo_result.passed:
            has_pending_issue = True
        if compensation_result and not compensation_result.passed:
            has_pending_issue = True
        if overdue_result and not overdue_result.passed:
            days_diff = overdue_result.detail.get("days_diff", 0)
            if days_diff <= 45:
                has_pending_issue = True
        
        if has_pending_issue:
            grievance.status = GrievanceStatus.PENDING
        else:
            grievance.status = GrievanceStatus.APPROVED
        
        self.db.commit()
        return results'''

content = content.replace(old_code, new_code)
open('/Users/lzy/pro/solo/workspaces/zy70913/app/services/rules_engine.py', 'w').write(content)
print("Done")
