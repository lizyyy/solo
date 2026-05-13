package com.migration.dualwrite.vo.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SwitchRequest {
    @NotBlank(message = "操作人不能为空")
    private String operator;
    private String approvedBy;
    private String remark;
}
