package com.riskcontrol.graylist.dto;

import com.riskcontrol.graylist.enums.GraylistStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GraylistRecordDTO {

    private Long id;

    @NotBlank(message = "客户ID不能为空")
    private String customerId;

    @NotBlank(message = "客户名称不能为空")
    private String customerName;

    @NotBlank(message = "名单原因不能为空")
    private String listReason;

    @NotNull(message = "到期时间不能为空")
    private LocalDateTime expireTime;

    private GraylistStatus status;

    private String reviewRemark;

    private String reviewer;

    private LocalDateTime reviewTime;

    private String batchNo;

    private Boolean isExpiredNotReviewed;

    private String nextStepHint;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String createdBy;

    private String updatedBy;
}
