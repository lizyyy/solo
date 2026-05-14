package com.version.adapter.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(VersionAdapterException.class)
    public ResponseEntity<Map<String, Object>> handleVersionAdapterException(VersionAdapterException ex) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalDateTime.now());
        response.put("errorCode", ex.getErrorCode());
        response.put("message", ex.getMessage());
        response.put("success", false);

        HttpStatus status = determineHttpStatus(ex.getErrorCode());
        return ResponseEntity.status(status).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(MethodArgumentNotValidException ex) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalDateTime.now());
        response.put("errorCode", "VALIDATION_ERROR");
        response.put("success", false);

        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }
        response.put("fieldErrors", fieldErrors);
        response.put("message", "请求参数验证失败");

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        log.error("未处理的异常", ex);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", LocalDateTime.now());
        response.put("errorCode", "INTERNAL_ERROR");
        response.put("message", "服务器内部错误: " + ex.getMessage());
        response.put("success", false);

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    private HttpStatus determineHttpStatus(String errorCode) {
        return switch (errorCode) {
            case "VERSION_NOT_FOUND", "TEMPLATE_NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "VERSION_EXISTS", "TEMPLATE_EXISTS", "MAPPING_EXISTS", "FIELD_MAPPING_EXISTS", "DEFAULT_VALUE_EXISTS" -> HttpStatus.CONFLICT;
            case "NO_TEMPLATE_MAPPING" -> HttpStatus.NOT_IMPLEMENTED;
            default -> HttpStatus.BAD_REQUEST;
        };
    }
}
