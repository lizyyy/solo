package com.audit.logretention.dto;

import com.audit.logretention.enums.FreezeStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ApiResponse<T> {

    private boolean success;
    private String code;
    private String message;
    private FreezeStatus resultStatus;
    private T data;
    private LocalDateTime timestamp;

    public ApiResponse() {
        this.timestamp = LocalDateTime.now();
    }

    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(true);
        response.setCode("SUCCESS");
        response.setMessage("操作成功");
        response.setData(data);
        return response;
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(true);
        response.setCode("SUCCESS");
        response.setMessage(message);
        response.setData(data);
        return response;
    }

    public static <T> ApiResponse<T> pendingReview(T data, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(true);
        response.setCode("PENDING_REVIEW");
        response.setMessage(message);
        response.setResultStatus(FreezeStatus.PENDING_REVIEW);
        response.setData(data);
        return response;
    }

    public static <T> ApiResponse<T> blocked(T data, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode("BLOCKED");
        response.setMessage(message);
        response.setResultStatus(FreezeStatus.BLOCKED);
        response.setData(data);
        return response;
    }

    public static <T> ApiResponse<T> compensated(T data, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(true);
        response.setCode("COMPENSATED");
        response.setMessage(message);
        response.setResultStatus(FreezeStatus.COMPENSATED);
        response.setData(data);
        return response;
    }

    public static <T> ApiResponse<T> error(String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode("ERROR");
        response.setMessage(message);
        return response;
    }

    public static <T> ApiResponse<T> error(String code, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setCode(code);
        response.setMessage(message);
        return response;
    }
}