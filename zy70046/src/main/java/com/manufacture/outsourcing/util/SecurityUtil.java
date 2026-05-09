package com.manufacture.outsourcing.util;

import com.manufacture.outsourcing.entity.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityUtil {

    private SecurityUtil() {
    }

    public static User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User) {
            return (User) authentication.getPrincipal();
        }
        return null;
    }

    public static String getCurrentUsername() {
        User user = getCurrentUser();
        return user != null ? user.getUsername() : "system";
    }

    public static String getCurrentRealName() {
        User user = getCurrentUser();
        return user != null ? user.getRealName() : "系统";
    }

    public static String getCurrentRole() {
        User user = getCurrentUser();
        return user != null ? user.getRole() : null;
    }
}
