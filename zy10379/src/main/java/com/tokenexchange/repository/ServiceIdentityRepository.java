package com.tokenexchange.repository;

import com.tokenexchange.entity.ServiceIdentity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ServiceIdentityRepository extends JpaRepository<ServiceIdentity, Long> {
    Optional<ServiceIdentity> findByServiceId(String serviceId);
    Optional<ServiceIdentity> findByServiceIdAndEnabledTrue(String serviceId);
}
