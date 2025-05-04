import init, { Pathfinding } from "../pkg/astar_wasm.js";

let gl;
let shaderProgram;
let pathfinding;
let gridWidth = 5;
let gridHeight = 5;
let obstacles = new Set();
let path = [];
let isPathfinding = false;
let animationIndex;
let colorBuffer;
let normalBuffer;

let startPoint = [0, 0]; // Default start point
let endPoint = [gridWidth - 1, gridHeight - 1]; // Default end point
let selectionMode = "none"; // "none", "start", or "end"

let rotationX = 0;
let rotationY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

const canvas = document.getElementById("glCanvas");
const startButton = document.getElementById("start-button");
const resetButton = document.getElementById("reset-button");
const selectStartButton = document.getElementById("select-start-button")
const selectEndButton = document.getElementById("select-end-button")

async function initWebGL() {
    console.log("Initializing WebGL...");
    gl = canvas.getContext("webgl");
    if (!gl) {
        alert("WebGL not supported!");
        return;
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    await init(); // Load and initialize the WASM module
    pathfinding = new Pathfinding(gridWidth, gridHeight);

    const vsSource = document.getElementById("vertex-shader").text;
    const fsSource = document.getElementById("fragment-shader").text;
    shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    gl.useProgram(shaderProgram);
    gl.enable(gl.DEPTH_TEST);

    // Initialize the color buffer
    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

    // Allocate an initial color array
    const initialColors = new Float32Array(gridWidth * gridHeight * 6 * 3).fill(0.0); // All black initially
    gl.bufferData(gl.ARRAY_BUFFER, initialColors, gl.DYNAMIC_DRAW);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    initBuffers();
    drawGrid();
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Unable to initialize the shader program:", gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("An error occurred compiling the shaders:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function initBuffers() {
    const vertices = [
        // Front face
        -0.2, -0.2,  0.2,  0.2, -0.2,  0.2,  0.2,  0.2,  0.2,
        -0.2, -0.2,  0.2,  0.2,  0.2,  0.2, -0.2,  0.2,  0.2,

        // Back face
        -0.2, -0.2, -0.2, -0.2,  0.2, -0.2,  0.2,  0.2, -0.2,
        -0.2, -0.2, -0.2,  0.2,  0.2, -0.2,  0.2, -0.2, -0.2,

        // Top face
        -0.2,  0.2, -0.2, -0.2,  0.2,  0.2,  0.2,  0.2,  0.2,
        -0.2,  0.2, -0.2,  0.2,  0.2,  0.2,  0.2,  0.2, -0.2,

        // Bottom face
        -0.2, -0.2, -0.2,  0.2, -0.2, -0.2,  0.2, -0.2,  0.2,
        -0.2, -0.2, -0.2,  0.2, -0.2,  0.2, -0.2, -0.2,  0.2,

        // Right face
        0.2, -0.2, -0.2,  0.2,  0.2, -0.2,  0.2,  0.2,  0.2,
        0.2, -0.2, -0.2,  0.2,  0.2,  0.2,  0.2, -0.2,  0.2,

        // Left face
        -0.2, -0.2, -0.2, -0.2, -0.2,  0.2, -0.2,  0.2,  0.2,
        -0.2, -0.2, -0.2, -0.2,  0.2,  0.2, -0.2,  0.2, -0.2
    ];

    // Define normal vectors for each vertex
    const normals = [
        // Front face - normal pointing towards +Z
        0, 0, 1,  0, 0, 1,  0, 0, 1,
        0, 0, 1,  0, 0, 1,  0, 0, 1,

        // Back face - normal pointing towards -Z
        0, 0, -1,  0, 0, -1,  0, 0, -1,
        0, 0, -1,  0, 0, -1,  0, 0, -1,

        // Top face - normal pointing towards +Y
        0, 1, 0,  0, 1, 0,  0, 1, 0,
        0, 1, 0,  0, 1, 0,  0, 1, 0,

        // Bottom face - normal pointing towards -Y
        0, -1, 0,  0, -1, 0,  0, -1, 0,
        0, -1, 0,  0, -1, 0,  0, -1, 0,

        // Right face - normal pointing towards +X
        1, 0, 0,  1, 0, 0,  1, 0, 0,
        1, 0, 0,  1, 0, 0,  1, 0, 0,

        // Left face - normal pointing towards -X
        -1, 0, 0,  -1, 0, 0,  -1, 0, 0,
        -1, 0, 0,  -1, 0, 0,  -1, 0, 0
    ];

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(shaderProgram, "a_position");
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);

    // Normal buffer
    normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    const aNormal = gl.getAttribLocation(shaderProgram, "a_normal");
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNormal);
}

function drawGrid() {
    const cellSize = 0.5;

    // Create projection matrix
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 10.0);

    // Create view matrix with rotation
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [1.5, 1.5, 2.5], [0.5, 0.5, 0], [0, 1, 0]);

    // Apply rotation from mouse input
    mat4.rotateX(viewMatrix, viewMatrix, rotationX);
    mat4.rotateY(viewMatrix, viewMatrix, rotationY);

    // Set light direction uniforms
    const lightDirection = vec3.fromValues(1.0, 1.0, 1.0); // Light coming from top-right-front
    vec3.normalize(lightDirection, lightDirection);
    const uLightDirection = gl.getUniformLocation(shaderProgram, "u_lightDirection");
    gl.uniform3fv(uLightDirection, lightDirection);

    // Set projection matrix uniform
    const uProjectionMatrix = gl.getUniformLocation(shaderProgram, "u_projectionMatrix");
    gl.uniformMatrix4fv(uProjectionMatrix, false, projectionMatrix);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Render each cube in the grid
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            let color = [0.3, 0.3, 0.6, 1.0];  // Default Blue

            const key = `${x},${y}`;
            if (obstacles.has(key)) {
                color = [1.0, 0.0, 0.0, 1.0];  // Red for obstacle
            }
            if (path.some(p => p[0] === x && p[1] === y)) {
                color = [1.0, 1.0, 0.0, 1.0];  // Yellow for path
            }
            // Highlight start and end points with yellow
            if ((x === startPoint[0] && y === startPoint[1]) ||
                (x === endPoint[0] && y === endPoint[1])) {
                color = [1.0, 1.0, 0.0, 1.0];  // Yellow for start/end
            }
            drawCube(x * cellSize, y * cellSize, 0, cellSize, color);
        }
    }
}

function drawCube(x, y, z, cellSize, color) {
    // Set color uniform
    const uColorLocation = gl.getUniformLocation(shaderProgram, "u_color");
    gl.uniform4fv(uColorLocation, new Float32Array(color));

    // Create model matrix
    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [x, y, z]);

    // Create model-view matrix
    const modelViewMatrix = mat4.create();

    // Create view matrix
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [1.5, 1.5, 2.5], [0.5, 0.5, 0], [0, 1, 0]);

    // Apply rotations
    mat4.rotateX(viewMatrix, viewMatrix, rotationX);
    mat4.rotateY(viewMatrix, viewMatrix, rotationY);

    // Combine view and model matrices
    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);

    // Pass model-view matrix to shader
    const uModelViewMatrix = gl.getUniformLocation(shaderProgram, "u_modelViewMatrix");
    gl.uniformMatrix4fv(uModelViewMatrix, false, modelViewMatrix);

    // Calculate normal matrix (inverse transpose of model-view matrix)
    // This is needed to transform normals correctly
    const normalMatrix = mat4.create();
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    // Pass normal matrix to shader
    const uNormalMatrix = gl.getUniformLocation(shaderProgram, "u_normalMatrix");
    gl.uniformMatrix4fv(uNormalMatrix, false, normalMatrix);

    // Draw the cube
    gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function colorCube(x, y, color) {
    const totalCubes = gridWidth * gridHeight;
    const colors = new Float32Array(totalCubes * 6 * 3).fill(0.0);

    // Find the appropriate position in the buffer based on (x, y)
    const cubeIndex = y * gridWidth + x;

    // Update the color buffer for the specific cube
    for (let i = 0; i < 6; i++) { // Each face of the cube
        colors[cubeIndex * 6 * 3 + i * 3] = color[0];     // R
        colors[cubeIndex * 6 * 3 + i * 3 + 1] = color[1]; // G
        colors[cubeIndex * 6 * 3 + i * 3 + 2] = color[2]; // B
    }

    // Update the buffer data in WebGL
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW); // Using DYNAMIC_DRAW for frequent updates
}

function rayIntersectsCube(origin, direction, center, size) {
    const minBounds = vec3.fromValues(center[0] - size, center[1] - size, center[2] - size);
    const maxBounds = vec3.fromValues(center[0] + size, center[1] + size, center[2] + size);

    let tMin = (minBounds[0] - origin[0]) / direction[0];
    let tMax = (maxBounds[0] - origin[0]) / direction[0];

    if (tMin > tMax) [tMin, tMax] = [tMax, tMin];

    let tyMin = (minBounds[1] - origin[1]) / direction[1];
    let tyMax = (maxBounds[1] - origin[1]) / direction[1];

    if (tyMin > tyMax) [tyMin, tyMax] = [tyMax, tyMin];

    if (tMin > tyMax || tyMin > tMax) return false;

    tMin = Math.max(tMin, tyMin);
    tMax = Math.min(tMax, tyMax);

    let tzMin = (minBounds[2] - origin[2]) / direction[2];
    let tzMax = (maxBounds[2] - origin[2]) / direction[2];

    if (tzMin > tzMax) [tzMin, tzMax] = [tzMax, tzMin];

    if (tMin > tzMax || tzMin > tMax) return false;

    return true;
}

function animatePath() {
    if (animationIndex >= path.length) {
        isPathfinding = false;  // Animation complete
        return;
    }

    const [x, y] = path[animationIndex];
    animationIndex++;

    if (!obstacles.has(`${x},${y}`)) {
        colorCube(x, y, [1.0, 1.0, 0.0]); // Yellow for the path
    }

    drawGrid();  // Redraw grid to update path colors

    setTimeout(animatePath, 200);  // Adjust speed if needed
}

// Mouse event handlers for rotation
canvas.addEventListener("mousedown", (event) => {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
});

canvas.addEventListener("mouseup", () => {
    isDragging = false;
});

canvas.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;

    rotationY += deltaX * 0.01;
    rotationX += deltaY * 0.01;

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    drawGrid();  // Re-render with new rotation
});

canvas.addEventListener("click", (event) => {
    if (isPathfinding) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);

    // Convert to normalized device coordinates (NDC)
    const ndcX = (2 * x) / canvas.width - 1;
    const ndcY = 1 - (2 * y) / canvas.height;

    // Camera setup
    const cameraDistance = 2.5; // Distance from the grid
    const cameraPosition = vec3.fromValues(1.5, 1.5, cameraDistance);
    const target = vec3.fromValues(0.5, 0.5, 0);
    const up = vec3.fromValues(0, 1, 0);

    // Projection and view matrices
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 10.0);

    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, cameraPosition, target, up);
    mat4.rotateX(viewMatrix, viewMatrix, rotationX);
    mat4.rotateY(viewMatrix, viewMatrix, rotationY);

    // Inverse View-Projection matrix for transforming NDC to world coordinates
    const inverseVPMatrix = mat4.create();
    mat4.multiply(inverseVPMatrix, projectionMatrix, viewMatrix);
    mat4.invert(inverseVPMatrix, inverseVPMatrix);

    // Convert NDC coordinates into world space
    const nearPoint = vec4.fromValues(ndcX, ndcY, -1, 1);
    const farPoint = vec4.fromValues(ndcX, ndcY, 1, 1);

    vec4.transformMat4(nearPoint, nearPoint, inverseVPMatrix);
    vec4.transformMat4(farPoint, farPoint, inverseVPMatrix);

    // Normalize homogeneous coordinates
    for (let i = 0; i < 3; i++) {
        nearPoint[i] /= nearPoint[3];
        farPoint[i] /= farPoint[3];
    }

    // Compute ray origin and direction
    const rayOrigin = vec3.fromValues(nearPoint[0], nearPoint[1], nearPoint[2]);
    const rayDirection = vec3.create();
    vec3.subtract(rayDirection, farPoint.slice(0, 3), rayOrigin);
    vec3.normalize(rayDirection, rayDirection);

    // Intersect ray with grid cells
    let hit = null;
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            const cellCenter = vec3.fromValues(x * 0.4, y * 0.4, 0);
            const cellSize = 0.3;

            if (rayIntersectsCube(rayOrigin, rayDirection, cellCenter, cellSize)) {
                hit = [x, y];
                break;
            }
        }
        if (hit) break;
    }

    if (hit) {
        const [gridX, gridY] = hit;
        const key = `${gridX},${gridY}`;

        // Handle the click based on the current selection mode
        if (selectionMode === "start") {
            // First remove the cell from obstacles if it's there
            if (obstacles.has(key)) {
                obstacles.delete(key);
                pathfinding.clear_obstacle(gridX, gridY);
            }
            // Set as start point
            startPoint = [gridX, gridY];
            selectionMode = "none"; // Reset selection mode
            selectStartButton.style.backgroundColor = selectionMode === "start" ? "#FFD700" : "";
        }
        else if (selectionMode === "end") {
            // First remove the cell from obstacles if it's there
            if (obstacles.has(key)) {
                obstacles.delete(key);
                pathfinding.clear_obstacle(gridX, gridY);
            }
            // Set as end point
            endPoint = [gridX, gridY];
            selectionMode = "none"; // Reset selection mode
            selectEndButton.style.backgroundColor = selectionMode === "end" ? "#FFD700" : "";
        }
        else {
            // Don't allow setting obstacles on start or end points
            if ((gridX === startPoint[0] && gridY === startPoint[1]) ||
                (gridX === endPoint[0] && gridY === endPoint[1])) {
                return;
            }

            // Toggle obstacle
            if (obstacles.has(key)) {
                obstacles.delete(key);
                pathfinding.clear_obstacle(gridX, gridY);
            } else {
                obstacles.add(key);
                pathfinding.set_obstacle(gridX, gridY);
            }
        }

        drawGrid();  // Redraw grid
    }
});

resetButton.addEventListener("click", () => {
    // Clear obstacles and path
    obstacles.clear();
    path = [];
    // Reset start and end points to defaults
    startPoint = [0, 0];
    endPoint = [gridWidth - 1, gridHeight - 1];
    // Reset selection mode
    selectionMode = "none";
    selectStartButton.style.backgroundColor = selectionMode === "start" ? "#FFD700" : "";
    selectEndButton.style.backgroundColor = selectionMode === "end" ? "#FFD700" : "";
    // Reset the pathfinding module
    pathfinding = new Pathfinding(gridWidth, gridHeight);
    drawGrid();
});

startButton.addEventListener("click", () => {
    console.log("Obstacle Positions:", Array.from(obstacles));
    if (isPathfinding) return;

    // Get obstacles in the format the WASM module expects
    const obstacleArray = Array.from(obstacles).map(key => key.split(",").map(Number));

    path = pathfinding.find_path(
        startPoint[0], startPoint[1],
        endPoint[0], endPoint[1],
        obstacleArray
    );

    if (path.length === 0) {
        alert("No path found!");
        return;
    }

    isPathfinding = true;
    animationIndex = 0;
    animatePath();
});

selectStartButton.addEventListener("click", () => {
    selectionMode = "start";
    selectStartButton.style.backgroundColor = selectionMode === "start" ? "#FFD700" : "";
});

selectEndButton.addEventListener("click", () => {
    selectionMode = "end";
    selectEndButton.style.backgroundColor = selectionMode === "end" ? "#FFD700" : "";
});

window.onload = initWebGL;
