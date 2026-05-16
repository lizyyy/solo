package com.dependency.license.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateBatchRequest {
    @NotBlank(message = "批次名称不能为空")
    private String name;

    private String description;

    @NotNull(message = "依赖包ID不能为空")
    private Long packageId;

    private LocalDateTime plannedDate;

    private String riskAssessment;

    private String createdBy;

    @NotNull(message = "仓库列表不能为空")
    private List<Long> repositoryIds;
}