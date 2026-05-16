package com.certificate.health.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CertificateUploadRequest {

    @NotBlank(message = "证书数据不能为空")
    private String certificateData;

    private String fileName;

    private String uploadedBy;

    private String certificateFormat;
}
