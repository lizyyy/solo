package com.notebook.artifact.dto;

import com.notebook.artifact.model.ReviewStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReviewRequest {
    @NotBlank(message = "reviewer不能为空")
    private String reviewer;

    @NotNull(message = "status不能为空")
    private ReviewStatus status;

    private String comments;

    private String correctionSuggestions;
}
