package com.account.freeze.dto;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Data
public class SmsItemDTO {

    @NotBlank(message = "账号不能为空")
    private String accountNo;

    private String accountName;

    private String phone;

    private String smsContent;

    private LocalDateTime smsSendTime;

    private String remark;
}
