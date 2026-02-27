// Simple in-memory user management
class UserManager {
  constructor() {
    this.users = new Map();
    this.userColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#AED6F1'
    ];
    this.colorIndex = 0;
  }

  addUser(userId, username, profilePic) {
    const color = this.userColors[this.colorIndex % this.userColors.length];
    this.colorIndex++;
    this.users.set(userId, {
      id: userId,
      username: username,
      color: color,
      profilePic: profilePic || null,
      joinedAt: new Date()
    });
    return this.users.get(userId);
  }

  removeUser(userId) {
    return this.users.delete(userId);
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  updateUser(userId, updates = {}) {
    const existing = this.users.get(userId);
    if (!existing) return null;

    const nextUser = {
      ...existing,
      username: updates.username || existing.username,
      profilePic: typeof updates.profilePic === 'undefined' ? existing.profilePic : updates.profilePic
    };

    this.users.set(userId, nextUser);
    return nextUser;
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }

  getUserCount() {
    return this.users.size;
  }
}

module.exports = UserManager;
