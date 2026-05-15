package com.resource.tag.dto;

import com.resource.tag.model.ConflictItem;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ConflictResolutionRequest {
    @NotNull(message = "resolution is required")
    private ConflictItem.ConflictResolution resolution;

    private String resolvedBy;

    private String resolvedValue;
}
