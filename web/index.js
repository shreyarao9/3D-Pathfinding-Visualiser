import init, { Pathfinding } from "./pkg/astar_wasm.js";

let gl;
let shaderProgram;
let pathfinding;
let gridWidth = 5;  // Changed to 5x5
let gridHeight = 5;
let obstacles = new Set();
let path = [];
let isPathfinding = false;
let animationIndex;
let colorBuffer;

let rotationX = 0;
let rotationY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

const canvas = document.getElementById("glCanvas");
const startButton = document.getElementById("start-button");
const resetButton = document.getElementById("reset-button");

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

    // Allocate an initial color array (adjust the size as necessary)
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
        -0.1, -0.1,  0.1,  0.1, -0.1,  0.1,  0.1,  0.1,  0.1,
        -0.1, -0.1,  0.1,  0.1,  0.1,  0.1, -0.1,  0.1,  0.1,

        // Back face
        -0.1, -0.1, -0.1, -0.1,  0.1, -0.1,  0.1,  0.1, -0.1,
        -0.1, -0.1, -0.1,  0.1,  0.1, -0.1,  0.1, -0.1, -0.1,

        // Top face
        -0.1,  0.1, -0.1, -0.1,  0.1,  0.1,  0.1,  0.1,  0.1,
        -0.1,  0.1, -0.1,  0.1,  0.1,  0.1,  0.1,  0.1, -0.1,

        // Bottom face
        -0.1, -0.1, -0.1,  0.1, -0.1, -0.1,  0.1, -0.1,  0.1,
        -0.1, -0.1, -0.1,  0.1, -0.1,  0.1, -0.1, -0.1,  0.1,

        // Right face
        0.1, -0.1, -0.1,  0.1,  0.1, -0.1,  0.1,  0.1,  0.1,
        0.1, -0.1, -0.1,  0.1,  0.1,  0.1,  0.1, -0.1,  0.1,

        // Left face
        -0.1, -0.1, -0.1, -0.1, -0.1,  0.1, -0.1,  0.1,  0.1,
        -0.1, -0.1, -0.1, -0.1,  0.1,  0.1, -0.1,  0.1, -0.1
    ];

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(shaderProgram, "aPosition");
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
}

function drawGrid() {
    console.log("Drawing grid...");
    const cellSize = 0.4;

    // Create projection matrix
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 10.0);

    // Create view matrix with rotation
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [1.5, 1.5, 2.5], [0.5, 0.5, 0], [0, 1, 0]);

    // Apply rotation from mouse input
    mat4.rotateX(viewMatrix, viewMatrix, rotationX);
    mat4.rotateY(viewMatrix, viewMatrix, rotationY);

    gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "uProjectionMatrix"), false, projectionMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "uViewMatrix"), false, viewMatrix);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Render each cube in the grid
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            let color = [0.3, 0.3, 0.6];  // Default Blue

            const key = `${x},${y}`;
            if (obstacles.has(key)) color = [1.0, 0.0, 0.0];  // Red for obstacle
            if (path.some(p => p[0] === x && p[1] === y)) color = [1.0, 1.0, 0.0];  // Yellow for path

            drawCube(x * cellSize, y * cellSize, 0, cellSize, color);
        }
    }
}

function drawCube(x, y, z, cellSize, color) {
    const uColorLocation = gl.getUniformLocation(shaderProgram, "uColor");
    gl.uniform3fv(uColorLocation, new Float32Array(color));

    const modelMatrix = mat4.create();
    mat4.translate(modelMatrix, modelMatrix, [x, y, z]);

    const uModelMatrix = gl.getUniformLocation(shaderProgram, "uModelMatrix");
    gl.uniformMatrix4fv(uModelMatrix, false, modelMatrix);

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

    console.log("Ray Origin:", rayOrigin);
    console.log("Ray Direction:", rayDirection);

    // Intersect ray with grid cells
    let hit = null;
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            const cellCenter = vec3.fromValues(x * 0.4, y * 0.4, 0);
            const cellSize = 0.2;

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

        if (obstacles.has(key)) {
            obstacles.delete(key);
            pathfinding.clear_obstacle(gridX, gridY);
            colorCube(gridX, gridY, [0.3, 0.3, 0.6]); // Default color
        } else {
            obstacles.add(key);
            pathfinding.set_obstacle(gridX, gridY);
            colorCube(gridX, gridY, [1.0, 0.0, 0.0]); // Red for obstacle
        }

        drawGrid();  // Redraw grid
    }
});

resetButton.addEventListener("click", drawGrid);

startButton.addEventListener("click", () => {
    console.log("Obstacle Positions:", Array.from(obstacles));
    if (isPathfinding) return;

    const start = [0, 0];  // Starting point
    const end = [gridWidth - 1, gridHeight - 1];  // Goal point

    // Get obstacles in the format the WASM module expects
    const obstacleArray = Array.from(obstacles).map(key => key.split(",").map(Number));

    path = pathfinding.find_path(start[0], start[1], end[0], end[1], obstacleArray);

    if (path.length === 0) {
        alert("No path found!");
        return;
    }

    isPathfinding = true;
    animationIndex = 0;
    animatePath();
});

window.onload = initWebGL;
