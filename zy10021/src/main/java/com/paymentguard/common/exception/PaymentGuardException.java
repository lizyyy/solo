package com.paymentguard.common.exception;

import com.paymentguard.common.enums.IssueType;
import lombok.Getter;

@Getter
public class PaymentGuardException extends RuntimeException {
    private final IssueType issueType;
    private final String errorCode;
    private final Object data;

    public PaymentGuardException(IssueType issueType, String message) {
        super(message);
        this.issueType = issueType;
        this.errorCode = issueType.name();
        this.data = null;
    }

    public PaymentGuardException(IssueType issueType, String message, Object data) {
        super(message);
        this.issueType = issueType;
        this.errorCode = issueType.name();
        this.data = data;
    }

    public PaymentGuardException(IssueType issueType, String message, Throwable cause) {
        super(message, cause);
        this.issueType = issueType;
        this.errorCode = issueType.name();
        this.data = null;
    }
}
