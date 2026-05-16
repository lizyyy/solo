package com.example.provenance.dto;

import com.example.provenance.model.BuildPipeline;
import com.example.provenance.model.ExceptionRequest;
import com.example.provenance.model.SignatureResult;
import com.example.provenance.model.SourceCommit;
import lombok.Data;

@Data
public class ManualCorrectionRequest {

    private String imageTag;

    private String imageDigest;

    private String registry;

    private String repository;

    private SourceCommit sourceCommit;

    private BuildPipeline buildPipeline;

    private SignatureResult signatureResult;

    private ExceptionRequest exceptionRequest;

    private String correctionReason;

    private String operator;
}
