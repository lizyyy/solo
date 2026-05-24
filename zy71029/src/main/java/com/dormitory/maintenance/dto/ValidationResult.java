package com.dormitory.maintenance.dto;

import java.util.ArrayList;
import java.util.List;

public class ValidationResult {
    private boolean valid = true;
    private List<String> warnings = new ArrayList<>();
    private List<String> errors = new ArrayList<>();
    private String conflictDetail;

    public void addWarning(String warning) {
        this.warnings.add(warning);
    }

    public void addError(String error) {
        this.valid = false;
        this.errors.add(error);
    }

    public boolean hasIssues() {
        return !warnings.isEmpty() || !errors.isEmpty();
    }

    public String getSummary() {
        StringBuilder sb = new StringBuilder();
        if (!errors.isEmpty()) {
            sb.append("错误: ").append(String.join("; ", errors));
        }
        if (!warnings.isEmpty()) {
            if (sb.length() > 0) sb.append(" | ");
            sb.append("警告: ").append(String.join("; ", warnings));
        }
        return sb.toString();
    }

    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }
    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
    public String getConflictDetail() { return conflictDetail; }
    public void setConflictDetail(String conflictDetail) { this.conflictDetail = conflictDetail; }
}
