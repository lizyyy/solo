package com.apigate.voting.dto;

import com.apigate.voting.model.ChangeType;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class CreateProposalRequest {
    @NotBlank(message = "提案标题不能为空")
    private String title;

    private String description;

    @NotBlank(message = "API 名称不能为空")
    private String apiName;

    private String apiVersion;

    @NotNull(message = "变更类型不能为空")
    private ChangeType changeType;

    @NotBlank(message = "提交人ID不能为空")
    private String submitterId;

    private Integer votingDurationHours;

    private Integer approveThreshold;

    private List<ImpactItemRequest> impactItems;
}
