package com.apigate.voting.repository;

import com.apigate.voting.model.Caller;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CallerRepository extends JpaRepository<Caller, Long> {
    Optional<Caller> findByCallerId(String callerId);
    boolean existsByCallerId(String callerId);
}
