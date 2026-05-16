package com.dns.preplay.repository;

import com.dns.preplay.model.entity.DnsPreplay;
import com.dns.preplay.model.enums.PreplayStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DnsPreplayRepository extends JpaRepository<DnsPreplay, Long> {

    Optional<DnsPreplay> findByPreplayName(String preplayName);

    boolean existsByPreplayName(String preplayName);

    List<DnsPreplay> findByStatus(PreplayStatus status);

    List<DnsPreplay> findByCreatedBy(String createdBy);

    @Query("SELECT p FROM DnsPreplay p WHERE p.status IN :statuses")
    List<DnsPreplay> findByStatusIn(@Param("statuses") List<PreplayStatus> statuses);
}
