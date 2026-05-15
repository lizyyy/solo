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
public class CancelRequest {

    @NotBlank(message = "撤销人ID不能为空")
    private String cancellerId;

    @NotBlank(message = "撤销人姓名不能为空")
    private String cancellerName;
}
