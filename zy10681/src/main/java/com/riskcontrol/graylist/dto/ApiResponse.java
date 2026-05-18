package com.riskcontrol.graylist.dto;

import lombok.Data;

@Data
public class ApiResponse<T> {
    private int code;
    private String message;
    private T data;
    private String errorType;
    private String nextStep;

    public ApiResponse() {}

    public ApiResponse(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "操作成功", data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(200, message, data);
    }

    public static <T> ApiResponse<T> badRequest(String message, String errorType) {
        ApiResponse<T> response = new ApiResponse<>(400, message, null);
        response.setErrorType(errorType);
        return response;
    }

    public static <T> ApiResponse<T> badRequest(String message, String errorType, String nextStep) {
        ApiResponse<T> response = badRequest(message, errorType);
        response.setNextStep(nextStep);
        return response;
    }

    public static <T> ApiResponse<T> needManual(String message) {
        ApiResponse<T> response = new ApiResponse<>(450, message, null);
        response.setErrorType("NEED_MANUAL");
        return response;
    }

    public static <T> ApiResponse<T> serverError(String message) {
        return new ApiResponse<>(500, message, null);
    }
}
