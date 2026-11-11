// Project 5 - Multi-User Babylon.js GLB Model Viewer
// Created by Irvin Luna
// Based on the BabylonJS GLB viewer starter code provided for class.

const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const publicFolder = path.join(__dirname, 'public');
const modelsFolder = path.join(publicFolder, 'models');
fs.mkdirSync(modelsFolder, { recursive: true });

// The server stores model information, not the GLB file contents.
let sceneState = { models: [] };
let host = null;
let nextModelNumber = 1;
const clientRoles = new Map();

app.use(express.static(publicFolder));
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, modelsFolder),
    filename: (req, file, callback) => {
        const safeOriginal = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeOriginal}`;
        callback(null, uniqueName);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (path.extname(file.originalname).toLowerCase() !== '.glb') {
            return callback(new Error('Only .glb files are allowed.'));
        }
        callback(null, true);
    }
});

// Let the browser populate its example-model list from public/models.
app.get('/api/models', (req, res) => {
    const files = fs.readdirSync(modelsFolder)
        .filter(name => name.toLowerCase().endsWith('.glb'))
        .sort((a, b) => a.localeCompare(b));
    res.json({ files });
});

// Only the currently assigned Host may upload a GLB file.
app.post('/upload', (req, res) => {
    const clientId = req.get('x-client-id');
    const client = [...wss.clients].find(ws => ws.clientId === clientId && ws.readyState === WebSocket.OPEN);
    if (!client || client !== host) {
        return res.status(403).json({ error: 'Only the Host can upload a model.' });
    }
    upload.single('model')(req, res, error => {
        if (error) {
            return res.status(400).json({ error: error.message || 'Upload failed.' });
        }
        if (!req.file) return res.status(400).json({ error: 'Choose a GLB file first.' });
        res.json({ fileName: req.file.filename });
    });
});

function sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

// Broadcast shared scene contents to every connected browser.
function broadcastState() {
    const payload = JSON.stringify({ type: 'state', sceneState });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
}

function updateRoles() {
    // The first connected client is Host. If the Host leaves, the next client is promoted.
    const connected = [...wss.clients].filter(client => client.readyState === WebSocket.OPEN);
    host = connected[0] || null;
    connected.forEach(client => {
        const role = client === host ? 'host' : 'spectator';
        clientRoles.set(client.clientId, role);
        sendToClient(client, { type: 'role', role, clientId: client.clientId });
        sendToClient(client, { type: 'state', sceneState });
    });
}

wss.on('connection', ws => {
    ws.clientId = crypto.randomUUID();
    updateRoles();

    ws.on('message', message => {
        let data;
        try {
            data = JSON.parse(message.toString());
        } catch (error) {
            sendToClient(ws, { type: 'error', message: 'Invalid message received.' });
            return;
        }

        if (data.type === 'loadModel') {
            // Reject requests from Spectators; only the Host controls shared scene contents.
            if (ws !== host) {
                sendToClient(ws, { type: 'error', message: 'Only the Host can add models.' });
                return;
            }
            const fileName = path.basename(String(data.fileName || ''));
            if (!fileName.toLowerCase().endsWith('.glb') || !fs.existsSync(path.join(modelsFolder, fileName))) {
                sendToClient(ws, { type: 'error', message: 'That GLB model is not available on the server.' });
                return;
            }
            const p = data.position || {};
            const position = {
                x: Number.isFinite(Number(p.x)) ? Number(p.x) : 0,
                y: Number.isFinite(Number(p.y)) ? Number(p.y) : 0,
                z: Number.isFinite(Number(p.z)) ? Number(p.z) : 0
            };
            sceneState.models.push({
                id: `model-${nextModelNumber++}`,
                fileName,
                position
            });
            broadcastState();
        }
    });

    ws.on('close', () => {
        clientRoles.delete(ws.clientId);
        updateRoles();
    });
});

server.listen(PORT, () => {
    console.log(`Project 5 server is running at http://localhost:${PORT}`);
    console.log('The first connected browser is the Host; later browsers are Spectators.');
});
