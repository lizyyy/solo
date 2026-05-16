package com.statuspage.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.statuspage.dto.ApiResponse;
import com.statuspage.model.ExceptionLog;
import com.statuspage.repository.ExceptionLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {
    private final ExceptionLogRepository exceptionLogRepository;
    private final ObjectMapper objectMapper;

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<?>> handleBusinessException(BusinessException e, HttpServletRequest request) {
        log.error("业务异常: {} - {}", e.getErrorCode(), e.getMessage());

        try {
            ExceptionLog log = new ExceptionLog();
            log.setOperation(request.getRequestURI());
            log.setErrorCode(e.getErrorCode());
            log.setErrorMessage(e.getMessage());
            log.setOriginalInput(e.getOriginalInput() != null ? objectMapper.writeValueAsString(e.getOriginalInput()) : "无");
            log.setProcessingConclusion("业务异常已处理");
            log.setRequestedBy(request.getHeader("X-User-Id"));
            log.setCreatedAt(LocalDateTime.now());
            exceptionLogRepository.save(log);
        } catch (Exception ex) {
            log.error("记录异常日志失败", ex);
        }

        return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getMessage(), e.getErrorCode()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(MethodArgumentNotValidException e) {
        Map<String, String> errors = new HashMap<>();
        e.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });

        log.error("参数验证失败: {}", errors);

        return ResponseEntity.badRequest()
                .body(ApiResponse.error("参数验证失败", ErrorCode.VALIDATION_ERROR.getCode(), errors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<?>> handleGenericException(Exception e, HttpServletRequest request) {
        log.error("系统异常", e);

        try {
            ExceptionLog log = new ExceptionLog();
            log.setOperation(request.getRequestURI());
            log.setErrorCode(ErrorCode.SYSTEM_ERROR.getCode());
            log.setErrorMessage(e.getMessage());
            log.setOriginalInput("系统内部错误");
            log.setProcessingConclusion("系统异常，已记录");
            log.setRequestedBy(request.getHeader("X-User-Id"));
            log.setCreatedAt(LocalDateTime.now());
            exceptionLogRepository.save(log);
        } catch (Exception ex) {
            log.error("记录异常日志失败", ex);
        }

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("系统内部错误", ErrorCode.SYSTEM_ERROR.getCode()));
    }
}