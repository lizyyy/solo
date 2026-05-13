package com.apigate.voting.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class ImpactItemRequest {
    @NotBlank(message = "影响范围不能为空")
    private String impactScope;

    @NotBlank(message = "影响描述不能为空")
    private String impactDescription;

    private String affectedService;

    private String affectedEndpoint;

    private String compatibilityLevel;
}
