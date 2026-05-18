package com.riskcontrol.graylist.exception;

public class NeedManualReviewException extends RuntimeException {
    public NeedManualReviewException(String message) {
        super(message);
    }
}
