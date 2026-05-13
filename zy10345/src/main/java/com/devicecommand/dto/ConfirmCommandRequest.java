package com.devicecommand.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class ConfirmCommandRequest {

    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    @NotBlank(message = "确认结果不能为空")
    private String confirmResult;

    private String resultCode;

    private String resultMessage;

    private String resultDetail;

    private String confirmSource;

    private String handler;
}
