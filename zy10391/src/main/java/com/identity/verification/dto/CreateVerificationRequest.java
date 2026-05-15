package com.identity.verification.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class CreateVerificationRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    private String businessType;

    private String description;

    private String createdBy;

    @NotEmpty(message = "身份数据源不能为空")
    private List<IdentityData> identityDataList;

    @Data
    public static class IdentityData {
        @NotBlank(message = "来源编码不能为空")
        private String sourceCode;

        @NotBlank(message = "证件类型不能为空")
        private String idType;

        @NotBlank(message = "证件值不能为空")
        private String idValue;

        private String name;
        private String gender;
        private String birthDate;
        private String address;
        private String phoneNumber;
        private String email;
    }
}
