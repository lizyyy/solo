package com.riskcontrol.graylist.dto;

import com.riskcontrol.graylist.enums.GraylistStatus;
import com.riskcontrol.graylist.enums.ReviewConclusion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReviewRequestDTO {

    @NotNull(message = "记录ID不能为空")
    private Long recordId;

    @NotNull(message = "新状态不能为空")
    private GraylistStatus newStatus;

    private ReviewConclusion conclusion;

    @NotBlank(message = "复核备注不能为空")
    private String reviewRemark;

    @NotBlank(message = "复核人不能为空")
    private String reviewer;
}
