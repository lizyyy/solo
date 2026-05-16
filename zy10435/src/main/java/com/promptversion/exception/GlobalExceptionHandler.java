package com.promptversion.exception;

import com.alibaba.fastjson.JSON;
import com.promptversion.dto.ApiResponse;
import com.promptversion.entity.ExceptionLog;
import com.promptversion.repository.ExceptionLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import javax.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @Autowired
    private ExceptionLogRepository exceptionLogRepository;

    @ExceptionHandler(BusinessException.class)
    public ApiResponse<Void> handleBusinessException(BusinessException e, HttpServletRequest request) {
        saveExceptionLog(e.getOriginalInput(), e.getMessage(), request);
        return ApiResponse.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidationException(MethodArgumentNotValidException e, HttpServletRequest request) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        saveExceptionLog(null, "参数校验失败: " + message, request);
        return ApiResponse.error(400, message);
    }

    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleBindException(BindException e, HttpServletRequest request) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        saveExceptionLog(null, "参数绑定失败: " + message, request);
        return ApiResponse.error(400, message);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleGeneralException(Exception e, HttpServletRequest request) {
        saveExceptionLog(null, "系统异常: " + e.getMessage(), request);
        e.printStackTrace();
        return ApiResponse.error(500, "系统内部错误: " + e.getMessage());
    }

    private void saveExceptionLog(String originalInput, String errorMessage, HttpServletRequest request) {
        try {
            ExceptionLog log = new ExceptionLog();
            log.setOperationType(request.getMethod() + " " + request.getRequestURI());
            if (originalInput == null) {
                Map<String, String[]> paramMap = request.getParameterMap();
                Map<String, Object> params = new HashMap<>();
                for (Map.Entry<String, String[]> entry : paramMap.entrySet()) {
                    if (entry.getValue().length == 1) {
                        params.put(entry.getKey(), entry.getValue()[0]);
                    } else {
                        params.put(entry.getKey(), entry.getValue());
                    }
                }
                log.setOriginalInput(JSON.toJSONString(params));
            } else {
                log.setOriginalInput(originalInput);
            }
            log.setErrorMessage(errorMessage);
            log.setConclusion("异常已记录，待人工处理");
            exceptionLogRepository.save(log);
        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }
}