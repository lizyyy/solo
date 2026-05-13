package com.example.readonlywindow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RejectRequest {
    @NotBlank(message = "请求编码不能为空")
    private String requestCode;

    @NotBlank(message = "拒绝原因不能为空")
    private String rejectReason;

    private String rejectedBy;
}
