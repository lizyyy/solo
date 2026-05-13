package com.schema.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SchemaRegisterRequest {
    @NotBlank(message = "Topic name is required")
    private String topicName;

    @NotBlank(message = "Schema content is required")
    private String schemaContent;

    private String description;

    @NotBlank(message = "Request ID is required (for idempotency)")
    private String requestId;

    @NotBlank(message = "Created by is required")
    private String createdBy;
}
