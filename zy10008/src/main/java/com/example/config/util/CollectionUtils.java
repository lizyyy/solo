package com.example.config.util;

import java.util.*;

public final class CollectionUtils {

    private CollectionUtils() {
    }

    public static <K, V> Map<K, V> mapOf(K k1, V v1) {
        Map<K, V> map = new LinkedHashMap<>();
        map.put(k1, v1);
        return Collections.unmodifiableMap(map);
    }

    public static <K, V> Map<K, V> mapOf(K k1, V v1, K k2, V v2) {
        Map<K, V> map = new LinkedHashMap<>();
        map.put(k1, v1);
        map.put(k2, v2);
        return Collections.unmodifiableMap(map);
    }

    public static <K, V> Map<K, V> mapOf(K k1, V v1, K k2, V v2, K k3, V v3) {
        Map<K, V> map = new LinkedHashMap<>();
        map.put(k1, v1);
        map.put(k2, v2);
        map.put(k3, v3);
        return Collections.unmodifiableMap(map);
    }

    public static <K, V> Map<K, V> mapOf(K k1, V v1, K k2, V v2, K k3, V v3, K k4, V v4) {
        Map<K, V> map = new LinkedHashMap<>();
        map.put(k1, v1);
        map.put(k2, v2);
        map.put(k3, v3);
        map.put(k4, v4);
        return Collections.unmodifiableMap(map);
    }

    public static <T> List<T> listOf(T... elements) {
        if (elements == null || elements.length == 0) {
            return Collections.emptyList();
        }
        List<T> list = new ArrayList<>();
        Collections.addAll(list, elements);
        return Collections.unmodifiableList(list);
    }

    public static <T> Set<T> setOf(T... elements) {
        if (elements == null || elements.length == 0) {
            return Collections.emptySet();
        }
        Set<T> set = new LinkedHashSet<>();
        Collections.addAll(set, elements);
        return Collections.unmodifiableSet(set);
    }

    public static <K, V> Map<K, V> emptyMap() {
        return Collections.emptyMap();
    }

    public static <T> List<T> emptyList() {
        return Collections.emptyList();
    }
}
