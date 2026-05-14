package com.account.freeze.dto;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class SmsBatchCreateDTO {

    @NotBlank(message = "批次名称不能为空")
    private String batchName;

    private String remark;

    @NotBlank(message = "操作人不能为空")
    private String operator;

    @NotEmpty(message = "短信明细不能为空")
    private List<SmsItemDTO> items;
}
