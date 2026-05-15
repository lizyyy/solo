package com.resource.tag.dto;

import com.resource.tag.model.ConflictItem;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ConflictResolutionRequest {
    @NotNull(message = "resolution is required")
    private ConflictItem.ConflictResolution resolution;

    private String resolvedBy;

    private String resolvedValue;
}
