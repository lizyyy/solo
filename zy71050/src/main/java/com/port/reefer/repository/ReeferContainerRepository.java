package com.port.reefer.repository;

import com.port.reefer.entity.ReeferContainer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReeferContainerRepository extends JpaRepository<ReeferContainer, Long> {
    Optional<ReeferContainer> findByContainerNumber(String containerNumber);
}
