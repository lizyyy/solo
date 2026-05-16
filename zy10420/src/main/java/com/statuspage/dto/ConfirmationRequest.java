package com.statuspage.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ConfirmationRequest {
    @NotNull(message = "公告ID不能为空")
    private Long announcementId;

    @NotBlank(message = "订阅方ID不能为空")
    private String subscriberId;

    private String subscriberName;

    private String note;

    private String confirmedBy;
}