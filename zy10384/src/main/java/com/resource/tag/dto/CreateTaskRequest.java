package com.resource.tag.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Data
public class CreateTaskRequest {
    @NotBlank(message = "requestId is required")
    private String requestId;

    @NotBlank(message = "targetNodeId is required")
    private String targetNodeId;

    private String createdBy;

    private List<String> tagKeys;

    private Boolean includeDescendants = false;
}
