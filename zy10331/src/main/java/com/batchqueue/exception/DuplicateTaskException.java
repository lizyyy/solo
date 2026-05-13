package com.batchqueue.exception;

public class DuplicateTaskException extends RuntimeException {
    public DuplicateTaskException(String message) {
        super(message);
    }
}
