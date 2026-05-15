package com.datarepair.approval.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.util.List;

@Data
public class RepairScriptCreateDTO {

    @NotBlank(message = "脚本名称不能为空")
    @Size(max = 200, message = "脚本名称长度不能超过200")
    private String scriptName;

    @NotBlank(message = "脚本类型不能为空")
    private String scriptType;

    @NotBlank(message = "脚本内容不能为空")
    private String scriptContent;

    private String rollbackScript;

    @Size(max = 500, message = "描述长度不能超过500")
    private String description;

    @NotBlank(message = "业务系统不能为空")
    private String businessSystem;

    @NotBlank(message = "数据库名称不能为空")
    private String databaseName;

    private String estimatedImpact;

    private String applicant;

    private String applicantDept;

    @Size(max = 500, message = "备注长度不能超过500")
    private String remark;

    private List<TargetScopeDTO> targetScopes;

    @NotBlank(message = "请求ID不能为空（用于幂等性校验）")
    private String requestId;
}
