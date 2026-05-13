package com.example.readonlywindow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApproveRequest {
    @NotBlank(message = "请求编码不能为空")
    private String requestCode;

    private String approvedBy;

    private String notes;
}
