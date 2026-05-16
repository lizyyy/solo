package com.certificate.health.model;

import com.certificate.health.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "algorithm_info")
public class AlgorithmInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "signature_algorithm")
    private String signatureAlgorithm;

    @Column(name = "signature_algorithm_oid")
    private String signatureAlgorithmOid;

    @Column(name = "public_key_algorithm")
    private String publicKeyAlgorithm;

    @Column(name = "key_size")
    private Integer keySize;

    @Column(name = "hash_algorithm")
    private String hashAlgorithm;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level")
    private RiskLevel riskLevel;

    @Column(name = "is_weak_algorithm")
    private Boolean isWeakAlgorithm;

    @Column(name = "risk_description", length = 1000)
    private String riskDescription;

    @Column(name = "recommended_algorithm")
    private String recommendedAlgorithm;
}
