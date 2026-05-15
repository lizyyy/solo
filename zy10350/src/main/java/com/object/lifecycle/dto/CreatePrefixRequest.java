package com.object.lifecycle.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePrefixRequest {

    @NotBlank(message = "前缀不能为空")
    private String prefix;

    @NotBlank(message = "桶名不能为空")
    private String bucketName;

    private String description;
}
