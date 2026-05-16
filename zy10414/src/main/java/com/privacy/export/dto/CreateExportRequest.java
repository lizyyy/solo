package com.privacy.export.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateExportRequest {

    @NotBlank(message = "用户ID不能为空")
    private String userId;

    private String userName;

    private String userEmail;

    private String userPhone;

    @NotBlank(message = "同意版本不能为空")
    private String consentVersionCode;

    private String consentSignature;

    private LocalDateTime consentTimestamp;

    @NotEmpty(message = "导出范围不能为空")
    private List<ScopeItemRequest> scopeItems;

    @NotBlank(message = "创建人不能为空")
    private String createdBy;

    private String originalInput;
}
