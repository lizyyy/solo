package com.example.readonlywindow.exception;

public class ResourceNotFoundException extends BusinessException {
    public ResourceNotFoundException(String resource, String identifier) {
        super("NOT_FOUND", resource + " not found: " + identifier);
    }
}
