package com.object.lifecycle.entity;

import com.object.lifecycle.common.BaseEntity;
import javax.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "execution_proof")
@Getter
@Setter
public class ExecutionProof extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String proofId;

    @Column(nullable = false)
    private String operationType;

    private String ruleId;

    private String taskId;

    private String objectKey;

    private String bucketName;

    @Column(nullable = false)
    private LocalDateTime executionTime;

    @Column(nullable = false)
    private Boolean success;

    private String resultDetails;

    private String errorMessage;

    private String operator;

    private String clientIp;

    @Lob
    private String requestPayload;

    @Lob
    private String responsePayload;

    @Version
    private Long version;
}
