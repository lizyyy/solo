package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TechnicianNoteRequest {
    @NotBlank(message = "返工单号不能为空")
    private String reworkNo;
    
    @NotBlank(message = "技师备注不能为空")
    private String technicianNote;
    
    @NotBlank(message = "技师姓名不能为空")
    private String technicianName;
}
