package com.apigate.voting.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Data
public class ReleaseRequest {
    @NotBlank(message = "发布版本不能为空")
    private String releaseVersion;

    private String releaseNote;

    @NotBlank(message = "操作人姓名不能为空")
    private String operatorName;

    private LocalDateTime actualReleaseTime;
}
