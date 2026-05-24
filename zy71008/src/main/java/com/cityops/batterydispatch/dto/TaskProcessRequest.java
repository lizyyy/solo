package com.cityops.batterydispatch.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import jakarta.validation.constraints.NotBlank;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskProcessRequest {
    @NotBlank(message = "操作人不能为空")
    private String operator;

    private String remark;

    private String photoUrl;

    private String photoChecksum;

    private Boolean overrideCheck;
}
