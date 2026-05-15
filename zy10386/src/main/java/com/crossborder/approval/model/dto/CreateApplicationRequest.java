package com.crossborder.approval.model.dto;

import com.crossborder.approval.model.enums.RegionType;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateApplicationRequest {

    @NotBlank(message = "申请人ID不能为空")
    private String applicantId;

    @NotBlank(message = "申请人姓名不能为空")
    private String applicantName;

    @NotBlank(message = "数据域编码不能为空")
    private String dataDomainCode;

    @NotNull(message = "目标地区不能为空")
    private RegionType targetRegion;

    @NotBlank(message = "访问理由不能为空")
    private String accessReason;

    private LocalDateTime accessStartTime;

    private LocalDateTime accessEndTime;
}
