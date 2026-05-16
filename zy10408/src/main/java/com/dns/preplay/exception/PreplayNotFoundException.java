package com.dns.preplay.exception;

public class PreplayNotFoundException extends RuntimeException {

    public PreplayNotFoundException(Long id) {
        super("DNS预演记录不存在: " + id);
    }

    public PreplayNotFoundException(String name) {
        super("DNS预演记录不存在: " + name);
    }
}
