package com.performancereview.entity;

import com.performancereview.enums.BottleneckSeverity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "network_rtts")
@Data
@EqualsAndHashCode(callSuper = true)
public class NetworkRtt extends BaseEntity {

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "source_address")
    private String sourceAddress;

    @Column(name = "source_port")
    private Integer sourcePort;

    @Column(name = "destination_address")
    private String destinationAddress;

    @Column(name = "destination_port")
    private Integer destinationPort;

    @Column(name = "protocol")
    private String protocol;

    @Column(name = "rtt_ms")
    private Double rttMs;

    @Column(name = "rtt_min_ms")
    private Double rttMinMs;

    @Column(name = "rtt_max_ms")
    private Double rttMaxMs;

    @Column(name = "rtt_avg_ms")
    private Double rttAvgMs;

    @Column(name = "rtt_stddev_ms")
    private Double rttStddevMs;

    @Column(name = "packet_loss_percent")
    private Double packetLossPercent;

    @Column(name = "retransmission_count")
    private Integer retransmissionCount;

    @Column(name = "connection_established_ms")
    private Double connectionEstablishedMs;

    @Column(name = "ssl_handshake_ms")
    private Double sslHandshakeMs;

    @Column(name = "dns_resolution_ms")
    private Double dnsResolutionMs;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity")
    private BottleneckSeverity severity;

    @Column(name = "evidence_snippet", columnDefinition = "TEXT")
    private String evidenceSnippet;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id")
    private Incident incident;
}
