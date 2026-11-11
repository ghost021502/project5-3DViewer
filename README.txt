CS 310 - Project 5
Multi-User Babylon.js GLB Model Viewer
Created by Irvin Luna

CONTENTS
- server.js: Express web server, WebSocket server, Host/Spectator roles, shared scene state, and GLB upload route.
- public/index.html: Browser page and Babylon.js library references.
- public/client.js: Babylon.js scene/camera, model loading, upload controls, and WebSocket client.
- public/style.css: Page and viewer styling.
- public/models/: Example GLB files supplied with the BabylonJS class starter.
- starter/: Original BabylonJS HTML/CSS/JS starter files supplied in Babylon.zip, kept for reference.

REQUIREMENTS
- Node.js installed on the computer.
- Internet access when opening the viewer so the Babylon.js CDN libraries can load.

HOW TO RUN
1. Extract Project5_Irvin_Luna.zip.
2. Open the extracted Project5_Irvin_Luna folder in Visual Studio Code.
3. Open Terminal > New Terminal. Make sure the terminal is in the folder containing server.js and package.json.
4. Run: npm install
5. Run: npm start
6. Wait for: Project 5 server is running at http://localhost:3000
7. Open a browser and go to: http://localhost:3000

HOW TO TEST MULTIPLE USERS
1. Open http://localhost:3000 in the first browser window. It becomes the Host.
2. Open the same address in a second browser window or an incognito window. It becomes a Spectator.
3. As Host, choose an example GLB from the list and click Add example, OR choose a .glb file from your computer and click Upload and add model.
4. The model should appear in both browser windows.
5. Rotate, zoom, and pan the camera in each window. The camera movement in one window should not change the other window.
6. Additional browser windows connect as Spectators.

IMPORTANT NOTES
- Keep the terminal/server running while testing. Press Ctrl+C in the terminal to stop it.
- The first connected browser is Host. If the Host disconnects, the next connected client is promoted to Host.
- Only the Host can upload or add models. Spectators can move their own camera.
- The server shares model names, IDs, and positions. Each browser loads its own copy of the GLB. Camera position/rotation and browser size remain local.
- Uploaded models are saved in public/models on the server. The sample GLB files are already included there.
- Submit the ZIP file to Canvas as required by the assignment. Do not include node_modules; npm install recreates it.

CLASS STARTER CODE
The starter folder preserves the supplied BabylonJS_glb.html, BabylonJS_glb.js, and BabylonJS_glb.css files. The application client uses the same BabylonJS Engine, Scene, ArcRotateCamera, HemisphericLight, ImportMeshAsync, render loop, and resize-event approach, adapted for shared multi-user scene state.
