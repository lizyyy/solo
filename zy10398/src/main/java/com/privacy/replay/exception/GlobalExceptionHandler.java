package com.privacy.replay.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import javax.validation.ConstraintViolationException;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, Object>> handleBusinessException(BusinessException e) {
        log.warn("Business exception: code={}, message={}", e.getCode(), e.getMessage());
        Map<String, Object> result = new HashMap<>();
        result.put("code", e.getCode());
        result.put("message", e.getMessage());
        result.put("success", false);
        return ResponseEntity.ok(result);
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public ResponseEntity<Map<String, Object>> handleValidationException(Exception e) {
        log.warn("Validation exception: {}", e.getMessage());
        Map<String, Object> result = new HashMap<>();
        result.put("code", ErrorCode.PARAM_ERROR.getCode());
        result.put("message", ErrorCode.PARAM_ERROR.getMessage());
        result.put("success", false);
        return ResponseEntity.ok(result);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException e) {
        log.warn("Constraint violation: {}", e.getMessage());
        Map<String, Object> result = new HashMap<>();
        result.put("code", ErrorCode.PARAM_ERROR.getCode());
        result.put("message", e.getMessage());
        result.put("success", false);
        return ResponseEntity.ok(result);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception e) {
        log.error("Unexpected error", e);
        Map<String, Object> result = new HashMap<>();
        result.put("code", ErrorCode.INTERNAL_ERROR.getCode());
        result.put("message", ErrorCode.INTERNAL_ERROR.getMessage());
        result.put("success", false);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
    }
}
