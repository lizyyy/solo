"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
class UserService {
    createUser(name, isVerified = false) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const user = {
            id: (0, uuid_1.v4)(),
            name,
            isVerified,
            isFrozen: false,
            createdAt: now,
            updatedAt: now,
        };
        db.users.set(user.id, user);
        return user;
    }
    getUser(id) {
        const db = (0, database_1.getDatabase)();
        return db.users.get(id) || null;
    }
    updateVerification(userId, isVerified) {
        const db = (0, database_1.getDatabase)();
        const user = db.users.get(userId);
        if (!user) {
            throw new Error('用户不存在');
        }
        const updated = {
            ...user,
            isVerified,
            updatedAt: Date.now(),
        };
        db.users.set(userId, updated);
        return updated;
    }
    freezeUser(userId) {
        const db = (0, database_1.getDatabase)();
        const user = db.users.get(userId);
        if (!user) {
            throw new Error('用户不存在');
        }
        const updated = {
            ...user,
            isFrozen: true,
            updatedAt: Date.now(),
        };
        db.users.set(userId, updated);
        return updated;
    }
    unfreezeUser(userId) {
        const db = (0, database_1.getDatabase)();
        const user = db.users.get(userId);
        if (!user) {
            throw new Error('用户不存在');
        }
        const updated = {
            ...user,
            isFrozen: false,
            updatedAt: Date.now(),
        };
        db.users.set(userId, updated);
        return updated;
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=userService.js.map