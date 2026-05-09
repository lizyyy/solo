package com.mold.service.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class StrokeRecordRequest {
    
    @NotBlank(message = "批次ID不能为空")
    private String batchId;
    
    @NotBlank(message = "模具编码不能为空")
    private String moldCode;
    
    @NotNull(message = "冲压次数不能为空")
    @Positive(message = "冲压次数必须大于0")
    private Long strokeCount;
    
    @NotNull(message = "记录时间不能为空")
    private LocalDateTime recordTime;
    
    private String productionLine;
    
    private String productCode;
    
    private String operator;
    
    private String remark;
    
    private String source = "MACHINE";
}
