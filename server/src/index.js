import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import pg from "pg";
import { WebSocketServer } from "ws";
import { createGame, applyAction, publicStateForPlayer } from "../../common/src/game.js";
import { generatePersonalitySystem } from "./personality-generator.js";

const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const app = express();
app.use(
  cors({
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN.split(","),
    credentials: true
  })
);
app.use(express.json());

const { Pool } = pg;
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      query_timeout: 10000,
      statement_timeout: 10000
    })
  : null;
let canUseDatabase = Boolean(pool);

const generatedTestsMemory = new Map();

if (pool) {
  try {
    await initDb();
  } catch (error) {
    canUseDatabase = false;
    console.warn(`Database unavailable, personality test endpoints will fall back to memory storage: ${error.message}`);
  }
} else {
  canUseDatabase = false;
  console.warn("DATABASE_URL missing, personality test endpoints will use memory storage.");
}

const gameStates = new Map();
const roomSockets = new Map();

const server = app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  const user = await authenticateToken(token);
  if (!user) {
    ws.close();
    return;
  }

  ws.user = user;
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "subscribe" && msg.roomCode) {
        subscribeSocket(ws, msg.roomCode);
      }
    } catch {
      // ignore bad messages
    }
  });

  ws.on("close", () => {
    if (ws.roomCode) {
      const set = roomSockets.get(ws.roomCode);
      if (set) {
        set.delete(ws);
        if (set.size === 0) roomSockets.delete(ws.roomCode);
      }
    }
  });
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields." });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
      [username, hash]
    );
    const token = await createSession(result.rows[0].id);
    res.json({ token });
  } catch {
    res.status(409).json({ error: "Username already exists." });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields." });
  const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  const row = result.rows[0];
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  const token = await createSession(row.id);
  res.json({ token });
});

app.get("/api/me", authMiddleware, async (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

app.post("/api/personality-tests/generate", async (req, res) => {
  try {
    const config = req.body || {};
    const id = generateGeneratedTestId();
    const startedAt = Date.now();
    const generationStartedAt = Date.now();
    console.log(
      `[personality-tests] request id=${id} school=${config.schoolId || "unknown"} direction=${Array.isArray(config.directionIds) ? config.directionIds[0] || "custom" : "custom"} custom=${config.customDirection ? "yes" : "no"} typeCount=${config.typeCount || 16} questionCount=${config.questionCount || 20}`
    );
    const generatedSystem = await generatePersonalitySystem(config, { mode: "quick" });
    const generationDuration = Date.now() - generationStartedAt;
    const payload = {
      config: {
        schoolId: config.schoolId,
        directionIds: Array.isArray(config.directionIds) ? config.directionIds.slice(0, 1) : [],
        customDirection: config.customDirection || "",
        typeCount: Number(config.typeCount) || 16,
        questionCount: Number(config.questionCount) || 20
      },
      generatedSystem,
      generationStatus: "drafting",
      generationStage: "copy",
      generationError: ""
    };

    const saveStartedAt = Date.now();
    await saveGeneratedTest(id, payload);
    const saveDuration = Date.now() - saveStartedAt;
    console.log(
      `[personality-tests] quick-ready id=${id} duration_ms=${Date.now() - startedAt} generate_ms=${generationDuration} save_ms=${saveDuration}`
    );
    res.json({ id, generatedSystem, generationStatus: payload.generationStatus, generationStage: payload.generationStage });

    void enrichGeneratedTest(id, payload.config, generatedSystem).catch((error) => {
      console.error(`Failed to enrich generated test ${id}:`, error);
    });
  } catch (error) {
    console.error("[personality-tests] generate failed:", error);
    res.status(500).json({ error: error.message || "Failed to generate personality test." });
  }
});

app.get("/api/personality-tests/:id", async (req, res) => {
  const test = await getGeneratedTest(req.params.id);
  if (!test) {
    return res.status(404).json({ error: "Test not found." });
  }
  res.json(test);
});

app.post("/api/rooms", authMiddleware, async (req, res) => {
  const code = generateRoomCode();
  const result = await pool.query(
    "INSERT INTO rooms (code, host_id) VALUES ($1, $2) RETURNING id",
    [code, req.user.id]
  );
  await addPlayerToRoom(code, req.user.id);
  res.json({ code });
});

app.post("/api/rooms/:code/join", authMiddleware, async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found." });
  await addPlayerToRoom(room.code, req.user.id);
  res.json({ ok: true });
});

app.post("/api/rooms/:code/leave", authMiddleware, async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found." });
  await pool.query("DELETE FROM room_players WHERE room_id = $1 AND user_id = $2", [room.id, req.user.id]);
  res.json({ ok: true });
});

app.post("/api/rooms/:code/start", authMiddleware, async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found." });
  if (room.host_id !== req.user.id) return res.status(403).json({ error: "Only host can start." });

  const playersResult = await pool.query(
    "SELECT u.id, u.username FROM room_players rp JOIN users u ON u.id = rp.user_id WHERE rp.room_id = $1 ORDER BY rp.joined_at ASC",
    [room.id]
  );
  const players = playersResult.rows;

  if (players.length < 2 || players.length > 4) {
    return res.status(400).json({ error: "Room must have 2-4 players." });
  }

  const game = createGame({ players, seed: Date.now() % 100000 });
  gameStates.set(room.code, game);
  await pool.query(
    "INSERT INTO games (room_id, state_json, status) VALUES ($1, $2, $3) ON CONFLICT (room_id) DO UPDATE SET state_json = EXCLUDED.state_json, status = EXCLUDED.status",
    [room.id, JSON.stringify(game), game.status]
  );

  broadcastRoom(room.code, (ws) => {
    ws.send(JSON.stringify({ type: "state", state: publicStateForPlayer(game, ws.user.id) }));
  });

  res.json({ ok: true });
});

app.get("/api/rooms/:code/state", authMiddleware, async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found." });
  const game = await getGameState(room.code, room.id);
  if (!game) return res.status(404).json({ error: "Game not started." });
  res.json(publicStateForPlayer(game, req.user.id));
});

app.post("/api/rooms/:code/action", authMiddleware, async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "Room not found." });
  const game = await getGameState(room.code, room.id);
  if (!game) return res.status(404).json({ error: "Game not started." });

  const result = applyAction(game, req.user.id, req.body || {});
  if (!result.ok) return res.status(400).json({ error: result.error });

  await pool.query("UPDATE games SET state_json = $1, status = $2 WHERE room_id = $3", [
    JSON.stringify(game),
    game.status,
    room.id
  ]);

  broadcastRoom(room.code, (ws) => {
    ws.send(JSON.stringify({ type: "state", state: publicStateForPlayer(game, ws.user.id) }));
  });

  res.json({ ok: true });
});

async function initDb() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, created_at TIMESTAMPTZ DEFAULT NOW())"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires BIGINT)"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS rooms (id SERIAL PRIMARY KEY, code TEXT UNIQUE, host_id INTEGER REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW())"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS room_players (room_id INTEGER REFERENCES rooms(id), user_id INTEGER REFERENCES users(id), joined_at BIGINT DEFAULT (extract(epoch from now())))"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS games (room_id INTEGER UNIQUE REFERENCES rooms(id), state_json TEXT, status TEXT)"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS generated_tests (id TEXT PRIMARY KEY, payload_json TEXT, created_at TIMESTAMPTZ DEFAULT NOW())"
  );
}

async function saveGeneratedTest(id, payload) {
  if (!pool || !canUseDatabase) {
    generatedTestsMemory.set(id, payload);
    return;
  }

  try {
    await pool.query(
      "INSERT INTO generated_tests (id, payload_json) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET payload_json = EXCLUDED.payload_json",
      [id, JSON.stringify(payload)]
    );
  } catch {
    canUseDatabase = false;
    generatedTestsMemory.set(id, payload);
  }
}

async function createSession(userId) {
  if (!pool) {
    throw new Error("Database unavailable.");
  }
  const token = `t_${Math.random().toString(36).slice(2)}${Date.now()}`;
  const expires = Date.now() + SESSION_TTL_MS;
  await pool.query("INSERT INTO sessions (token, user_id, expires) VALUES ($1, $2, $3)", [token, userId, expires]);
  return token;
}

async function authenticateToken(token) {
  if (!pool) return null;
  if (!token) return null;
  const result = await pool.query(
    "SELECT s.token, s.expires, u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1",
    [token]
  );
  const row = result.rows[0];
  if (!row || row.expires < Date.now()) return null;
  return { id: row.id, username: row.username };
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const user = await authenticateToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized." });
  req.user = user;
  next();
}

function generateRoomCode() {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

function generateGeneratedTestId() {
  return `pt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

async function addPlayerToRoom(code, userId) {
  if (!pool) return;
  const room = await getRoom(code);
  if (!room) return;
  const exists = await pool.query("SELECT 1 FROM room_players WHERE room_id = $1 AND user_id = $2", [
    room.id,
    userId
  ]);
  if (exists.rows.length) return;
  await pool.query("INSERT INTO room_players (room_id, user_id) VALUES ($1, $2)", [room.id, userId]);
}

async function getRoom(code) {
  if (!pool) return null;
  const result = await pool.query("SELECT * FROM rooms WHERE code = $1", [code]);
  return result.rows[0] || null;
}

async function getGeneratedTest(id) {
  if (!pool || !canUseDatabase) {
    return generatedTestsMemory.get(id) || null;
  }

  try {
    const result = await pool.query("SELECT payload_json FROM generated_tests WHERE id = $1", [id]);
    const row = result.rows[0];
    if (!row) return generatedTestsMemory.get(id) || null;
    return JSON.parse(row.payload_json);
  } catch {
    canUseDatabase = false;
    return generatedTestsMemory.get(id) || null;
  }
}

async function enrichGeneratedTest(id, config, seedSystem = null) {
  const startedAt = Date.now();
  console.log(`[personality-tests] enrich-start id=${id}`);

  try {
    const copyStartedAt = Date.now();
    const copySystem = await generatePersonalitySystem(
      {
        ...config,
        generatedSystem: seedSystem || null
      },
      { mode: "copy" }
    );
    await updateGeneratedTest(id, (current) => ({
      ...current,
      generatedSystem: copySystem,
      generationStatus: "drafting",
      generationStage: "examples",
      generationError: ""
    }));
    console.log(`[personality-tests] enrich-copy-ready id=${id} duration_ms=${Date.now() - copyStartedAt}`);

    const examplesStartedAt = Date.now();
    const enrichedSystem = await generatePersonalitySystem(
      {
        ...config,
        generatedSystem: copySystem
      },
      { mode: "examples" }
    );
    await updateGeneratedTest(id, (current) => ({
      ...current,
      generatedSystem: enrichedSystem,
      generationStatus: "ready",
      generationStage: "ready",
      generationError: ""
    }));
    console.log(
      `[personality-tests] enrich-ready id=${id} duration_ms=${Date.now() - startedAt} examples_ms=${Date.now() - examplesStartedAt}`
    );
  } catch (error) {
    await updateGeneratedTest(id, (current) => ({
      ...current,
      generationStatus: "failed",
      generationStage: current?.generationStage || "copy",
      generationError: error.message || "结果卡补全失败"
    }));
    console.error(`[personality-tests] enrich-failed id=${id}:`, error);
  }
}

async function updateGeneratedTest(id, updater) {
  const current = await getGeneratedTest(id);
  if (!current) return null;
  const next = updater(current);
  await saveGeneratedTest(id, next);
  return next;
}

async function getGameState(code, roomId) {
  if (gameStates.has(code)) return gameStates.get(code);
  const result = await pool.query("SELECT state_json FROM games WHERE room_id = $1", [roomId]);
  if (!result.rows.length) return null;
  const state = JSON.parse(result.rows[0].state_json);
  gameStates.set(code, state);
  return state;
}

function subscribeSocket(ws, roomCode) {
  ws.roomCode = roomCode;
  if (!roomSockets.has(roomCode)) roomSockets.set(roomCode, new Set());
  roomSockets.get(roomCode).add(ws);
}

function broadcastRoom(roomCode, fn) {
  const set = roomSockets.get(roomCode);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) fn(ws);
  }
}
