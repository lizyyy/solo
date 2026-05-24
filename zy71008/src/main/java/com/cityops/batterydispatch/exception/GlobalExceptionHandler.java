package com.cityops.batterydispatch.exception;

import com.cityops.batterydispatch.dto.ApiResponse;
import com.cityops.batterydispatch.enums.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        log.warn("业务异常: code={}, message={}, detail={}",
            e.getErrorCode().getHttpCode(), e.getMessage(), e.getDetail());

        ErrorCode errorCode = e.getErrorCode();
        String errorType = determineErrorType(errorCode);

        ApiResponse<Void> response = ApiResponse.error(
            errorCode.getHttpCode(),
            errorCode.getMessage(),
            errorType,
            e.getDetail()
        );

        return new ResponseEntity<>(response, HttpStatus.valueOf(errorCode.getHttpCode()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining(", "));

        log.warn("参数校验失败: {}", detail);

        ApiResponse<Void> response = ApiResponse.error(
            ErrorCode.MISSING_REQUIRED_FIELD.getHttpCode(),
            ErrorCode.MISSING_REQUIRED_FIELD.getMessage(),
            "缺材料",
            detail
        );

        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception e) {
        log.error("系统异常", e);

        ApiResponse<Void> response = ApiResponse.error(
            ErrorCode.SYSTEM_ERROR.getHttpCode(),
            ErrorCode.SYSTEM_ERROR.getMessage(),
            "系统错误",
            e.getMessage()
        );

        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private String determineErrorType(ErrorCode errorCode) {
        switch (errorCode) {
            case MISSING_REQUIRED_FIELD:
                return "缺材料";
            case INVALID_STATUS:
            case FORBIDDEN_LOCATION:
            case PHOTO_REQUIRED:
                return "状态不允许";
            case DUPLICATE_REQUEST:
            case BATTERY_ALREADY_DISPATCHED:
                return "重复请求";
            case REVIEW_REQUIRED:
                return "需要复核";
            case RESOURCE_NOT_FOUND:
                return "资源不存在";
            default:
                return "系统错误";
        }
    }
}
