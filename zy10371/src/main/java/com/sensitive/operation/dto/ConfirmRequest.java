package com.sensitive.operation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConfirmRequest {

    @NotBlank(message = "确认人ID不能为空")
    private String confirmerId;

    @NotBlank(message = "确认人姓名不能为空")
    private String confirmerName;

    private String comment;
}
