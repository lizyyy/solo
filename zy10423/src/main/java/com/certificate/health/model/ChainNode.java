package com.certificate.health.model;

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
@Table(name = "chain_node")
public class ChainNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "node_order")
    private Integer nodeOrder;

    @Column(name = "subject", length = 1000)
    private String subject;

    @Column(name = "issuer", length = 1000)
    private String issuer;

    @Column(name = "serial_number")
    private String serialNumber;

    @Column(name = "fingerprint")
    private String fingerprint;

    @Column(name = "is_root_ca")
    private Boolean isRootCa;

    @Column(name = "is_intermediate_ca")
    private Boolean isIntermediateCa;

    @Column(name = "is_leaf_certificate")
    private Boolean isLeafCertificate;

    @Column(name = "is_trusted")
    private Boolean isTrusted;

    @Column(name = "chain_validation_error", length = 1000)
    private String chainValidationError;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "algorithm_info_id")
    private AlgorithmInfo algorithmInfo;

    @OneToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "expiry_window_id")
    private ExpiryWindow expiryWindow;
}
