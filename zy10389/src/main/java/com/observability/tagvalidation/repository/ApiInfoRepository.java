package com.observability.tagvalidation.repository;

import com.observability.tagvalidation.entity.ApiInfo;
import com.observability.tagvalidation.enums.ValidationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApiInfoRepository extends JpaRepository<ApiInfo, Long> {
    Optional<ApiInfo> findByRequestId(String requestId);
    boolean existsByRequestId(String requestId);
    List<ApiInfo> findByStatus(ValidationStatus status);
    List<ApiInfo> findByServiceName(String serviceName);
}
