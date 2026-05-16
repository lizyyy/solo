package com.query.regression.dto;

import com.query.regression.enums.ConclusionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ConfirmRequest {
    @NotNull(message = "结论类型不能为空")
    private ConclusionType conclusion;
    
    private String conclusionNotes;
    
    @NotBlank(message = "确认人不能为空")
    private String confirmedBy;
}
