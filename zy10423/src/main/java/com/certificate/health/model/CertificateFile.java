package com.certificate.health.model;

import com.certificate.health.enums.HealthStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "certificate_file")
public class CertificateFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "upload_time")
    private LocalDateTime uploadTime;

    @Column(name = "uploaded_by")
    private String uploadedBy;

    @Column(name = "certificate_format")
    private String certificateFormat;

    @Column(name = "raw_certificate_data", length = 10000)
    private String rawCertificateData;

    @Column(name = "parsing_error", length = 2000)
    private String parsingError;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private HealthStatus status;

    @Column(name = "has_intermediate_certificates")
    private Boolean hasIntermediateCertificates;

    @Column(name = "intermediate_count")
    private Integer intermediateCount;

    @Column(name = "manual_fix_applied")
    private Boolean manualFixApplied;

    @Column(name = "manual_fix_notes", length = 2000)
    private String manualFixNotes;

    @Column(name = "last_analyzed_at")
    private LocalDateTime lastAnalyzedAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "certificate_id")
    @Builder.Default
    private List<ChainNode> chainNodes = new ArrayList<>();

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "health_report_id")
    private HealthReport healthReport;
}
