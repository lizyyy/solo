package com.example.lock.exception;

import lombok.Getter;

@Getter
public class LockException extends RuntimeException {

    private final int code;
    private final String requestId;

    public LockException(int code, String message) {
        super(message);
        this.code = code;
        this.requestId = null;
    }

    public LockException(int code, String message, String requestId) {
        super(message);
        this.code = code;
        this.requestId = requestId;
    }
}
