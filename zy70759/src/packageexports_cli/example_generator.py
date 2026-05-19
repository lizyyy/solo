from typing import List

from .models import (
    ExportEntry,
    ImportExample,
    Issue,
    IssueSeverity,
    IssueType,
    ValidationResult,
)


class ExampleGenerator:
    def __init__(self, package_name: str = "package"):
        self.package_name = package_name
        
    def generate_examples(
        self,
        entries: List[ExportEntry],
        file_checks: dict,
    ) -> List[ImportExample]:
        examples: List[ImportExample] = []
        
        for entry in entries:
            if entry.export_path == ".":
                examples.extend(self._generate_root_examples(entry, file_checks))
            elif entry.is_wildcard:
                examples.extend(self._generate_wildcard_examples(entry, file_checks))
            else:
                examples.extend(self._generate_simple_examples(entry, file_checks))
                
        return examples
        
    def _generate_root_examples(
        self,
        entry: ExportEntry,
        file_checks: dict,
    ) -> List[ImportExample]:
        examples: List[ImportExample] = []
        
        if entry.conditions:
            for condition in entry.conditions:
                import_stmt = self._format_import("", condition)
                resolved = entry.target_path
                is_valid = file_checks.get(entry.target_path, False)
                examples.append(ImportExample(
                    import_statement=import_stmt,
                    resolved_path=resolved,
                    is_valid=is_valid,
                    issues=[] if is_valid else [Issue(
                        severity=IssueSeverity.ERROR,
                        issue_type=IssueType.FILE_NOT_FOUND,
                        message=f"Resolved file not found: {resolved}",
                        export_path=".",
                        target_path=resolved,
                    )],
                ))
        else:
            import_stmt = f"import pkg from '{self.package_name}';"
            resolved = entry.target_path
            is_valid = file_checks.get(entry.target_path, False)
            examples.append(ImportExample(
                import_statement=import_stmt,
                resolved_path=resolved,
                is_valid=is_valid,
                issues=[] if is_valid else [Issue(
                    severity=IssueSeverity.ERROR,
                    issue_type=IssueType.FILE_NOT_FOUND,
                    message=f"Resolved file not found: {resolved}",
                    export_path=".",
                    target_path=resolved,
                )],
            ))
            
        return examples
        
    def _generate_simple_examples(
        self,
        entry: ExportEntry,
        file_checks: dict,
    ) -> List[ImportExample]:
        examples: List[ImportExample] = []
        
        export_path = entry.export_path
        if export_path.startswith("./"):
            sub_path = export_path[2:]
        else:
            sub_path = export_path
            
        if entry.conditions:
            for condition in entry.conditions:
                import_stmt = self._format_import(sub_path, condition)
                resolved = entry.target_path
                is_valid = file_checks.get(entry.target_path, False)
                examples.append(ImportExample(
                    import_statement=import_stmt,
                    resolved_path=resolved,
                    is_valid=is_valid,
                    issues=[] if is_valid else [Issue(
                        severity=IssueSeverity.ERROR,
                        issue_type=IssueType.FILE_NOT_FOUND,
                        message=f"Resolved file not found: {resolved}",
                        export_path=export_path,
                        target_path=resolved,
                    )],
                ))
        else:
            import_stmt = f"import sub from '{self.package_name}/{sub_path}';"
            resolved = entry.target_path
            is_valid = file_checks.get(entry.target_path, False)
            examples.append(ImportExample(
                import_statement=import_stmt,
                resolved_path=resolved,
                is_valid=is_valid,
                issues=[] if is_valid else [Issue(
                    severity=IssueSeverity.ERROR,
                    issue_type=IssueType.FILE_NOT_FOUND,
                    message=f"Resolved file not found: {resolved}",
                    export_path=export_path,
                    target_path=resolved,
                )],
            ))
            
        return examples
        
    def _generate_wildcard_examples(
        self,
        entry: ExportEntry,
        file_checks: dict,
    ) -> List[ImportExample]:
        examples: List[ImportExample] = []
        
        export_path = entry.export_path
        if "*" in export_path:
            sample_wildcard = "example"
            sample_import = export_path.replace("*", sample_wildcard)
            if sample_import.startswith("./"):
                sub_path = sample_import[2:]
            else:
                sub_path = sample_import
                
            import_stmt = f"import example from '{self.package_name}/{sub_path}';"
            
            target_sample = entry.target_path.replace("*", sample_wildcard)
            wildcard_entry = file_checks.get(entry.target_path)
            if wildcard_entry is not None:
                is_valid = wildcard_entry
            else:
                is_valid = file_checks.get(target_sample, False)
            
            examples.append(ImportExample(
                import_statement=import_stmt,
                resolved_path=target_sample,
                is_valid=is_valid,
                issues=[] if is_valid else [Issue(
                    severity=IssueSeverity.WARNING,
                    issue_type=IssueType.FILE_NOT_FOUND,
                    message=f"Wildcard resolved file may not exist: {target_sample}",
                    export_path=export_path,
                    target_path=target_sample,
                )],
            ))
            
        return examples
        
    def _format_import(self, sub_path: str, condition: str) -> str:
        condition_comment = f"  // condition: {condition}"
        if sub_path:
            return f"import mod from '{self.package_name}/{sub_path}';{condition_comment}"
        else:
            return f"import pkg from '{self.package_name}';{condition_comment}"


class MissingAnalyzer:
    def analyze_missing(self, result: ValidationResult) -> List[dict]:
        analysis = []
        
        for issue in result.issues:
            if issue.severity == IssueSeverity.ERROR:
                cause = self._determine_cause(issue)
                analysis.append({
                    "issue_type": issue.issue_type,
                    "severity": issue.severity,
                    "message": issue.message,
                    "cause": cause,
                    "suggestion": self._get_suggestion(issue, cause),
                    "export_path": issue.export_path,
                    "target_path": issue.target_path,
                })
                
        return analysis
        
    def _determine_cause(self, issue: Issue) -> str:
        if issue.issue_type == IssueType.FILE_NOT_FOUND:
            if issue.target_path and issue.target_path.startswith("./dist/"):
                return "build_output_missing"
            if issue.target_path and "*" in issue.target_path:
                return "wildcard_no_matches"
            return "file_missing"
            
        if issue.issue_type == IssueType.UNRESOLVABLE_PATH:
            return "no_matching_export_entry"
            
        if issue.issue_type == IssueType.INVALID_JSON:
            return "syntax_error_in_package_json"
            
        if issue.issue_type == IssueType.INVALID_EXPORT_PATTERN:
            return "invalid_export_syntax"
            
        return "unknown"
        
    def _get_suggestion(self, issue: Issue, cause: str) -> str:
        suggestions = {
            "build_output_missing": "Run your build command first (e.g., npm run build)",
            "wildcard_no_matches": "Check that your build output files exist and match the glob pattern",
            "file_missing": "Verify the file path exists in your package, or update exports to point to correct location",
            "no_matching_export_entry": "Add the missing path to exports field, or check for typos in import path",
            "syntax_error_in_package_json": "Fix the JSON syntax error in package.json",
            "invalid_export_syntax": "Review exports format - values should be strings, arrays, or nested condition objects",
        }
        return suggestions.get(cause, "Review exports configuration and file locations")
