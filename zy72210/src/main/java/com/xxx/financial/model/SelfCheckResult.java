package com.xxx.financial.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.xxx.financial.enums.CheckSeverity;
import com.xxx.financial.enums.SelfCheckItem;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SelfCheckResult {
    private SelfCheckItem checkItem;
    private boolean passed;
    private String message;
    private String detail;
    private CheckSeverity severity;
    private boolean overridden;
    private String overrideReason;

    public SelfCheckResult() {
    }

    public SelfCheckResult(SelfCheckItem checkItem, boolean passed, String message) {
        this.checkItem = checkItem;
        this.passed = passed;
        this.message = message;
        this.severity = checkItem != null ? checkItem.getDefaultSeverity() : CheckSeverity.ERROR;
    }

    public SelfCheckResult(SelfCheckItem checkItem, boolean passed, String message, String detail) {
        this(checkItem, passed, message);
        this.detail = detail;
    }

    public SelfCheckResult(SelfCheckItem checkItem, boolean passed, String message, CheckSeverity severity) {
        this(checkItem, passed, message);
        this.severity = severity;
    }

    public void overrideAsPassed(String reason) {
        this.overridden = true;
        this.passed = true;
        this.overrideReason = reason;
    }

    public boolean isBlockingError() {
        return !passed && !overridden && severity == CheckSeverity.ERROR;
    }

    public SelfCheckItem getCheckItem() {
        return checkItem;
    }

    public void setCheckItem(SelfCheckItem checkItem) {
        this.checkItem = checkItem;
    }

    public boolean isPassed() {
        return passed;
    }

    public void setPassed(boolean passed) {
        this.passed = passed;
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

    public CheckSeverity getSeverity() {
        return severity;
    }

    public void setSeverity(CheckSeverity severity) {
        this.severity = severity;
    }

    public boolean isOverridden() {
        return overridden;
    }

    public void setOverridden(boolean overridden) {
        this.overridden = overridden;
    }

    public String getOverrideReason() {
        return overrideReason;
    }

    public void setOverrideReason(String overrideReason) {
        this.overrideReason = overrideReason;
    }
}
