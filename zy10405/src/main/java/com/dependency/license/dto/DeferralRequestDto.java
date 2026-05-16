package com.dependency.license.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class DeferralRequestDto {
    @NotNull(message = "申请日期不能为空")
    private LocalDateTime requestedDate;

    @NotBlank(message = "延期原因不能为空")
    private String reason;

    @NotBlank(message = "申请人不能为空")
    private String requestedBy;

    private String justification;
}