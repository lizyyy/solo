package com.agri.dronespray.entity;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PermissionItemTest {

    @Test
    void testSetItems_ShouldSetBackReference() {
        Permission permission = new Permission();
        permission.setCreatedBy("test");
        permission.setItems(new ArrayList<>());

        PermissionItem item1 = new PermissionItem();
        item1.setCreatedBy("test");
        PermissionItem item2 = new PermissionItem();
        item2.setCreatedBy("test");

        List<PermissionItem> items = List.of(item1, item2);
        permission.setItems(items);

        assertEquals(2, permission.getItems().size());
        assertSame(permission, item1.getPermission(), "子项的 permission 反向引用应被设置");
        assertSame(permission, item2.getPermission(), "子项的 permission 反向引用应被设置");
    }

    @Test
    void testAddItem_ShouldSetBackReference() {
        Permission permission = new Permission();
        permission.setCreatedBy("test");
        permission.setItems(new ArrayList<>());

        PermissionItem item = new PermissionItem();
        item.setCreatedBy("test");
        permission.addItem(item);

        assertEquals(1, permission.getItems().size());
        assertSame(permission, item.getPermission(), "addItem 应设置子项的反向引用");
    }

    @Test
    void testSetItems_ShouldClearExistingItems() {
        Permission permission = new Permission();
        permission.setCreatedBy("test");
        permission.setItems(new ArrayList<>());

        PermissionItem oldItem = new PermissionItem();
        oldItem.setCreatedBy("test");
        permission.addItem(oldItem);
        assertEquals(1, permission.getItems().size());

        PermissionItem newItem = new PermissionItem();
        newItem.setCreatedBy("test");
        permission.setItems(List.of(newItem));

        assertEquals(1, permission.getItems().size());
        assertSame(newItem, permission.getItems().get(0));
        assertSame(permission, newItem.getPermission());
    }

    @Test
    void testSetItems_NullShouldClear() {
        Permission permission = new Permission();
        permission.setCreatedBy("test");
        permission.setItems(new ArrayList<>());

        PermissionItem item = new PermissionItem();
        item.setCreatedBy("test");
        permission.addItem(item);
        assertEquals(1, permission.getItems().size());

        permission.setItems(null);

        assertTrue(permission.getItems().isEmpty(), "设置 null 应清空明细列表");
    }
}
