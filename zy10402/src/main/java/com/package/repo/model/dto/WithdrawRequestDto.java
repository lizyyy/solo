package com.package.repo.model.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class WithdrawRequestDto {
    @NotBlank(message = "包名不能为空")
    private String packageName;

    @NotBlank(message = "版本号不能为空")
    private String version;

    @NotBlank(message = "申请人不能为空")
    private String requester;

    private String reason;

    private String requestId;

    private String rawInput;
}
