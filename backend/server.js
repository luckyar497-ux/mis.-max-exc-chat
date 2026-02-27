const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
const os = require('os');
const UserManager = require('./users');

// Initialize app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// User management
const userManager = new UserManager();
const messageHistory = [];
const MAX_HISTORY = 100;
const statusHistory = [];
const MAX_STATUS_HISTORY = 50;
const reelHistory = [];
const MAX_REEL_HISTORY = 30;
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;
const groupVoiceUsers = new Map();

function cleanupExpiredStatuses() {
  const now = Date.now();
  for (let i = statusHistory.length - 1; i >= 0; i -= 1) {
    const createdAt = new Date(statusHistory[i].timestamp).getTime();
    if (!createdAt || now - createdAt >= STATUS_TTL_MS) {
      statusHistory.splice(i, 1);
    }
  }
}

// Broadcast message to all clients
function broadcast(data, excludeWs = null) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  let userId = null;
  let username = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join':
          cleanupExpiredStatuses();
          userId = data.userId || 'user_' + Date.now();
          username = data.username || 'Anonymous';
          const profilePic = data.profilePic || null;
          // remember on socket
          ws.userId = userId;
          const user = userManager.addUser(userId, username, profilePic);
          console.log(`[JOIN] User added:`, user);

          // Send history to new user
          ws.send(JSON.stringify({
            type: 'history',
            messages: messageHistory
          }));
          ws.send(JSON.stringify({
            type: 'statusHistory',
            statuses: statusHistory
          }));
          ws.send(JSON.stringify({
            type: 'reelHistory',
            reels: reelHistory
          }));
          console.log(`[JOIN] Sent history to ${username}`);

          // Send user list to new user
          const userList = userManager.getAllUsers();
          console.log(`[JOIN] Sending user list to ${username}:`, userList);
          ws.send(JSON.stringify({
            type: 'userList',
            users: userList
          }));

          // Broadcast user joined
          const allUsers = userManager.getAllUsers();
          console.log(`[JOIN] Broadcasting userJoined to all clients, total users:`, allUsers.length);
          broadcast({
            type: 'userJoined',
            user: user,
            users: allUsers
          });

          console.log(`User joined: ${username}`);
          break;

        case 'message':
          if (userId && username) {
            const messageObj = {
              id: 'msg_' + Date.now(),
              userId: userId,
              username: username,
              text: data.text,
              recipientId: data.recipientId || 'all',
              timestamp: new Date(),
              type: 'message'
            };

            // Add to history
            messageHistory.push(messageObj);
            if (messageHistory.length > MAX_HISTORY) {
              messageHistory.shift();
            }

            // Broadcast based on recipient
            if (!messageObj.recipientId || messageObj.recipientId === 'all') {
              broadcast(messageObj);
            } else {
              // send only to sender and recipient
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  if (client.userId === messageObj.recipientId || client.userId === userId) {
                    client.send(JSON.stringify(messageObj));
                  }
                }
              });
            }
          }
          break;

        case 'file':
          if (userId && username && data.fileData) {
            console.log(`Received file from ${username}: ${data.filename || 'file'} (size=${(data.fileData||'').length} chars)`);
            const fileObj = {
              id: 'file_' + Date.now(),
              userId: userId,
              username: username,
              filename: data.filename || 'file',
              fileData: data.fileData,
              recipientId: data.recipientId || 'all',
              timestamp: new Date(),
              type: 'file'
            };

            // Add to history
            messageHistory.push(fileObj);
            if (messageHistory.length > MAX_HISTORY) {
              messageHistory.shift();
            }

            // Broadcast based on recipient
            if (!fileObj.recipientId || fileObj.recipientId === 'all') {
              broadcast(fileObj);
            } else {
              // send only to sender and recipient
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  if (client.userId === fileObj.recipientId || client.userId === userId) {
                    client.send(JSON.stringify(fileObj));
                  }
                }
              });
            }
          }
          break;
        case 'voice':
          if (userId && username && data.voiceData) {
            console.log(`Received voice message from ${username}`);
            const voiceObj = {
              id: 'voice_' + Date.now(),
              userId: userId,
              username: username,
              voiceData: data.voiceData,
              timestamp: new Date(),
              type: 'voice',
              recipientId: data.recipientId || 'all'
            };
            messageHistory.push(voiceObj);
            if (messageHistory.length > MAX_HISTORY) {
              messageHistory.shift();
            }
            if (!voiceObj.recipientId || voiceObj.recipientId === 'all') {
              broadcast(voiceObj);
            } else {
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  if (client.userId === voiceObj.recipientId || client.userId === userId) {
                    client.send(JSON.stringify(voiceObj));
                  }
                }
              });
            }
          }
          break;

        case 'status':
          if (userId && username) {
            cleanupExpiredStatuses();
            const statusText = (data.text || '').trim();
            if (!statusText) break;

            const statusObj = {
              id: 'status_' + Date.now(),
              userId,
              username,
              profilePic: userManager.getUser(userId)?.profilePic || null,
              text: statusText,
              timestamp: new Date(),
              type: 'status'
            };

            statusHistory.push(statusObj);
            if (statusHistory.length > MAX_STATUS_HISTORY) {
              statusHistory.shift();
            }

            broadcast(statusObj);
          }
          break;

        case 'deleteStatus':
          if (userId && data.statusId) {
            cleanupExpiredStatuses();
            const idx = statusHistory.findIndex((status) => status.id === data.statusId);
            if (idx !== -1 && statusHistory[idx].userId === userId) {
              const [removedStatus] = statusHistory.splice(idx, 1);
              broadcast({
                type: 'statusDeleted',
                statusId: removedStatus.id
              });
            }
          }
          break;

        case 'reel':
          if (userId && username && data.videoData) {
            const reelObj = {
              id: 'reel_' + Date.now(),
              userId,
              username,
              profilePic: userManager.getUser(userId)?.profilePic || null,
              caption: (data.caption || '').trim(),
              filename: data.filename || 'video',
              videoData: data.videoData,
              timestamp: new Date(),
              type: 'reel'
            };

            reelHistory.push(reelObj);
            if (reelHistory.length > MAX_REEL_HISTORY) {
              reelHistory.shift();
            }

            broadcast(reelObj);
          }
          break;

        case 'deleteReel':
          if (userId && data.reelId) {
            const idx = reelHistory.findIndex((reel) => reel.id === data.reelId);
            if (idx !== -1 && reelHistory[idx].userId === userId) {
              const [removedReel] = reelHistory.splice(idx, 1);
              broadcast({
                type: 'reelDeleted',
                reelId: removedReel.id
              });
            }
          }
          break;

        case 'updateProfile':
          if (userId) {
            const nextUsername = (data.username || '').trim() || username || 'Anonymous';
            const nextProfilePic = typeof data.profilePic === 'undefined' ? userManager.getUser(userId)?.profilePic || null : data.profilePic;

            const updatedUser = userManager.updateUser(userId, {
              username: nextUsername,
              profilePic: nextProfilePic
            });

            if (updatedUser) {
              username = updatedUser.username;
              if (groupVoiceUsers.has(userId)) {
                groupVoiceUsers.set(userId, { id: userId, username: updatedUser.username });
              }
              broadcast({
                type: 'userUpdated',
                user: updatedUser,
                users: userManager.getAllUsers()
              });
              console.log(`User updated profile: ${updatedUser.username}`);
            }
          }
          break;

        case 'groupVoiceJoin':
          if (userId) {
            groupVoiceUsers.set(userId, { id: userId, username: username || 'Anonymous' });
            ws.send(JSON.stringify({
              type: 'groupVoiceState',
              users: Array.from(groupVoiceUsers.values()).filter((u) => u.id !== userId)
            }));
            broadcast({
              type: 'groupVoiceJoin',
              userId: userId,
              username: username || 'Anonymous'
            }, ws);

            // notify all online users that someone started/joined live group
            broadcast({
              type: 'groupVoiceInvite',
              userId: userId,
              username: username || 'Anonymous',
              message: `${username || 'Anonymous'} mengundang kamu untuk join Live Grup 🎧`
            });
          }
          break;

        case 'groupVoiceLeave':
          if (userId && groupVoiceUsers.has(userId)) {
            groupVoiceUsers.delete(userId);
            broadcast({
              type: 'groupVoiceLeave',
              userId: userId,
              username: username || 'Anonymous'
            }, ws);
          }
          break;

        case 'groupVoiceOffer':
        case 'groupVoiceAnswer':
        case 'groupVoiceCandidate':
          if (data.recipientId) {
            const relayPayload = {
              type: data.type,
              recipientId: data.recipientId,
              userId: userId,
              username: username || 'Anonymous',
              offer: data.offer,
              answer: data.answer,
              candidate: data.candidate
            };
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client.userId === data.recipientId) {
                client.send(JSON.stringify(relayPayload));
              }
            });
          }
          break;

        // WebRTC signaling messages
        case 'offer':
        case 'answer':
        case 'candidate':
        case 'end':
          // relay to recipient
          if (data.recipientId) {
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client.userId === data.recipientId) {
                client.send(JSON.stringify(data));
              }
            });
          }
          break;

        case 'typing':
          broadcast({
            type: 'userTyping',
            userId: userId,
            username: username
          });
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      if (groupVoiceUsers.has(userId)) {
        groupVoiceUsers.delete(userId);
        broadcast({
          type: 'groupVoiceLeave',
          userId: userId,
          username: username || 'Anonymous'
        });
      }
      userManager.removeUser(userId);
      broadcast({
        type: 'userLeft',
        userId: userId,
        username: username,
        users: userManager.getAllUsers()
      });
      console.log(`User left: ${username}`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// REST API endpoints
app.get('/api/users', (req, res) => {
  res.json({
    users: userManager.getAllUsers(),
    count: userManager.getUserCount()
  });
});

app.get('/api/messages', (req, res) => {
  res.json({
    messages: messageHistory,
    count: messageHistory.length
  });
});

app.get('/api/statuses', (req, res) => {
  cleanupExpiredStatuses();
  res.json({
    statuses: statusHistory,
    count: statusHistory.length
  });
});

app.get('/api/reels', (req, res) => {
  res.json({
    reels: reelHistory,
    count: reelHistory.length
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function getLanIp() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceInfo of Object.values(networkInterfaces)) {
    if (!interfaceInfo) continue;
    const ipv4 = interfaceInfo.find((detail) => detail.family === 'IPv4' && !detail.internal);
    if (ipv4) return ipv4.address;
  }
  return null;
}

server.listen(PORT, HOST, () => {
  const lanIp = getLanIp();
  console.log(`🚀 Chat server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🌐 Network bind: ${HOST}:${PORT}`);
  if (lanIp) {
    console.log(`🖥️  Access from other devices: http://${lanIp}:${PORT}`);
  }
});
