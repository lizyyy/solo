package com.xxx.financial.model;

import com.xxx.financial.enums.CheckSeverity;
import com.xxx.financial.enums.SelfCheckItem;
import com.fasterxml.jackson.annotation.JsonIgnore;

public class SelfCheckResult {
    private SelfCheckItem checkItem;
    private CheckSeverity severity;
    private boolean passed;
    private boolean resolved;
    private String resolutionRemark;
    private String message;
    private String detail;

    public SelfCheckResult() {
        this.resolved = false;
    }

    public SelfCheckResult(SelfCheckItem checkItem, CheckSeverity severity, boolean passed, String message) {
        this.checkItem = checkItem;
        this.severity = severity;
        this.passed = passed;
        this.message = message;
        this.resolved = false;
    }

    public SelfCheckResult(SelfCheckItem checkItem, CheckSeverity severity, boolean passed, String message, String detail) {
        this.checkItem = checkItem;
        this.severity = severity;
        this.passed = passed;
        this.message = message;
        this.detail = detail;
        this.resolved = false;
    }

    public String getCheckItemName() {
        return checkItem != null ? checkItem.name() : null;
    }

    public String getCheckItemDescription() {
        return checkItem != null ? checkItem.getDescription() : null;
    }

    public String getSeverityName() {
        return severity != null ? severity.name() : null;
    }

    public String getSeverityDescription() {
        return severity != null ? severity.getDescription() : null;
    }

    public void markResolved(String remark) {
        this.resolved = true;
        this.resolutionRemark = remark;
    }

    @JsonIgnore
    public SelfCheckItem getCheckItem() {
        return checkItem;
    }

    public void setCheckItem(SelfCheckItem checkItem) {
        this.checkItem = checkItem;
    }

    @JsonIgnore
    public CheckSeverity getSeverity() {
        return severity;
    }

    public void setSeverity(CheckSeverity severity) {
        this.severity = severity;
    }

    public boolean isPassed() {
        return passed;
    }

    public void setPassed(boolean passed) {
        this.passed = passed;
    }

    public boolean isResolved() {
        return resolved;
    }

    public void setResolved(boolean resolved) {
        this.resolved = resolved;
    }

    public String getResolutionRemark() {
        return resolutionRemark;
    }

    public void setResolutionRemark(String resolutionRemark) {
        this.resolutionRemark = resolutionRemark;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }

    public boolean isBlocking() {
        if (passed) {
            return false;
        }
        if (CheckSeverity.WARN.equals(severity) && resolved) {
            return false;
        }
        return true;
    }
}
