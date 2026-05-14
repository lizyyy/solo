package com.version.adapter.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "invocation_sample")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvocationSample {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String requestId;

    @Column(nullable = false)
    private Long clientVersionId;

    @Column(nullable = false)
    private Long templateId;

    @Column(columnDefinition = "TEXT")
    private String requestBody;

    @Column(columnDefinition = "TEXT")
    private String originalResponse;

    @Column(columnDefinition = "TEXT")
    private String adaptedResponse;

    private Long adaptationTimeMs;

    private Boolean hasWarnings;

    private Boolean hasErrors;

    private String errorMessage;

    @Column(nullable = false)
    private String invokedBy;

    @Column(nullable = false)
    private LocalDateTime invokedAt;

    @PrePersist
    protected void onCreate() {
        if (invokedAt == null) {
            invokedAt = LocalDateTime.now();
        }
    }
}
