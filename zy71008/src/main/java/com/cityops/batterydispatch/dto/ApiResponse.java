package com.cityops.batterydispatch.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
    private int code;
    private String message;
    private T data;
    private String errorType;
    private String detail;

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "成功", data, null, null);
    }

    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(200, "成功", null, null, null);
    }

    public static <T> ApiResponse<T> error(int code, String message, String errorType, String detail) {
        return new ApiResponse<>(code, message, null, errorType, detail);
    }
}
