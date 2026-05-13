package com.apigate.voting.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class BlockRequest {
    @NotBlank(message = "阻塞人ID不能为空")
    private String blockerId;

    @NotBlank(message = "阻塞原因不能为空")
    private String reason;
}
