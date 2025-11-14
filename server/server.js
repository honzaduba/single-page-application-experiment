// server.js

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middlewares
// povolí všechno odkudkoliv – na testy stačí
app.use(cors());
// parsuje JSON body
app.use(express.json());                                
// vše v ./public servíruj jako statické 
app.use(express.static(path.join(__dirname, 'public')));


// ---- Fake "databáze" ----

const demoUser = {
    id: 1,
    username: 'test',
    password: 'test', // jen pro demo, v reálu nikdy takhle :)
    name: 'Testovací Uživatel',
    email: 'test@example.com',
    role: 'admin'
};

// Jednoduché in-memory úložiště tokenů
const authTokens = new Map();    // authToken -> { userId, expiresAt }
const refreshTokens = new Map(); // refreshToken -> { userId, expiresAt }

function createToken(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// 5 minut platnosti access tokenu
const ACCESS_TOKEN_LIFETIME_MS = 5 * 60 * 1000;
// 1 hodina platnosti refresh tokenu
const REFRESH_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

// ---- Helpery ----

function issueTokensForUser(user) {
    const now = Date.now();

    const authToken = createToken('auth');
    const refreshToken = createToken('refresh');

    const authExpiresAt = now + ACCESS_TOKEN_LIFETIME_MS;
    const refreshExpiresAt = now + REFRESH_TOKEN_LIFETIME_MS;

    authTokens.set(authToken, {
        userId: user.id,
        expiresAt: authExpiresAt
    });

    refreshTokens.set(refreshToken, {
        userId: user.id,
        expiresAt: refreshExpiresAt
    });

    return {
        authToken,
        refreshToken,
        expiresAt: authExpiresAt
    };
}

function getUserById(id) {
    // tady máme jen jednoho usera
    return demoUser.id === id ? demoUser : null;
}

function authenticateAuthToken(req) {
    const authHeader = req.headers['authorization'] || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;

    const token = match[1];
    const tokenInfo = authTokens.get(token);
    if (!tokenInfo) return null;

    if (Date.now() >= tokenInfo.expiresAt) {
        authTokens.delete(token);
        return null;
    }

    const user = getUserById(tokenInfo.userId);
    if (!user) return null;

    return user;
}

// ---- Endpoints ----

// POST /auth/login
// Body: { username, password }
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }

    // totálně triviální kontrola
    if (username !== demoUser.username || password !== demoUser.password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { authToken, refreshToken, expiresAt } = issueTokensForUser(demoUser);

    return res.json({
        authToken,
        refreshToken,
        expiresAt, // ms timestamp
        user: {
            id: demoUser.id,
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role
        }
    });
});

// POST /auth/refresh
// Body: { refreshToken }
app.post('/auth/refresh', (req, res) => {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
        return res.status(400).json({ error: 'refreshToken is required' });
    }

    const info = refreshTokens.get(refreshToken);
    if (!info) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (Date.now() >= info.expiresAt) {
        refreshTokens.delete(refreshToken);
        return res.status(401).json({ error: 'Refresh token expired' });
    }

    const user = getUserById(info.userId);
    if (!user) {
        refreshTokens.delete(refreshToken);
        return res.status(401).json({ error: 'User not found' });
    }

    // vystavíme nový auth token (můžeš se rozhodnout, jestli rotovat i refresh)
    const now = Date.now();
    const newAuthToken = createToken('auth');
    const newAuthExpiresAt = now + ACCESS_TOKEN_LIFETIME_MS;

    authTokens.set(newAuthToken, {
        userId: user.id,
        expiresAt: newAuthExpiresAt
    });

    // volitelně: refresh token můžeme "prodloužit"
    const newRefreshToken = refreshToken; // nebo createToken('refresh') a aktualizovat mapu
    const newRefreshExpiresAt = info.expiresAt; // nebo now + REFRESH_TOKEN_LIFETIME_MS

    refreshTokens.set(newRefreshToken, {
        userId: user.id,
        expiresAt: newRefreshExpiresAt
    });

    return res.json({
        authToken: newAuthToken,
        refreshToken: newRefreshToken,
        expiresAt: newAuthExpiresAt
    });
});

// GET /auth/me
// vyžaduje Authorization: Bearer <authToken>
app.get('/auth/me', (req, res) => {
    const user = authenticateAuthToken(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    });
});

// Ukázkový chráněný endpoint
// GET /api/hello
app.get('/api/hello', (req, res) => {
    const user = authenticateAuthToken(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json({
        message: `Ahoj, ${user.name}!`,
        time: new Date().toISOString()
    });
});

// ---- Start serveru ----

app.listen(PORT, () => {
    console.log(`Test API server running at http://localhost:${PORT}`);
});
