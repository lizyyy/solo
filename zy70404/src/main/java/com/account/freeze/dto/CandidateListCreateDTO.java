package com.account.freeze.dto;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

@Data
public class CandidateListCreateDTO {

    @NotBlank(message = "清单名称不能为空")
    private String listName;

    private String remark;

    @NotBlank(message = "操作人不能为空")
    private String operator;

    @NotNull(message = "清单类型不能为空")
    private String listType;

    private String sourceBatchNo;

    private List<String> accountNos;
}
