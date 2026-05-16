package com.dns.preplay.repository;

import com.dns.preplay.model.entity.DnsRecord;
import com.dns.preplay.model.enums.RecordType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DnsRecordRepository extends JpaRepository<DnsRecord, Long> {

    List<DnsRecord> findByPreplayId(Long preplayId);

    Optional<DnsRecord> findByPreplayIdAndDomainNameAndRecordType(Long preplayId, String domainName, RecordType recordType);

    List<DnsRecord> findByDomainName(String domainName);

    List<DnsRecord> findByPreplayIdAndIsManualCorrectedTrue(Long preplayId);
}
