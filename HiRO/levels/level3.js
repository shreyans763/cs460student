// ====== LEVEL 3: INSIDEOUT – 5x5 GRID, HOUSE WITH RAIN WALLS ======

const GRID_SIZE = 5;
const GRID_STEP = 2.0;
const GRID_HALF_SPAN = (GRID_SIZE * GRID_STEP) * 0.5;

function gridToWorld(row, col) {
  const x = -GRID_HALF_SPAN + GRID_STEP * 0.5 + col * GRID_STEP;
  const z = -GRID_HALF_SPAN + GRID_STEP * 0.5 + row * GRID_STEP;
  return new THREE.Vector3(x, 0, z);
}

let level3Group = null;
let level3Nodes = [];
let level3NodeById = {};

let level3Connections = [];
let level3IsDrawing = false;
let level3ActiveConn = null;
let level3ActiveStartId = null;
window.level3Completed = false;

let level3Tiles = [];
let level3AllTilesLit = false;

let level3RainMaterials = [];
let level3RoofMeshes = [];

// === Colliders so walls are solid (enter only via door) ===
let level3Colliders = [];
const LEVEL3_PLAYER_RADIUS = 0.38;
let level3RoofLight = null;

let level3DoorPortal = null;
let level3DoorCenter = null;
let level3HouseHalfD = null;

// =============================================================
// RAIN SHADER (walls) - WORLD SPACE (no UV stretching)
// =============================================================
function createRainMaterial(axis /* 0 => use world X, 1 => use world Z */) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0.0 },
      u_axis: { value: axis ? 1.0 : 0.0 },
      u_colsPerUnit: { value: 3.8 },
      u_speed: { value: 1.35 },
      u_yFreq: { value: 1.15 },
      u_thickness: { value: 0.10 },
      u_tail: { value: 0.34 }
    },
    transparent: false,
    side: THREE.DoubleSide,

    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      varying vec3 vWorldPos;

      uniform float u_time;
      uniform float u_axis;
      uniform float u_colsPerUnit;
      uniform float u_speed;
      uniform float u_yFreq;
      uniform float u_thickness;
      uniform float u_tail;

      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }

      void main() {
        vec3 base = vec3(0.02, 0.02, 0.03);

        float h = (u_axis < 0.5) ? vWorldPos.x : vWorldPos.z;

        float cols = u_colsPerUnit;
        float colF = h * cols;
        float colId = floor(colF);
        float colX  = fract(colF);

        float rnd = hash(colId * 19.13 + 7.77);

        float y = vWorldPos.y * u_yFreq;
        float speed = mix(0.9, 1.7, rnd) * u_speed;

        float phase = fract(u_time * speed + y + rnd * 11.0);

        float core = smoothstep(u_thickness, 0.0, abs(colX - 0.5));

        float head = smoothstep(0.08, 0.0, phase);
        float tail = smoothstep(u_tail, 0.0, phase) * (1.0 - head);

        float intensity = core * (head * 1.25 + tail * 0.85);

        float sparkle = step(0.985, rnd) * smoothstep(0.03, 0.0, abs(phase - 0.12));
        intensity += sparkle * core * 0.35;

        vec3 rain = vec3(1.0) * intensity;
        vec3 col = base + rain;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  });

  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -1;

  return mat;
}

function createRainWall(width, height, position, rotationY) {
  const geo = new THREE.PlaneGeometry(width, height);

  const ry = rotationY || 0;
  const isSide = Math.abs(Math.abs(ry) - Math.PI / 2) < 0.001;
  const mat = createRainMaterial(isSide ? 1 : 0);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.rotation.y = rotationY || 0;

  level3Group.add(mesh);
  level3RainMaterials.push(mat);
  return mesh;
}

function addBoxCollider(center, size) {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mat = new THREE.MeshBasicMaterial({ visible: false });
  const box = new THREE.Mesh(geo, mat);
  box.position.copy(center);
  level3Group.add(box);
  box.userData.aabb = new THREE.Box3().setFromObject(box);
  level3Colliders.push(box);
  return box;
}

function resolveLevel3Collisions() {
  const p = camera.position;
  const r = LEVEL3_PLAYER_RADIUS;
  const Y_GRACE = 0.10;

  for (const c of level3Colliders) {
    c.userData.aabb.setFromObject(c);
    const b = c.userData.aabb;

    if (p.y < b.min.y - Y_GRACE || p.y > b.max.y + Y_GRACE) continue;

    const cx = THREE.MathUtils.clamp(p.x, b.min.x, b.max.x);
    const cz = THREE.MathUtils.clamp(p.z, b.min.z, b.max.z);

    const dx = p.x - cx;
    const dz = p.z - cz;

    const dist2 = dx * dx + dz * dz;
    if (dist2 < r * r) {
      const dist = Math.max(0.00001, Math.sqrt(dist2));
      const push = (r - dist);

      p.x += (dx / dist) * push;
      p.z += (dz / dist) * push;
    }
  }
}

// =============================================================
// CONNECTION RULES / ORDER
// =============================================================

function isLastOnlyConnection(connId) {
  return connId === "vehaan-ram" || connId === "shiven-ram";
}

function prereqConnectionsDoneForLast() {
  const need = ["vehaan-chitti", "vehaan-balaram", "shiven-lohith", "shiven-gang"];
  return need.every(id => level3Connections.find(c => c.id === id)?.completed);
}

function canStartConnection(conn) {
  if (conn.completed) return false;
  if (isLastOnlyConnection(conn.id)) {
    return prereqConnectionsDoneForLast();
  }
  return true;
}

function areAllConnectionsComplete() {
  return level3Connections.every(c => c.completed);
}

function findStartableConnectionNearPlayer() {
  const camPos = camera.position;
  let best = null;
  let bestDist = Infinity;

  for (const conn of level3Connections) {
    if (!canStartConnection(conn)) continue;

    const a = level3NodeById[conn.fromId];
    const b = level3NodeById[conn.toId];

    const da = camPos.distanceTo(a.pos.clone().setY(camPos.y));
    const db = camPos.distanceTo(b.pos.clone().setY(camPos.y));

    if (da < 1.6 && da < bestDist) {
      best = { conn, startId: conn.fromId };
      bestDist = da;
    }
    if (db < 1.6 && db < bestDist) {
      best = { conn, startId: conn.toId };
      bestDist = db;
    }
  }

  return best;
}

// =============================================================
// INIT
// =============================================================
function initLevel3() {
  console.log("initLevel3() – HOUSE / TILE VERSION");
  currentLevel = 3;

  // --- Clean Level 1 ---
  if (level1Floor) { scene.remove(level1Floor); level1Floor = null; }
  if (level1Walls && level1Walls.length) { level1Walls.forEach(w => scene.remove(w)); level1Walls = []; }
  if (level1Spots && level1Spots.length) { level1Spots.forEach(s => scene.remove(s)); level1Spots = []; }
  if (level1CenterPortal) { scene.remove(level1CenterPortal); level1CenterPortal = null; }

  // --- Clean Level 2 ---
  if (typeof irisFloor !== "undefined" && irisFloor) { scene.remove(irisFloor); irisFloor = null; }
  if (typeof irisRoof !== "undefined" && irisRoof) { scene.remove(irisRoof); irisRoof = null; }
  if (typeof irisRoomWalls !== "undefined" && irisRoomWalls.length) { irisRoomWalls.forEach(w => scene.remove(w)); irisRoomWalls = []; }
  if (typeof irisWallGroup !== "undefined" && irisWallGroup) { scene.remove(irisWallGroup); irisWallGroup = null; }
  if (typeof irisClueHud !== "undefined" && irisClueHud && irisClueHud.parentElement) { irisClueHud.parentElement.removeChild(irisClueHud); irisClueHud = null; }

  if (window.irisTopPortal) {
    scene.remove(window.irisTopPortal);
    window.irisTopPortal = null;
  }

  // --- Clear old Level 3 ---
  if (level3Group) scene.remove(level3Group);

  level3Group = new THREE.Group();
  scene.add(level3Group);

  level3Nodes = [];
  level3NodeById = {};
  level3Connections = [];
  level3IsDrawing = false;
  level3ActiveConn = null;
  level3ActiveStartId = null;
  window.level3Completed = false;

  level3Tiles = [];
  level3AllTilesLit = false;
  level3RainMaterials = [];
  level3RoofMeshes = [];

  level3Colliders = [];
  level3RoofLight = null;

  level3DoorPortal = null;
  level3DoorCenter = null;
  level3HouseHalfD = null;

  // ===========================================================
  // OUTER GROUND
  // ===========================================================
  const outerGroundGeo = new THREE.PlaneGeometry(80, 80);
  const outerGroundMat = new THREE.MeshStandardMaterial({
    color: 0x020308,
    metalness: 0.15,
    roughness: 0.95
  });
  const outerGround = new THREE.Mesh(outerGroundGeo, outerGroundMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.002;
  level3Group.add(outerGround);

  // ===========================================================
  // HOUSE FLOOR
  // ===========================================================
  const houseInnerWidth = GRID_SIZE * GRID_STEP;   // 10
  const houseInnerDepth = GRID_SIZE * GRID_STEP;   // 10
  const houseHalfW = houseInnerWidth * 0.5;
  const houseHalfD = houseInnerDepth * 0.5;
  level3HouseHalfD = houseHalfD;
  const wallHeight = 5.0;

  const floorGeo = new THREE.PlaneGeometry(
    houseInnerWidth + 0.6,
    houseInnerDepth + 0.6
  );
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0.35,
    roughness: 0.9
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  level3Group.add(floor);

  // ===========================================================
  // 5×5 TILES
  // ===========================================================
  const tileGap = 0.08;
  const tileSize = GRID_STEP - tileGap;

  for (let r = 0; r < GRID_SIZE; r++) {
    const rowArr = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const tileGeo = new THREE.PlaneGeometry(tileSize, tileSize);
      const tileMat = new THREE.MeshStandardMaterial({
        color: 0x050505,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
        metalness: 0.2,
        roughness: 0.9
      });

      const tile = new THREE.Mesh(tileGeo, tileMat);
      tile.rotation.x = -Math.PI / 2;

      const pos = gridToWorld(r, c);
      tile.position.set(pos.x, 0.001, pos.z);

      tile.userData.row = r;
      tile.userData.col = c;
      tile.userData.onPath = false;
      tile.userData.pathColor = null;
      tile.userData.completed = false;

      tile.userData.ownerConnId = null;
      tile.userData.isNodeTile = false;

      level3Group.add(tile);
      rowArr.push(tile);
    }
    level3Tiles.push(rowArr);
  }

  // Grid lines
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.4
  });
  const lineThickness = 0.02;
  const boardSpan = houseInnerWidth;

  for (let i = 0; i <= GRID_SIZE; i++) {
    const x = -GRID_HALF_SPAN + i * GRID_STEP;
    const geo = new THREE.BoxGeometry(lineThickness, 0.002, boardSpan);
    const mesh = new THREE.Mesh(geo, lineMat.clone());
    mesh.position.set(x, 0.002, 0);
    level3Group.add(mesh);
  }
  for (let i = 0; i <= GRID_SIZE; i++) {
    const z = -GRID_HALF_SPAN + i * GRID_STEP;
    const geo = new THREE.BoxGeometry(boardSpan, 0.002, lineThickness);
    const mesh = new THREE.Mesh(geo, lineMat.clone());
    mesh.position.set(0, 0.002, z);
    level3Group.add(mesh);
  }

  // ===========================================================
  // HOUSE WALLS WITH RAIN
  // ===========================================================
  const EPS = 0.0001;

  // Back wall
  createRainWall(
    houseInnerWidth,
    wallHeight,
    new THREE.Vector3(0, wallHeight * 0.5, -houseHalfD - EPS),
    0
  );

  // Side walls
  createRainWall(
    houseInnerDepth,
    wallHeight,
    new THREE.Vector3(-houseHalfW - EPS, wallHeight * 0.5, 0),
    Math.PI / 2
  );
  createRainWall(
    houseInnerDepth,
    wallHeight,
    new THREE.Vector3(houseHalfW + EPS, wallHeight * 0.5, 0),
    -Math.PI / 2
  );

  const doorWidth = GRID_STEP * 1;
  const doorHeight = 3.2;
  const doorCenter = gridToWorld(4, 4);
  level3DoorCenter = doorCenter.clone();
  const frontZ = houseHalfD + EPS;

  const totalWidth = houseInnerWidth;
  const halfTotal = totalWidth * 0.5;
  const doorHalf = doorWidth * 0.5;

  const leftWidth = (doorCenter.x - doorHalf) - (-halfTotal);
  const rightWidth = halfTotal - (doorCenter.x + doorHalf);
  const leftCenterX = (-halfTotal + (doorCenter.x - doorHalf)) * 0.5;
  const rightCenterX = ((doorCenter.x + doorHalf) + halfTotal) * 0.5;

  if (leftWidth > 0.001) {
    createRainWall(
      leftWidth,
      wallHeight,
      new THREE.Vector3(leftCenterX, wallHeight * 0.5, frontZ),
      Math.PI
    );
  }

  if (rightWidth > 0.001) {
    createRainWall(
      rightWidth,
      wallHeight,
      new THREE.Vector3(rightCenterX, wallHeight * 0.5, frontZ),
      Math.PI
    );
  }

  // Top lintel over door
  createRainWall(
    doorWidth,
    wallHeight - doorHeight,
    new THREE.Vector3(doorCenter.x, doorHeight + (wallHeight - doorHeight) * 0.5, frontZ),
    Math.PI
  );

  // ===========================================================
  // SOLID WALL COLLIDERS (ENTER ONLY THROUGH DOOR)
  // ===========================================================
  const wallThickness = 0.40;
  const yMid = wallHeight * 0.5;

  addBoxCollider(
    new THREE.Vector3(0, yMid, -houseHalfD - wallThickness * 0.5),
    new THREE.Vector3(houseInnerWidth, wallHeight, wallThickness)
  );

  addBoxCollider(
    new THREE.Vector3(-houseHalfW - wallThickness * 0.5, yMid, 0),
    new THREE.Vector3(wallThickness, wallHeight, houseInnerDepth)
  );

  addBoxCollider(
    new THREE.Vector3(houseHalfW + wallThickness * 0.5, yMid, 0),
    new THREE.Vector3(wallThickness, wallHeight, houseInnerDepth)
  );

  if (leftWidth > 0.001) {
    addBoxCollider(
      new THREE.Vector3(leftCenterX, yMid, houseHalfD + wallThickness * 0.5),
      new THREE.Vector3(leftWidth, wallHeight, wallThickness)
    );
  }
  if (rightWidth > 0.001) {
    addBoxCollider(
      new THREE.Vector3(rightCenterX, yMid, houseHalfD + wallThickness * 0.5),
      new THREE.Vector3(rightWidth, wallHeight, wallThickness)
    );
  }

  addBoxCollider(
    new THREE.Vector3(doorCenter.x, doorHeight + (wallHeight - doorHeight) * 0.5, houseHalfD + wallThickness * 0.5),
    new THREE.Vector3(doorWidth, wallHeight - doorHeight, wallThickness)
  );

  // ===========================================================
  // ROOF – gable prism
  // ===========================================================
  const roofHeight = 2.8;
  const roofOverhang = 0.35;

  const roofW = houseInnerWidth + roofOverhang * 2;
  const roofD = houseInnerDepth + roofOverhang * 2;

  const yBase = wallHeight;
  const yRidge = wallHeight + roofHeight;

  const xL = -roofW * 0.5, xR = roofW * 0.5;
  const zB = -roofD * 0.5, zF = roofD * 0.5;

  const v = [
    xL, yBase, zB,
    xR, yBase, zB,
    xR, yBase, zF,
    xL, yBase, zF,
    0,  yRidge, zB,
    0,  yRidge, zF
  ];

  const idx = [
    0, 3, 5,
    0, 5, 4,
    4, 5, 2,
    4, 2, 1,
    0, 4, 1,
    3, 2, 5,
    0, 1, 2,
    0, 2, 3
  ];

  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  roofGeo.setIndex(idx);
  roofGeo.computeVertexNormals();

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.0,
    metalness: 0.0,
    roughness: 0.25,
    side: THREE.DoubleSide
  });

  const roof = new THREE.Mesh(roofGeo, roofMat);
  level3Group.add(roof);
  level3RoofMeshes.push(roof);

  level3RoofLight = new THREE.PointLight(0xffffff, 2.2, 60);
  level3RoofLight.position.set(0, yRidge - 0.2, 0);
  level3Group.add(level3RoofLight);

  // ===========================================================
  // NODES
  // ===========================================================
  const baseHeight = 0.8;
  const pedestalRadius = 0.35;
  const pedestalGeo = new THREE.CylinderGeometry(pedestalRadius, pedestalRadius, baseHeight, 28);

  const nodeDefs = [
    { id: "ram",     name: "Ram",                row: 2, col: 2, color: 0xffffff },
    { id: "vehaan",  name: "Vehaan",             row: 0, col: 2, color: 0x4aa3ff },
    { id: "chitti",  name: "Chitti",             row: 0, col: 0, color: 0x4dff88 },
    { id: "balaram", name: "Balaram Naidu",      row: 0, col: 4, color: 0xffd35b },
    { id: "shiven",  name: "Shiven",             row: 4, col: 2, color: 0xff8a3a },
    { id: "lohith",  name: "Lohith",             row: 2, col: 0, color: 0xb080ff },
    { id: "gang",    name: "Shiven’s Side Gang", row: 2, col: 4, color: 0x4dffe6 }
  ];

  for (const def of nodeDefs) {
    const pos = gridToWorld(def.row, def.col);

    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: new THREE.Color(def.color).multiplyScalar(def.id === "ram" ? 0.8 : 0.55),
      emissiveIntensity: def.id === "ram" ? 1.3 : 0.95,
      metalness: 0.75,
      roughness: 0.25
    });

    const pedestal = new THREE.Mesh(pedestalGeo, mat);
    pedestal.position.set(pos.x, baseHeight / 2, pos.z);
    pedestal.userData.level3NodeId = def.id;
    level3Group.add(pedestal);

    const node = {
      id: def.id,
      name: def.name,
      row: def.row,
      col: def.col,
      pos: pos.clone(),
      color: new THREE.Color(def.color),
      mesh: pedestal
    };

    level3Nodes.push(node);
    level3NodeById[def.id] = node;

    const t = level3Tiles[def.row]?.[def.col];
    if (t) t.userData.isNodeTile = true;
  }

  // ===========================================================
  // CONNECTIONS
  // ===========================================================

  const pathVC = [[0,2],[0,1],[0,0]];
  const pathVB = [[0,2],[0,3],[0,4]];
  const pathSL = [[2,0],[1,0],[1,1],[2,1],[3,1],[3,0],[4,0],[4,1],[4,2]];
  const pathSG = [[2,4],[1,4],[1,3],[2,3],[3,3],[3,4],[4,4],[4,3],[4,2]];
  const pathSR = [[4,2],[3,2],[2,2]];
  const pathVR = [[0,2],[1,2],[2,2]];

  level3Connections = [
    { id: "vehaan-chitti",  fromId: "vehaan", toId: "chitti",  path: pathVC, colorSourceId: "chitti",  completed: false },
    { id: "vehaan-balaram", fromId: "vehaan", toId: "balaram", path: pathVB, colorSourceId: "balaram", completed: false },

    { id: "shiven-lohith",  fromId: "shiven", toId: "lohith",  path: [...pathSL].reverse(), colorSourceId: "lohith", completed: false },
    { id: "shiven-gang",    fromId: "shiven", toId: "gang",    path: [...pathSG].reverse(), colorSourceId: "gang",   completed: false },

    { id: "shiven-ram",     fromId: "shiven", toId: "ram",     path: pathSR, colorSourceId: "shiven", completed: false },
    { id: "vehaan-ram",     fromId: "vehaan", toId: "ram",     path: pathVR, colorSourceId: "vehaan", completed: false }
  ];

  // ===========================================================
  // CAMERA – spawn at doorway tile (4,4)
  // ===========================================================
  const spawnPos = gridToWorld(4, 4);
  camera.position.set(spawnPos.x, 2.0, spawnPos.z + 1.2);
  cameraBaseHeight = 2.0;

  const ramNode = level3NodeById["ram"];
  const lookAt = ramNode.pos.clone();
  lookAt.y = 1.5;
  camera.lookAt(lookAt);

  const dir = new THREE.Vector3().subVectors(lookAt, camera.position).normalize();
  yaw = Math.atan2(dir.x, -dir.z);
  pitch = Math.asin(dir.y);
  updateCameraDirection();

  isOnGround = true;
  jumpVelocity = 0;

  showLevel3Intro();
}

// =============================================================
// INTRO TEXT
// =============================================================
function showLevel3Intro() {
  const title = "Level 3 – InsideOut House (Hierarchy)";
  const body =
    "A thin house of rain.\nA 5×5 grid like a circuit board.\n\n" +
    "Ram is the top.\n" +
    "Under Ram: Vehaan and Shiven.\n" +
    "Under Vehaan: Chitti, Balaram.\n" +
    "Under Shiven: Lohith, the Side Gang.\n\n" +
    "Fix the lower bonds first.\nOnly then the two pillars may connect to Ram.";
  const hint =
    "Move with WASD / arrows, jump with SPACE.\n" +
    "Stand near a pedestal and press E to start.\n" +
    "Walk to the target pedestal and press E to lock.\n\n" +
    "Rule: Vehaan→Ram and Shiven→Ram must be LAST.";

  showTextPanel(title, body, hint);
  if (activeText) activeText.dataset.mode = "level3-intro";
}

// =============================================================
// INTERACTION (E key)
// =============================================================
function handleLevel3Interact() {
  if (window.level3Completed) return;

  const camPos = camera.position;

  if (!level3IsDrawing) {
    const pick = findStartableConnectionNearPlayer();

    if (!pick) {
      const nearLast =
        ["vehaan-ram","shiven-ram"].some(id => {
          const c = level3Connections.find(x => x.id === id);
          if (!c || c.completed) return false;
          const a = level3NodeById[c.fromId];
          const b = level3NodeById[c.toId];
          return camPos.distanceTo(a.pos.clone().setY(camPos.y)) < 1.6 ||
                 camPos.distanceTo(b.pos.clone().setY(camPos.y)) < 1.6;
        });

      clearText();
      showTextPanel(
        "No Startable Connection",
        nearLast
          ? "That link is sealed for now.\nFinish the lower bonds first:\nChitti, Balaram, Lohith, and the Gang."
          : "Move closer to any pedestal (either side of a bond) and press E.\nYou can do early bonds in any order.",
        "Vehaan→Ram and Shiven→Ram unlock only after the four lower bonds are done."
      );
      if (activeText) activeText.dataset.mode = "level3-hint";
      return;
    }

    const conn = pick.conn;
    const startId = pick.startId;

    level3ActiveConn = conn;
    level3ActiveStartId = startId;
    level3IsDrawing = true;

    const startNode = level3NodeById[startId];
    const targetId = (startId === conn.fromId) ? conn.toId : conn.fromId;
    const targetNode = level3NodeById[targetId];

    highlightLevel3Nodes(startNode, targetNode);

    clearText();
    showTextPanel(
      "Connection Started",
      `${startNode.name} → ${targetNode.name}\n\nFollow the grid. Reach the target pedestal.`,
      "Press E again when you're next to the target pedestal."
    );
    if (activeText) activeText.dataset.mode = "level3-connecting";
    return;
  }

  const conn = level3ActiveConn;
  const startId = level3ActiveStartId;
  if (!conn || !startId) {
    level3IsDrawing = false;
    level3ActiveConn = null;
    level3ActiveStartId = null;
    return;
  }

  const targetId = (startId === conn.fromId) ? conn.toId : conn.fromId;
  const targetNode = level3NodeById[targetId];

  const nearTo = camPos.distanceTo(targetNode.pos.clone().setY(camPos.y)) < 1.6;

  if (!nearTo) {
    clearText();
    showTextPanel(
      "Connection Incomplete",
      `You haven't reached ${targetNode.name} yet.\nStay on the grid tiles and walk to their pedestal.`,
      "Then press E to lock the bond."
    );
    if (activeText) activeText.dataset.mode = "level3-connecting";
    return;
  }

  finalizeLevel3Connection(conn, startId);

  level3IsDrawing = false;
  level3ActiveConn = null;
  level3ActiveStartId = null;

  if (areAllConnectionsComplete()) {
    onLevel3AllConnectionsComplete();
  } else {
    clearText();
    showTextPanel(
      "Connection Locked",
      `The bond holds.\n\nYou may choose any remaining bond.\n(Except the last two, which unlock later.)`,
      "Walk to any pedestal (either endpoint) and press E."
    );
    if (activeText) activeText.dataset.mode = "level3-next";
  }
}

// =============================================================
// HELPERS
// =============================================================
function highlightLevel3Nodes(fromNode, toNode) {
  for (const node of level3Nodes) {
    const mat = node.mesh.material;
    if (node === fromNode || node === toNode) {
      mat.emissiveIntensity = 1.9;
      mat.color.lerp(new THREE.Color(0xffffff), 0.18);
    } else if (node.id === "ram") {
      mat.emissiveIntensity = 1.2;
    } else {
      mat.emissiveIntensity = 0.65;
    }
  }
}

function finalizeLevel3Connection(conn, startId) {
  const sourceNode = level3NodeById[conn.colorSourceId] || level3NodeById[conn.fromId];
  const pathColor = sourceNode.color.clone();

  const forward = (startId === conn.fromId);
  const path = forward ? conn.path : [...conn.path].reverse();

  for (const [r, c] of path) {
    const tile = level3Tiles[r]?.[c];
    if (!tile) continue;

    if (!tile.userData.isNodeTile) {
      if (tile.userData.ownerConnId && tile.userData.ownerConnId !== conn.id) {
        continue;
      }
      tile.userData.ownerConnId = conn.id;
    }

    tile.userData.onPath = true;
    tile.userData.pathColor = pathColor.clone();
    tile.userData.completed = true;

    const mat = tile.material;
    mat.color.copy(pathColor);
    mat.emissive.copy(pathColor).multiplyScalar(0.7);
    mat.emissiveIntensity = 1.4;
    mat.roughness = 0.35;
    mat.metalness = 0.65;
  }

  conn.completed = true;
}

function onLevel3AllConnectionsComplete() {
  if (window.level3Completed) return;
  window.level3Completed = true;
  level3AllTilesLit = true;

  const door = level3DoorCenter ? level3DoorCenter.clone() : gridToWorld(4, 4);
  const portalW = GRID_STEP * 0.95;
  const portalH = 3.0;
  const portalGeo = new THREE.PlaneGeometry(portalW, portalH);

  const portalMat = new THREE.MeshStandardMaterial({
    color: 0x80ffea,
    emissive: 0x00ffee,
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0.75,
    metalness: 0.15,
    roughness: 0.35,
    side: THREE.DoubleSide
  });

  level3DoorPortal = new THREE.Mesh(portalGeo, portalMat);
  level3DoorPortal.position.set(door.x, portalH * 0.5, level3HouseHalfD - 0.02);
  level3DoorPortal.rotation.y = Math.PI;
  level3DoorPortal.userData.level3DoorPortal = true;

  level3Group.add(level3DoorPortal);

  clearText();
  showTextPanel(
    "All Bonds Repaired",
    "No tile is left unclaimed.\nThe hierarchy is stitched back together.\n\nNow the doorway itself becomes the exit.",
    "Walk through the glowing door to enter Level 4."
  );
  if (activeText) activeText.dataset.mode = "level3-complete";
}

// =============================================================
// UPDATE LOOP
// =============================================================
function updateLevel3(dt) {
  handleCameraMovement(dt);
  resolveLevel3Collisions();

  const limit = GRID_HALF_SPAN + 6.0;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -limit, limit);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -limit, limit);

  const t = performance.now() * 0.001;
  const shaderTime = clock.getElapsedTime ? clock.getElapsedTime() : t;

  for (const mat of level3RainMaterials) {
    mat.uniforms.u_time.value = shaderTime;
  }

  const cycleSpeed = 0.12;
  const k = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2) * cycleSpeed);

  for (const roof of level3RoofMeshes) {
    const m = roof.material;
    m.color.setScalar(k);
    m.emissive.setScalar(k);
    m.emissiveIntensity = 2.0 * k;
  }
  if (level3RoofLight) {
    level3RoofLight.intensity = 2.2 * k;
  }

  for (let r = 0; r < level3Tiles.length; r++) {
    for (let c = 0; c < level3Tiles[r].length; c++) {
      const tile = level3Tiles[r][c];
      const mat = tile.material;

      if (tile.userData.onPath) {
        const base = level3AllTilesLit ? 1.3 : 1.0;
        const amp  = level3AllTilesLit ? 0.5 : 0.25;
        mat.emissiveIntensity = base + amp * Math.sin(t * 2.5 + (r + c) * 0.4);
      } else if (tile.userData.completed) {
        mat.emissiveIntensity = 0.6 + 0.25 * Math.sin(t * 1.8 + (r + c) * 0.3);
      }
    }
  }

  for (const node of level3Nodes) {
    const mat = node.mesh.material;
    const base = node.id === "ram" ? 1.2 : 0.7;
    const amp  = node.id === "ram" ? 0.4 : 0.3;
    mat.emissiveIntensity = base + amp * Math.sin(t * 2.5 + node.pos.x * 0.2);
  }

  if (window.level3Completed && level3DoorPortal) {
    const breathe = 0.55 + 0.45 * Math.sin(t * 2.2);
    level3DoorPortal.material.opacity = 0.55 + 0.25 * breathe;
    level3DoorPortal.material.emissiveIntensity = 1.8 + 1.2 * breathe;

    const door = level3DoorCenter ? level3DoorCenter : gridToWorld(4, 4);

    const dx = camera.position.x - door.x;
    const dz = camera.position.z - (level3HouseHalfD - 0.02);

    const nearDoorWidth = Math.abs(dx) < (GRID_STEP * 0.55);
    const nearDoorDepth = Math.abs(dz) < 0.45;

    if (nearDoorWidth && nearDoorDepth) {
      if (typeof window.goToLevel4 === "function") {
        window.goToLevel4();
      } else {
        console.error("❌ window.goToLevel4 is not defined (main.js not ready?)");
      }
    }
  }
}