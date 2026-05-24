package com.hazardous.waste.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReviewDTO {
    @NotBlank(message = "记录编号不能为空")
    private String recordNo;

    @NotBlank(message = "审核人不能为空")
    private String reviewer;

    private Boolean passed;

    private String comment;

    private String returnReason;
}
