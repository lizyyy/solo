package com.lineage.exception;

import lombok.Getter;

@Getter
public class LineageException extends RuntimeException {

    private final String code;

    public LineageException(String code, String message) {
        super(message);
        this.code = code;
    }

    public LineageException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }
}
