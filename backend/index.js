// backend/index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("user connected", socket.id);

  // per-socket state
  socket.data.currentRoom = null;
  socket.data.userName = null;
  socket.data._codeDebounceTimer = null;
  socket.data._pendingCode = null;

  const safeLeaveRoom = (roomId, userName) => {
    if (!roomId || !rooms.has(roomId)) return;
    const set = rooms.get(roomId);
    set.delete(userName);
    if (set.size === 0) {
      rooms.delete(roomId);
    }
    // emit updated member list (empty array if room removed)
    io.to(roomId).emit(
      "userJoined",
      rooms.has(roomId) ? Array.from(rooms.get(roomId)) : []
    );
  };

  socket.on("join", (payload) => {
    try {
      if (
        !payload ||
        typeof payload.roomId !== "string" ||
        !payload.roomId.trim()
      ) {
        socket.emit("error", { message: "Invalid or missing roomId in join" });
        return;
      }
      if (
        !payload ||
        typeof payload.userName !== "string" ||
        !payload.userName.trim()
      ) {
        socket.emit("error", {
          message: "Invalid or missing userName in join",
        });
        return;
      }

      const { roomId, userName } = payload;

      // If already in a room, leave it first
      if (socket.data.currentRoom) {
        safeLeaveRoom(socket.data.currentRoom, socket.data.userName);
        socket.leave(socket.data.currentRoom);
      }

      // join new room
      socket.join(roomId);
      socket.data.currentRoom = roomId;
      socket.data.userName = userName;

      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(userName);

      io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));
      console.log(`socket ${socket.id} (${userName}) joined room ${roomId}`);
    } catch (err) {
      console.error("join handler error:", err);
    }
  });

  // Debounced codeChange: accumulate rapid changes and emit latest after 100ms
  socket.on("codeChange", ({ roomId, code } = {}) => {
    try {
      if (typeof roomId !== "string" || !roomId) return;
      if (typeof code !== "string") return;

      // ensure socket is in the claimed room
      if (socket.data.currentRoom !== roomId) return;

      socket.data._pendingCode = code;
      if (socket.data._codeDebounceTimer)
        clearTimeout(socket.data._codeDebounceTimer);

      socket.data._codeDebounceTimer = setTimeout(() => {
        socket.to(roomId).emit("codeUpdate", socket.data._pendingCode);
        socket.data._pendingCode = null;
        socket.data._codeDebounceTimer = null;
      }, 100);
    } catch (err) {
      console.error("codeChange handler error:", err);
    }
  });

  socket.on("leaveRoom", () => {
    try {
      const { currentRoom, userName } = socket.data;
      if (currentRoom && userName) {
        safeLeaveRoom(currentRoom, userName);
        socket.leave(currentRoom);
      }
      socket.data.currentRoom = null;
      socket.data.userName = null;
    } catch (err) {
      console.error("leaveRoom handler error:", err);
    }
  });

  socket.on("typing", ({ roomId, userName } = {}) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language } = {}) => {
    try {
      if (typeof roomId !== "string" || typeof language !== "string") return;
      io.to(roomId).emit("languageUpdate", language);
    } catch (err) {
      console.error("languageChange handler error:", err);
    }
  });

  socket.on("disconnect", (reason) => {
    try {
      const { currentRoom, userName } = socket.data;
      if (currentRoom && userName) safeLeaveRoom(currentRoom, userName);

      if (socket.data._codeDebounceTimer) {
        clearTimeout(socket.data._codeDebounceTimer);
        socket.data._codeDebounceTimer = null;
        socket.data._pendingCode = null;
      }
      console.log("user disconnected", socket.id, "reason:", reason);
    } catch (err) {
      console.error("disconnect handler error:", err);
    }
  });
});

const port = process.env.PORT || 5000;
const __dirname = path.resolve();

const frontendDist = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
} else {
  console.warn("Warning: frontend dist folder not found at:", frontendDist);
}

const indexHtmlPath = path.join(frontendDist, "index.html");
app.use((req, res, next) => {
  const isGet = req.method === "GET";
  const hasExtension = !!path.extname(req.path);
  const isSocketOrApi =
    req.path.startsWith("/socket.io") || req.path.startsWith("/api");

  if (
    isGet &&
    !hasExtension &&
    !isSocketOrApi &&
    fs.existsSync(indexHtmlPath)
  ) {
    res.sendFile(indexHtmlPath);
  } else {
    next();
  }
});

server.listen(port, () => {
  console.log(`server is working on port ${port}`);
});
