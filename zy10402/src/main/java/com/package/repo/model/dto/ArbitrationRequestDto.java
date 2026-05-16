package com.package.repo.model.dto;

import com.package.repo.model.enums.ArbitrationResult;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ArbitrationRequestDto {
    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotBlank(message = "仲裁人不能为空")
    private String arbitrator;

    @NotNull(message = "仲裁结论不能为空")
    private ArbitrationResult result;

    private String comment;

    private String rawInput;
}
