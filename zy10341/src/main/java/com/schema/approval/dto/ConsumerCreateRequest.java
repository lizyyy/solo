package com.schema.approval.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConsumerCreateRequest {
    @NotBlank(message = "Topic name is required")
    private String topicName;

    @NotBlank(message = "Consumer group is required")
    private String consumerGroup;

    @NotBlank(message = "Service name is required")
    private String serviceName;

    @NotBlank(message = "Owner team is required")
    private String ownerTeam;

    private String contactEmail;

    private Boolean notifyOnSchemaChange = true;

    @NotBlank(message = "Created by is required")
    private String createdBy;
}
