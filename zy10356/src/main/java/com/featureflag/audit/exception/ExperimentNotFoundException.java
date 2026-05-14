package com.featureflag.audit.exception;

public class ExperimentNotFoundException extends RuntimeException {
    public ExperimentNotFoundException(String message) {
        super(message);
    }
}
