package com.agri.dronespray.repository;

import com.agri.dronespray.entity.Pesticide;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PesticideRepository extends JpaRepository<Pesticide, Long> {

    Optional<Pesticide> findByPesticideCode(String pesticideCode);

    List<Pesticide> findByCategory(String category);
}
