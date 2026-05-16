package com.example.provenance.model;

import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.Type;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Entity
@Table(name = "provenance_records", indexes = {
    @Index(name = "idx_image_tag", columnList = "imageTag"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_created_at", columnList = "createdAt")
})
public class ProvenanceRecord {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String imageTag;

    @Column(nullable = false)
    private String imageDigest;

    private String registry;

    private String repository;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String sourceCommitJson;

    @Transient
    private SourceCommit sourceCommit;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String buildPipelineJson;

    @Transient
    private BuildPipeline buildPipeline;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String signatureResultJson;

    @Transient
    private SignatureResult signatureResult;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String exceptionRequestJson;

    @Transient
    private ExceptionRequest exceptionRequest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProvenanceStatus status;

    @Column(length = 2000)
    private String statusMessage;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String processingLogsJson;

    @Transient
    private List<ProcessingLog> processingLogs = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String submittedBy;

    private String lastModifiedBy;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String rawInput;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        serializeJsonFields();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        serializeJsonFields();
    }

    @PostLoad
    protected void onLoad() {
        deserializeJsonFields();
    }

    private void serializeJsonFields() {
        try {
            if (sourceCommit != null) {
                sourceCommitJson = objectMapper.writeValueAsString(sourceCommit);
            }
            if (buildPipeline != null) {
                buildPipelineJson = objectMapper.writeValueAsString(buildPipeline);
            }
            if (signatureResult != null) {
                signatureResultJson = objectMapper.writeValueAsString(signatureResult);
            }
            if (exceptionRequest != null) {
                exceptionRequestJson = objectMapper.writeValueAsString(exceptionRequest);
            }
            if (processingLogs != null && !processingLogs.isEmpty()) {
                processingLogsJson = objectMapper.writeValueAsString(processingLogs);
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize JSON fields", e);
        }
    }

    private void deserializeJsonFields() {
        try {
            if (sourceCommitJson != null) {
                sourceCommit = objectMapper.readValue(sourceCommitJson, SourceCommit.class);
            }
            if (buildPipelineJson != null) {
                buildPipeline = objectMapper.readValue(buildPipelineJson, BuildPipeline.class);
            }
            if (signatureResultJson != null) {
                signatureResult = objectMapper.readValue(signatureResultJson, SignatureResult.class);
            }
            if (exceptionRequestJson != null) {
                exceptionRequest = objectMapper.readValue(exceptionRequestJson, ExceptionRequest.class);
            }
            if (processingLogsJson != null) {
                processingLogs = objectMapper.readValue(processingLogsJson, new TypeReference<List<ProcessingLog>>() {});
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize JSON fields", e);
        }
    }

    public void addProcessingLog(ProcessingLog log) {
        if (this.processingLogs == null) {
            this.processingLogs = new ArrayList<>();
        }
        this.processingLogs.add(log);
    }
}
