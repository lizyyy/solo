package com.apigate.voting.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class ResolveBlockRequest {
    @NotBlank(message = "解决人ID不能为空")
    private String resolverId;

    @NotBlank(message = "解决说明不能为空")
    private String resolvedNote;
}
