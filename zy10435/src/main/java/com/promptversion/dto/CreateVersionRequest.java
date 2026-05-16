package com.promptversion.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

@Data
public class CreateVersionRequest {
    @NotNull(message = "模板ID不能为空")
    private Long templateId;
    @NotBlank(message = "版本号不能为空")
    private String versionNumber;
    @NotBlank(message = "版本内容不能为空")
    private String content;
    private BigDecimal trafficPercentage;
    @NotBlank(message = "发布人不能为空")
    private String publishedBy;
    private String remark;
}