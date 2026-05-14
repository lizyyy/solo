package com.compensation.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class CreateCompensationRequest {

    @NotBlank(message = "业务流程ID不能为空")
    private String processId;

    @NotBlank(message = "业务流程名称不能为空")
    private String processName;

    @NotBlank(message = "服务名称不能为空")
    private String serviceName;

    @NotNull(message = "总节点数不能为空")
    private Integer totalNodes;

    @NotEmpty(message = "失败节点列表不能为空")
    @Valid
    private List<FailedNodeDTO> failedNodes;
}
