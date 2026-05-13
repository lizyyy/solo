package com.evidence.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ApiModel("API统一响应")
public class ApiResponse<T> {

    @ApiModelProperty(value = "响应码", example = "0000")
    private String code;

    @ApiModelProperty(value = "响应消息", example = "成功")
    private String message;

    @ApiModelProperty(value = "响应数据")
    private T data;

    @ApiModelProperty(value = "响应时间")
    private LocalDateTime timestamp;

    @ApiModelProperty(value = "请求ID", example = "REQ-7a1f9b2e-8c3d-4e5f-9a0b-1c2d3e4f5a6b")
    private String requestId;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .code("0000")
                .message("成功")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> success(String requestId, T data) {
        return ApiResponse.<T>builder()
                .code("0000")
                .message("成功")
                .data(data)
                .timestamp(LocalDateTime.now())
                .requestId(requestId)
                .build();
    }

    public static <T> ApiResponse<T> error(String code, String message) {
        return ApiResponse.<T>builder()
                .code(code)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> error(String requestId, String code, String message) {
        return ApiResponse.<T>builder()
                .code(code)
                .message(message)
                .timestamp(LocalDateTime.now())
                .requestId(requestId)
                .build();
    }

    public static <T> ApiResponse<T> idempotent(T data) {
        return ApiResponse.<T>builder()
                .code("0001")
                .message("幂等返回-重复请求")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
