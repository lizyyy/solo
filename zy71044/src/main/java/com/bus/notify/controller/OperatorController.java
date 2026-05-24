package com.bus.notify.controller;

import com.bus.notify.dto.ResultDTO;
import com.bus.notify.entity.Operator;
import com.bus.notify.repository.OperatorRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/operators")
public class OperatorController {
    private final OperatorRepository operatorRepository;
    
    public OperatorController(OperatorRepository operatorRepository) {
        this.operatorRepository = operatorRepository;
    }
    
    @PostMapping
    public ResultDTO<Operator> create(@RequestBody Operator operator) {
        operator.setId(null);
        operator.setActive(true);
        if (operatorRepository.existsByUsername(operator.getUsername())) {
            return ResultDTO.fail("用户名已存在");
        }
        return ResultDTO.success(operatorRepository.save(operator));
    }
    
    @GetMapping
    public ResultDTO<List<Operator>> getAll() {
        return ResultDTO.success(operatorRepository.findByActiveTrue());
    }
    
    @GetMapping("/{id}")
    public ResultDTO<Operator> getById(@PathVariable Long id) {
        return operatorRepository.findById(id)
                .map(ResultDTO::success)
                .orElse(ResultDTO.fail("处理人不存在"));
    }
    
    @GetMapping("/username/{username}")
    public ResultDTO<Operator> getByUsername(@PathVariable String username) {
        return operatorRepository.findByUsername(username)
                .map(ResultDTO::success)
                .orElse(ResultDTO.fail("处理人不存在"));
    }
    
    @PutMapping("/{id}")
    public ResultDTO<Operator> update(@PathVariable Long id, @RequestBody Operator operator) {
        return operatorRepository.findById(id)
                .map(existing -> {
                    existing.setName(operator.getName());
                    existing.setPhone(operator.getPhone());
                    existing.setDepartment(operator.getDepartment());
                    return ResultDTO.success(operatorRepository.save(existing));
                })
                .orElse(ResultDTO.fail("处理人不存在"));
    }
    
    @DeleteMapping("/{id}")
    public ResultDTO<Void> delete(@PathVariable Long id) {
        return operatorRepository.findById(id)
                .map(op -> {
                    op.setActive(false);
                    operatorRepository.save(op);
                    return ResultDTO.<Void>success(null);
                })
                .orElse(ResultDTO.fail("处理人不存在"));
    }
}
