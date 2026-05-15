package com.schema.approval.dto;

import com.schema.approval.enums.CompatibilityLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TopicCreateRequest {
    @NotBlank(message = "Topic name is required")
    private String topicName;

    private String description;

    @NotNull(message = "Compatibility level is required")
    private CompatibilityLevel compatibilityLevel;

    @NotBlank(message = "Owner team is required")
    private String ownerTeam;

    private String businessDomain;

    @NotBlank(message = "Created by is required")
    private String createdBy;
}
