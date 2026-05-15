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
public class RejectRequest {

    @NotBlank(message = "拒绝人ID不能为空")
    private String rejectorId;

    @NotBlank(message = "拒绝人姓名不能为空")
    private String rejectorName;

    @NotBlank(message = "拒绝原因不能为空")
    private String rejectReason;
}
