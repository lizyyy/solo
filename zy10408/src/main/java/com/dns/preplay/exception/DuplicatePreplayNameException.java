package com.dns.preplay.exception;

public class DuplicatePreplayNameException extends RuntimeException {

    public DuplicatePreplayNameException(String name) {
        super("预演名称已存在: " + name);
    }
}
