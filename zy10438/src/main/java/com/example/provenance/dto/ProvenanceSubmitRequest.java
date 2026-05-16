package com.example.provenance.dto;

import com.example.provenance.model.BuildPipeline;
import com.example.provenance.model.ExceptionRequest;
import com.example.provenance.model.SignatureResult;
import com.example.provenance.model.SourceCommit;
import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ProvenanceSubmitRequest {

    @NotBlank(message = "镜像标签不能为空")
    private String imageTag;

    @NotBlank(message = "镜像摘要不能为空")
    private String imageDigest;

    private String registry;

    private String repository;

    private SourceCommit sourceCommit;

    private BuildPipeline buildPipeline;

    private SignatureResult signatureResult;

    private ExceptionRequest exceptionRequest;

    private String submittedBy;

    private String rawInput;
}
