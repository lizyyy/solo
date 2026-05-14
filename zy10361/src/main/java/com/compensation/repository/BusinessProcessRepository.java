package com.compensation.repository;

import com.compensation.entity.BusinessProcess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BusinessProcessRepository extends JpaRepository<BusinessProcess, Long> {

    Optional<BusinessProcess> findByProcessId(String processId);

    boolean existsByProcessId(String processId);
}
