package com.xxx.financial.model;

import com.xxx.financial.enums.SelfCheckItem;

public class SelfCheckResult {
    private SelfCheckItem checkItem;
    private boolean passed;
    private String message;
    private String detail;

    public SelfCheckResult() {
    }

    public SelfCheckResult(SelfCheckItem checkItem, boolean passed, String message) {
        this.checkItem = checkItem;
        this.passed = passed;
        this.message = message;
    }

    public SelfCheckResult(SelfCheckItem checkItem, boolean passed, String message, String detail) {
        this.checkItem = checkItem;
        this.passed = passed;
        this.message = message;
        this.detail = detail;
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
}
