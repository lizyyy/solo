package com.degrade.drill.dto;

import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FallbackResponseDto {
    @NotNull(message = "HTTP状态码不能为空")
    private Integer httpStatus;

    private String responseBody;

    private String contentType = "application/json";

    private Long delayMs = 0L;
}