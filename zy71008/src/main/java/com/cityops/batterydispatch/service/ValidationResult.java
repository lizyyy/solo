package com.cityops.batterydispatch.service;

import com.cityops.batterydispatch.enums.ErrorCode;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ValidationResult {
    private List<ValidationError> errors = new ArrayList<>();
    private List<ValidationWarning> warnings = new ArrayList<>();

    public boolean hasErrors() {
        return !errors.isEmpty();
    }

    public boolean hasWarnings() {
        return !warnings.isEmpty();
    }

    public void addError(ErrorCode errorCode, String message) {
        errors.add(new ValidationError(errorCode, message));
    }

    public void addWarning(ErrorCode errorCode, String message) {
        warnings.add(new ValidationWarning(errorCode, message));
    }

    public void addWarning(int code, String message) {
        warnings.add(new ValidationWarning(code, message));
    }

    public ValidationError getFirstError() {
        return errors.isEmpty() ? null : errors.get(0);
    }

    @Data
    public static class ValidationError {
        private final ErrorCode errorCode;
        private final String message;

        public ValidationError(ErrorCode errorCode, String message) {
            this.errorCode = errorCode;
            this.message = message;
        }
    }

    @Data
    public static class ValidationWarning {
        private ErrorCode errorCode;
        private int code;
        private final String message;

        public ValidationWarning(ErrorCode errorCode, String message) {
            this.errorCode = errorCode;
            this.code = errorCode.getHttpCode();
            this.message = message;
        }

        public ValidationWarning(int code, String message) {
            this.code = code;
            this.message = message;
        }
    }
}
