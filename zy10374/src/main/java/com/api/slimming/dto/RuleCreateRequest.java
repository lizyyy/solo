package com.api.slimming.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class RuleCreateRequest {

    @NotBlank(message = "API路径不能为空")
    private String apiPath;

    private String httpMethod;

    private Long apiEndpointId;

    private List<String> excludeFields;

    private List<String> includeFields;

    private String nestedRules;

    private Long clientSceneId;

    private String sceneCode;

    @NotNull(message = "请求幂等ID不能为空")
    private String requestId;

    private String createdBy;

    private String remark;
}
