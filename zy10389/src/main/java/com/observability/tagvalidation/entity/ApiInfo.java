package com.observability.tagvalidation.entity;

import com.observability.tagvalidation.enums.ValidationStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "api_info", indexes = {
    @Index(name = "idx_api_name", columnList = "apiName"),
    @Index(name = "idx_request_id", columnList = "requestId", unique = true)
})
@EqualsAndHashCode(callSuper = true)
public class ApiInfo extends BaseEntity {
    @Column(name = "request_id", nullable = false, unique = true, length = 64)
    private String requestId;

    @Column(name = "api_name", nullable = false, length = 256)
    private String apiName;

    @Column(name = "api_path", length = 512)
    private String apiPath;

    @Column(name = "api_method", length = 16)
    private String apiMethod;

    @Column(name = "service_name", length = 128)
    private String serviceName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ValidationStatus status;

    @Column(name = "description", length = 1024)
    private String description;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @OneToMany(mappedBy = "apiInfo", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TagKey> tagKeys = new ArrayList<>();

    @OneToMany(mappedBy = "apiInfo", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ReportSample> samples = new ArrayList<>();

    @OneToMany(mappedBy = "apiInfo", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ViolationRecord> violations = new ArrayList<>();

    @Version
    private Long version;
}
