package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.dto.LoginRequest;
import com.manufacture.outsourcing.dto.LoginResponse;
import com.manufacture.outsourcing.entity.User;
import com.manufacture.outsourcing.exception.BusinessException;
import com.manufacture.outsourcing.repository.UserRepository;
import com.manufacture.outsourcing.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> BusinessException.badRequest("用户名或密码错误"));

        if (!user.getEnabled()) {
            throw BusinessException.forbidden("账户已被禁用");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw BusinessException.badRequest("用户名或密码错误");
        }

        String token = jwtUtil.generateToken(user.getUsername(), user.getRealName(), user.getRole());

        return new LoginResponse(token, user.getUsername(), user.getRealName(), user.getRole());
    }

    public User createUser(String username, String password, String realName, String role) {
        if (userRepository.existsByUsername(username)) {
            throw BusinessException.badRequest("用户名已存在");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setRealName(realName);
        user.setRole(role);
        user.setEnabled(true);

        return userRepository.save(user);
    }
}
