package com.api.slimming.dto;

import lombok.Data;

@Data
public class ApiResult<T> {

    private Integer code;

    private String message;

    private T data;

    private String requestId;

    private Long timestamp;

    public ApiResult() {
        this.timestamp = System.currentTimeMillis();
    }

    public ApiResult(Integer code, String message, T data) {
        this();
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResult<T> success(T data) {
        return new ApiResult<>(200, "success", data);
    }

    public static <T> ApiResult<T> success() {
        return success(null);
    }

    public static <T> ApiResult<T> fail(Integer code, String message) {
        return new ApiResult<>(code, message, null);
    }

    public static <T> ApiResult<T> fail(String message) {
        return fail(500, message);
    }

    public ApiResult<T> requestId(String requestId) {
        this.requestId = requestId;
        return this;
    }
}
