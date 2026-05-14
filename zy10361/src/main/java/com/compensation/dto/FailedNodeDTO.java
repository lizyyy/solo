package com.compensation.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class FailedNodeDTO {

    @NotBlank(message = "节点ID不能为空")
    private String nodeId;

    @NotBlank(message = "节点名称不能为空")
    private String nodeName;

    @NotBlank(message = "服务名称不能为空")
    private String serviceName;

    private String errorCode;

    private String errorMessage;

    @NotEmpty(message = "补偿指令列表不能为空")
    @Valid
    private List<CompensationInstructionDTO> instructions;
}
