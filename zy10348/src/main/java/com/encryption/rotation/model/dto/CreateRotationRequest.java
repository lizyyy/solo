package com.encryption.rotation.model.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CreateRotationRequest {
    @NotBlank(message = "租户ID不能为空")
    private String tenantId;

    @NotBlank(message = "源密钥ID不能为空")
    private String sourceKeyId;

    @NotBlank(message = "目标密钥ID不能为空")
    private String targetKeyId;

    @NotBlank(message = "创建人不能为空")
    private String createdBy;

    private String reason;

    @NotNull(message = "数据标识列表不能为空")
    private List<String> dataIdentifiers;
}
