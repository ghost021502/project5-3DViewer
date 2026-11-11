// Project 5 - Multi-User Babylon.js GLB Model Viewer
// Created by Irvin Luna. Adapted from the BabylonJS_glb.js class starter.

const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);
const fileInput = document.getElementById('glbFileInput');
const uploadButton = document.getElementById('uploadButton');
const exampleModels = document.getElementById('exampleModels');
const loadExampleButton = document.getElementById('loadExampleButton');
const hostControls = document.getElementById('hostControls');
const spectatorMessage = document.getElementById('spectatorMessage');
const connectionStatus = document.getElementById('connectionStatus');
const roleStatus = document.getElementById('roleStatus');
const appMessage = document.getElementById('appMessage');

let scene;
let camera;
let currentRole = 'connecting';
let clientId = null;
let socket;
const loadedModels = new Map();
const spacing = 10;

function toRadians(degrees) {
    return degrees * Math.PI / 180.0;
}

// Each browser creates its own camera. Camera values are never sent to the server.
const createScene = async () => {
    const newScene = new BABYLON.Scene(engine);
    const yaw = 0.0;
    const pitch = toRadians(90.0);
    camera = new BABYLON.ArcRotateCamera(
        'camera', yaw, pitch, 20,
        new BABYLON.Vector3(0, 0, 0), newScene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 100;
    camera.panningSensibility = 80;

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), newScene);
    light.intensity = 0.7;
    return newScene;
};

function setMessage(message, isError = false) {
    appMessage.textContent = message;
    appMessage.style.color = isError ? '#b91c1c' : '#475569';
}

function updateRole(role) {
    currentRole = role;
    roleStatus.textContent = role === 'host' ? 'Role: Host' : 'Role: Spectator';
    roleStatus.className = `role ${role}`;
    hostControls.hidden = role !== 'host';
    spectatorMessage.hidden = role !== 'spectator';
    if (role === 'host') setMessage('You are the Host. You can upload a GLB or add an example model.');
    else setMessage('You are a Spectator. Models added by the Host will appear here.');
}

function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}`);

    socket.addEventListener('open', () => {
        connectionStatus.textContent = 'Connected';
    });

    socket.addEventListener('message', async event => {
        let data;
        try { data = JSON.parse(event.data); }
        catch (error) { setMessage('The server sent an unreadable message.', true); return; }

        if (data.type === 'role') {
            clientId = data.clientId;
            updateRole(data.role);
            if (data.role === 'host') loadAvailableExamples();
        } else if (data.type === 'state') {
            // Every browser loads its own copy of each shared model.
            for (const model of data.sceneState.models) {
                if (!loadedModels.has(model.id)) {
                    const loading = loadModelIntoScene(model);
                    loadedModels.set(model.id, loading);
                }
            }
        } else if (data.type === 'error') {
            setMessage(data.message, true);
        }
    });

    socket.addEventListener('close', () => {
        connectionStatus.textContent = 'Disconnected';
        roleStatus.textContent = 'No role';
        setMessage('The connection to the server was closed. Refresh after restarting the server.', true);
    });

    socket.addEventListener('error', () => {
        connectionStatus.textContent = 'Connection error';
    });
}

async function loadAvailableExamples() {
    try {
        const response = await fetch('/api/models');
        const result = await response.json();
        exampleModels.innerHTML = '';
        if (!result.files.length) {
            exampleModels.add(new Option('No example models found', ''));
            return;
        }
        exampleModels.add(new Option('Select an example GLB…', ''));
        result.files.forEach(fileName => exampleModels.add(new Option(fileName, fileName)));
    } catch (error) {
        setMessage('Could not load the example model list.', true);
    }
}

// This uses the same BabylonJS ImportMeshAsync workflow as the class starter.
async function loadModelIntoScene(model) {
    if (!scene) return;
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            '', '/models/', model.fileName, scene, undefined, '.glb'
        );
        if (result.meshes && result.meshes.length > 0) {
            const rootMesh = result.meshes[0];
            const bounds = rootMesh.getHierarchyBoundingVectors();
            const size = bounds.max.subtract(bounds.min);
            const largestDimension = Math.max(size.x, size.y, size.z);
            const scale = largestDimension > 0 ? 5 / largestDimension : 1;
            rootMesh.scaling = new BABYLON.Vector3(scale, scale, scale);
            const scaledBounds = rootMesh.getHierarchyBoundingVectors();
            const scaledSize = scaledBounds.max.subtract(scaledBounds.min);
            const center = scaledBounds.min.add(scaledSize.scale(0.5));
            const position = model.position || { x: 0, y: 0, z: 0 };
            rootMesh.position = new BABYLON.Vector3(
                Number(position.x) - center.x,
                Number(position.y) - center.y,
                Number(position.z) - center.z
            );
            setMessage(`Loaded model: ${model.fileName}`);
        }
    } catch (error) {
        console.error('Error loading GLB model:', error);
        setMessage(`Could not load ${model.fileName}. Check the browser console.`, true);
        loadedModels.delete(model.id);
    }
}

function getNextPosition() {
    const index = loadedModels.size;
    if (index === 0) return { x: 0, y: 0, z: 0 };
    const step = Math.ceil(index / 2);
    const x = index % 2 === 1 ? -step * spacing : step * spacing;
    return { x, y: 0, z: 0 };
}

function tellServerToLoad(fileName) {
    if (currentRole !== 'host' || !socket || socket.readyState !== WebSocket.OPEN) {
        setMessage('Only the connected Host can add models.', true);
        return;
    }
    socket.send(JSON.stringify({
        type: 'loadModel',
        fileName,
        position: getNextPosition()
    }));
}

uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        setMessage('Choose a .glb file before uploading.', true);
        return;
    }
    if (!file.name.toLowerCase().endsWith('.glb')) {
        setMessage('Please choose a file with the .glb extension.', true);
        return;
    }
    uploadButton.disabled = true;
    setMessage('Uploading GLB model…');
    try {
        const formData = new FormData();
        formData.append('model', file);
        const response = await fetch('/upload', {
            method: 'POST',
            headers: { 'x-client-id': clientId },
            body: formData
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Upload failed.');
        tellServerToLoad(result.fileName);
        fileInput.value = '';
    } catch (error) {
        setMessage(error.message, true);
    } finally {
        uploadButton.disabled = false;
    }
});

loadExampleButton.addEventListener('click', () => {
    const fileName = exampleModels.value;
    if (!fileName) {
        setMessage('Select an example model first.', true);
        return;
    }
    tellServerToLoad(fileName);
});

(async () => {
    scene = await createScene();
    connectWebSocket();
})();

engine.runRenderLoop(() => {
    if (scene) scene.render();
});

window.addEventListener('resize', () => engine.resize());
