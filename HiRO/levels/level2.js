// ====== LEVEL 2: IRIS WALL ======

let irisEyes = [];
let irisClueEyes = [];
let irisCluesFound = 0;
const IRIS_CLUES_REQUIRED = 3;

let irisClueHud = null;
let irisFloor = null;
let irisRoof = null;
let irisRoomWalls = [];
let irisWallGroup = null;

// NEW: top portal to Level 3
let irisTopPortal = null;
let irisPortalOpen = false;
let irisPortalTriggered = false;

let irisRoomRadius = 12;
let irisRoomHeight = 10;

// 3 special clues (story)
const irisClueTexts = [
  "A dim backroom, somewhere in Vijayawada.\nShadow donors sit around a table.\nAnvar walks in. A briefcase lands on the table.\nMoney for something bigger than anyone in college gossip.",
  "A cramped office near Arundelpet.\nAnvar hands a thick envelope to Hiteshwar.\n\"Routes, timings, people,\" he whispers.\nThis is not about one man; it's about control.",
  "A 1-Town MLA office.\nRowdies stand around a map of Guntur.\nRoutes are circled in red ink.\nOne point glows brighter: Balaram Naidu's daily path."
];

const irisNormalTexts = [
  "College corridor. Noise, laughter, someone yelling about exams.\nJust another day. Not a clue.",
  "A bus stop near Brodipet.\nPeople argue about movie tickets and chai.\nThis memory doesn’t point to the murder.",
  "Cricket ground near AC College.\nArguments about who will bat first.\nHeat, sweat, but no conspiracy here.",
  "Crowded street in Lakshmipuram.\nBikes, horns, posters, chaos.\nIt feels tense but meaningless.",
  "College canteen fights over samosas and extra chutney.\nToo normal to be connected.",
  "Shouts, slogans, student politics banners.\nBut this thread doesn’t tie back to Balaram Naidu."
];

const IRIS_PALETTE = [
  0x1f6fff,
  0x8dd6ff,
  0x8b4513,
  0x3f8f5b,
  0x7f8a96,
  0xc28a4d,
  0xffbf00,
  0xff4a4a
];

// ================= REAL IRIS TEXTURES =================

const IRIS_TEXTURE_PATH = "assets/iris_textures/";
const IRIS_TEXTURE_FILES = [
  "iris-01.webp",
  "iris-02.jpg",
  "iris-03.jpg",
  "iris-04.jpg",
  "iris-05.jpg",
  "iris-07.jpeg",
  "iris-08.jpg",
  "iris-09.png",
  "iris-10.png",
  "iris-11.png",
  "iris-12.png"
];

let irisTexCache = [];
let irisTexturesReady = false;

// crop to remove black padding so iris fills the circle
const IRIS_TEX_CROP = 0.72;

function loadIrisTextures(callback) {
  // If already loaded once, reuse cache
  if (irisTexturesReady && irisTexCache.length) {
    callback();
    return;
  }

  irisTexturesReady = false;
  irisTexCache = [];

  const manager = new THREE.LoadingManager();
  manager.onLoad = () => {
    irisTexturesReady = true;
    console.log(`Loaded iris textures: ${irisTexCache.length} / ${IRIS_TEXTURE_FILES.length}`);
    callback();
  };

  const loader = new THREE.TextureLoader(manager);

  IRIS_TEXTURE_FILES.forEach((file) => {
    const url = IRIS_TEXTURE_PATH + file;

    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;

        if (renderer) {
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }

        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;

        tex.repeat.set(IRIS_TEX_CROP, IRIS_TEX_CROP);
        tex.offset.set((1 - IRIS_TEX_CROP) * 0.5, (1 - IRIS_TEX_CROP) * 0.5);

        irisTexCache.push(tex);
      },
      undefined,
      (err) => {
        console.warn("Failed to load iris texture:", url, err);
      }
    );
  });
}

function pickRandomIrisTexture() {
  if (!irisTexCache.length) return null;
  return irisTexCache[Math.floor(Math.random() * irisTexCache.length)];
}

// ================= FLOOR/ROOF STRIPE SHADER =================

function createIrisStripeMaterial() {
  const colorObjs = IRIS_PALETTE.map(c => new THREE.Color(c));
  return new THREE.ShaderMaterial({
    uniforms: { u_colors: { value: colorObjs } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 u_colors[8];
      const float PI = 3.14159265;

      vec3 getColor(int idx) {
        if (idx == 0) return u_colors[0];
        if (idx == 1) return u_colors[1];
        if (idx == 2) return u_colors[2];
        if (idx == 3) return u_colors[3];
        if (idx == 4) return u_colors[4];
        if (idx == 5) return u_colors[5];
        if (idx == 6) return u_colors[6];
        return u_colors[7];
      }

      void main() {
        vec2 c = vUv - 0.5;
        float angle = atan(c.y, c.x);
        float unwrapped = angle / (2.0 * PI) + 0.5;

        float stripes = 28.0;
        float bandIndex = floor(unwrapped * stripes);
        int colorIndex = int(mod(bandIndex, 8.0));

        vec3 col = getColor(colorIndex);

        float r = length(c);
        float fade = smoothstep(0.0, 0.85, r);
        col *= 0.25 + 0.75 * fade;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
}

// ================= HUD =================

function createIrisClueHud() {
  if (!uiOverlay) return;

  irisClueHud = document.createElement("div");
  Object.assign(irisClueHud.style, {
    position: "absolute",
    right: "24px",
    top: "24px",
    padding: "10px 14px",
    borderRadius: "10px",
    background: "rgba(3, 6, 20, 0.8)",
    border: "1px solid rgba(120, 180, 255, 0.5)",
    fontSize: "13px",
    pointerEvents: "none"
  });
  irisClueHud.textContent = "Clues found: 0 / 3";
  uiOverlay.appendChild(irisClueHud);
}

function updateIrisClueHud() {
  if (!irisClueHud) return;
  irisClueHud.textContent = `Clues found: ${irisCluesFound} / ${IRIS_CLUES_REQUIRED}`;
}

// ================= RADAR PING (CLUE EYES ONLY) =================

let irisRadarTimer = 0;
const IRIS_RADAR_INTERVAL = 5.0;

const IRIS_RADAR_WAVE_DURATION = 0.55;

const IRIS_RADAR_WAVE_EXPAND = 0.85;
const IRIS_RADAR_WAVE_OPACITY = 0.40;
const IRIS_RADAR_EMISSIVE_BOOST = 0.65;

function easeOutQuad(x) {
  return 1 - (1 - x) * (1 - x);
}

// ================= IRIS EYE =================

function createIrisEye(radius, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  group.lookAt(0, y, 0);

  const tex = pickRandomIrisTexture();

  const outerGeo = new THREE.CircleGeometry(radius, 40);
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,

    emissive: new THREE.Color(0xffffff),
    emissiveMap: tex,
    emissiveIntensity: 0.18,

    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.position.z = 0.0;
  group.add(outerMesh);

  // Outline ring for highlight
  const ringGeo = new THREE.RingGeometry(radius * 0.92, radius * 1.02, 40);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xbad7ff,
    emissive: 0xbad7ff,
    emissiveIntensity: 0.12,
    roughness: 0.35,
    metalness: 0.15,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide
  });

  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.z = -0.01;
  group.add(ringMesh);

  const waveMat = new THREE.MeshBasicMaterial({
    color: 0xbad7ff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const waveMesh = new THREE.Mesh(ringGeo.clone(), waveMat);
  waveMesh.position.z = 0.03;
  waveMesh.visible = true;
  group.add(waveMesh);

  group.userData.eyeData = {
    type: "normal",
    clueIndex: -1,
    discovered: false,
    phase: Math.random() * Math.PI * 2,
    radius,
    outerMat,
    ringMat,

    // radar ping state
    waveMesh,
    waveT: -1
  };

  return group;
}

// ================= TOP PORTAL (LEVEL 2 → LEVEL 3) =================

function createIrisTopPortal() {
  if (irisTopPortal) {
    scene.remove(irisTopPortal);
    irisTopPortal = null;
  }

  const portalGeo = new THREE.CircleGeometry(1.65, 44);
  const portalMat = new THREE.MeshStandardMaterial({
    color: 0x4ad7ff,
    emissive: 0x0a2a44,
    emissiveIntensity: 0.0,
    transparent: true,
    opacity: 0.72,
    roughness: 0.15,
    metalness: 0.85,
    side: THREE.DoubleSide
  });

  irisTopPortal = new THREE.Mesh(portalGeo, portalMat);

  irisTopPortal.position.set(0, irisRoomHeight - 0.55, 0);

  irisTopPortal.rotation.x = Math.PI / 2;

  irisTopPortal.visible = false;

  irisTopPortal.userData = {
    t: 0,
    opened: false
  };

  scene.add(irisTopPortal);

  window.irisTopPortal = irisTopPortal;
}

function updateIrisTopPortal(dt) {
  if (!irisTopPortal || !irisTopPortal.visible) return;

  const t = performance.now() * 0.001;
  const mat = irisTopPortal.material;

  mat.emissiveIntensity = 0.65 + 0.25 * Math.sin(t * 3.0);
  mat.opacity = 0.70 + 0.08 * Math.sin(t * 2.1);

  const s = 1.0 + 0.04 * Math.sin(t * 2.6);
  irisTopPortal.scale.setScalar(s);
}

function checkIrisTopPortalTrigger() {
  if (!irisPortalOpen || irisPortalTriggered || !irisTopPortal || !irisTopPortal.visible) return;

  const dist = camera.position.distanceTo(irisTopPortal.position);

  if (dist < 1.75) {
    irisPortalTriggered = true;

    clearText();
    setAimMode(false);

    if (typeof initLevel3 === "function") {
      initLevel3();
    } else {
      console.warn("initLevel3() not found. Make sure level3.js is loaded and initLevel3 is global.");
    }
  }
}

// ================= INIT LEVEL 2 =================

function initLevel2() {
  currentLevel = 2;

  if (level1Floor) { scene.remove(level1Floor); level1Floor = null; }
  level1Walls.forEach(w => scene.remove(w)); level1Walls = [];
  level1Spots.forEach(s => scene.remove(s)); level1Spots = [];
  if (level1CenterPortal) { scene.remove(level1CenterPortal); level1CenterPortal = null; }

  footstepList = [];
  lastFootstepPos = null;

  clearText();
  setAimMode(false);

  if (irisClueHud && irisClueHud.parentElement) {
    irisClueHud.parentElement.removeChild(irisClueHud);
  }
  irisClueHud = null;

  irisEyes = [];
  irisClueEyes = [];
  irisCluesFound = 0;

  irisRoomWalls.forEach(w => scene.remove(w));
  irisRoomWalls = [];
  if (irisFloor) { scene.remove(irisFloor); irisFloor = null; }
  if (irisRoof) { scene.remove(irisRoof); irisRoof = null; }
  if (irisWallGroup) { scene.remove(irisWallGroup); irisWallGroup = null; }

  if (irisTopPortal) { scene.remove(irisTopPortal); irisTopPortal = null; }
  irisPortalOpen = false;
  irisPortalTriggered = false;

  irisRadarTimer = 0;

  loadIrisTextures(() => {
    buildLevel2RoomAndEyes();
  });
}

function buildLevel2RoomAndEyes() {
  irisRoomRadius = 12;
  irisRoomHeight = 10;

  const roomRadius = irisRoomRadius;
  const roomHeight = irisRoomHeight;

  // Wall cylinder
  const cylGeo = new THREE.CylinderGeometry(roomRadius, roomRadius, roomHeight, 72, 1, true);
  const cylMat = new THREE.MeshStandardMaterial({
    color: 0x05060f,
    roughness: 0.85,
    metalness: 0.2,
    side: THREE.BackSide
  });
  const cylinder = new THREE.Mesh(cylGeo, cylMat);
  cylinder.position.set(0, roomHeight * 0.5, 0);
  scene.add(cylinder);
  irisRoomWalls.push(cylinder);

  // Floor
  irisFloor = new THREE.Mesh(new THREE.CircleGeometry(roomRadius, 64), createIrisStripeMaterial());
  irisFloor.rotation.x = -Math.PI / 2;
  scene.add(irisFloor);

  // Roof
  irisRoof = new THREE.Mesh(new THREE.CircleGeometry(roomRadius, 64), createIrisStripeMaterial());
  irisRoof.rotation.x = Math.PI / 2;
  irisRoof.position.y = roomHeight;
  scene.add(irisRoof);

  // Eye group
  irisWallGroup = new THREE.Group();
  scene.add(irisWallGroup);

  const targetEyeCount = 320;
  const minRadius = 0.16;
  const maxRadius = 0.66;
  const innerRadius = roomRadius - 0.09;

  const placed = [];
  let attempts = 0;
  const maxAttempts = 16000;

  while (irisEyes.length < targetEyeCount && attempts < maxAttempts) {
    attempts++;

    const rRand = Math.random();
    const radius = minRadius + (maxRadius - minRadius) * (rRand * rRand);

    const angle = Math.random() * Math.PI * 2;
    const y = 2.0 + (roomHeight - 2.4) * Math.random();

    const x = Math.cos(angle) * innerRadius;
    const z = Math.sin(angle) * innerRadius;

    let ok = true;
    for (const p of placed) {
      const dx = x - p.x, dy = y - p.y, dz = z - p.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const minDist = radius + p.radius + 0.025;
      if (dist < minDist) { ok = false; break; }
    }
    if (!ok) continue;

    const eye = createIrisEye(radius, x, y, z);
    placed.push({ x, y, z, radius });
    irisEyes.push(eye);
    irisWallGroup.add(eye);
  }

  const indices = [];
  for (let i = 0; i < irisEyes.length; i++) indices.push(i);

  for (let c = 0; c < IRIS_CLUES_REQUIRED && indices.length > 0; c++) {
    const pickIdx = Math.floor(Math.random() * indices.length);
    const eyeIndex = indices.splice(pickIdx, 1)[0];
    const eye = irisEyes[eyeIndex];

    eye.userData.eyeData.type = "clue";
    eye.userData.eyeData.clueIndex = c;

    eye.userData.eyeData.waveT = -1;
    eye.userData.eyeData.waveMesh.material.opacity = 0.0;
    eye.userData.eyeData.waveMesh.scale.setScalar(1.0);

    irisClueEyes.push(eye);
  }

  createIrisTopPortal();

  camera.position.set(0, 5, 0);
  yaw = 0;
  pitch = 0;
  updateCameraDirection();

  cameraBaseHeight = camera.position.y;
  isOnGround = true;
  jumpVelocity = 0;

  createIrisClueHud();
  updateIrisClueHud();

  showTextPanel(
    "Level 2 – Iris Wall",
    "The future fractures into thousands of staring eyes.\n" +
      "Each eye holds a fragment of Guntur’s political underbelly.\n\n" +
      "Right-click to focus. A crosshair appears.\n" +
      "Aim at an eye and left-click to dive into that memory.\n\n" +
      "Find the three real conspiracies that link:\n" +
      "Shadow Donors → Anvar → Hiteshwar → 1-Town MLA.",
    "Find all 3 real clues.\nThe wall will open a way forward."
  );
  if (activeText) activeText.dataset.mode = "iris-intro";
}

// ================= UPDATE LOOP =================

function updateLevel2(dt) {
  handleCameraMovement(dt);

  const maxRadius = 4.0;
  const r = Math.sqrt(camera.position.x * camera.position.x + camera.position.z * camera.position.z);
  if (r > maxRadius) {
    const s = maxRadius / r;
    camera.position.x *= s;
    camera.position.z *= s;
  }

  animateIrisEyes(dt);

  updateIrisTopPortal(dt);
  checkIrisTopPortalTrigger();
}

function animateIrisEyes(dt) {
  const t = performance.now() * 0.001;

  irisRadarTimer += dt;
  if (irisRadarTimer >= IRIS_RADAR_INTERVAL) {
    irisRadarTimer = 0;

    // ping only while searching
    if (irisCluesFound < IRIS_CLUES_REQUIRED) {
      irisClueEyes.forEach((eye) => {
        const data = eye.userData.eyeData;
        if (!data) return;
        data.waveT = 0;
      });
    }
  }

  irisEyes.forEach((eye) => {
    const data = eye.userData.eyeData;
    const outerMat = data.outerMat;
    const ringMat = data.ringMat;

    const baseScale = 1.0 + (data.type === "clue" ? 0.06 : 0.0);
    const pulse = 1.0 + 0.05 * Math.sin(t * 3.0 + data.phase);
    eye.scale.setScalar(baseScale * pulse);

    const isClue = (data.type === "clue");

    if (isClue) {
      outerMat.emissiveIntensity = 0.35 + 0.18 * Math.sin(t * 2.5 + data.phase);
      ringMat.emissiveIntensity = data.discovered ? 0.22 : 0.45;
      ringMat.opacity = data.discovered ? 0.50 : 0.60;
    } else {
      outerMat.emissiveIntensity = 0.15 + 0.10 * Math.sin(t * 2.0 + data.phase);
      ringMat.emissiveIntensity = 0.10;
      ringMat.opacity = 0.50;
    }

    if (isClue && data.waveMesh && data.waveT >= 0) {
      data.waveT += dt;
      const p = data.waveT / IRIS_RADAR_WAVE_DURATION;

      if (p >= 1.0) {
        data.waveT = -1;
        data.waveMesh.material.opacity = 0.0;
        data.waveMesh.scale.setScalar(1.0);
      } else {
        const e = easeOutQuad(p);

        const s = 1.0 + IRIS_RADAR_WAVE_EXPAND * e;
        data.waveMesh.scale.setScalar(s);

        const fade = (1.0 - p);
        data.waveMesh.material.opacity = IRIS_RADAR_WAVE_OPACITY * fade;

        const boostMul = data.discovered ? 0.45 : 1.0;
        const boost = IRIS_RADAR_EMISSIVE_BOOST * fade * boostMul;

        ringMat.emissiveIntensity = Math.min(1.25, ringMat.emissiveIntensity + boost);
        ringMat.opacity = Math.min(0.92, ringMat.opacity + 0.30 * fade);
        outerMat.emissiveIntensity = Math.min(1.10, outerMat.emissiveIntensity + 0.50 * fade * boostMul);
      }
    }
  });
}

// ================= INTERACTION =================

function tryInteractWithIrisEye() {
  if (currentLevel !== 2) return;
  if (!raycaster || irisEyes.length === 0) return;

  const ndc = new THREE.Vector2(0, 0);
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObjects(irisEyes, true);
  if (hits.length === 0) return;

  let obj = hits[0].object;
  while (obj && !obj.userData.eyeData) obj = obj.parent;
  if (!obj) return;

  const data = obj.userData.eyeData;
  if (!data) return;

  if (data.type === "normal") {
    const textIndex = Math.floor(Math.random() * irisNormalTexts.length);
    clearText();
    showTextPanel(
      "Fragmented Memory",
      irisNormalTexts[textIndex],
      "Not every memory is a clue.\nRight-click to focus again, left-click to try another eye."
    );
    if (activeText) activeText.dataset.mode = "iris-search";
  } else if (data.type === "clue") {
    handleIrisClueClick(obj, data);
  }
}

function handleIrisClueClick(eyeMesh, data) {
  if (data.discovered) {
    clearText();
    showTextPanel(
      "Replayed Clue",
      irisClueTexts[data.clueIndex],
      "You’ve already connected this part of the chain."
    );
    if (activeText) activeText.dataset.mode = "iris-search";
    return;
  }

  data.discovered = true;
  irisCluesFound++;
  updateIrisClueHud();

  const originalScale = eyeMesh.scale.x;
  eyeMesh.scale.setScalar(originalScale * 1.2);
  setTimeout(() => eyeMesh.scale.setScalar(originalScale), 120);

  clearText();
  showTextPanel(
    "Conspiracy Fragment " + irisCluesFound,
    irisClueTexts[data.clueIndex],
    irisCluesFound < IRIS_CLUES_REQUIRED
      ? "Right-click to focus again.\nYou still feel there are more threads hiding in this wall."
      : "All three threads align into one clear chain.\nLook up. Something is opening above you."
  );

  if (activeText) {
    activeText.dataset.mode = (irisCluesFound < IRIS_CLUES_REQUIRED) ? "iris-search" : "iris-ready";
  }

  if (irisCluesFound >= IRIS_CLUES_REQUIRED) {
    onIrisAllCluesFound();
  }
}

function onIrisAllCluesFound() {
  setAimMode(false);

  irisPortalOpen = true;
  if (irisTopPortal) {
    irisTopPortal.visible = true;
    irisTopPortal.material.emissiveIntensity = 0.65;
  }

  clearText();
  showTextPanel(
    "A Way Forward",
    "Ram locks the chain into place:\n\n" +
      "Shadow Donors → Anvar → Hiteshwar → 1-Town MLA → hired goons.\n\n" +
      "The wall reacts.\nA portal ignites above the center.\n\n" +
      "Look up.\nJump and touch the portal to enter Level 3.",
    "Jump to the portal above.\nAs soon as you reach it, you’ll transition automatically."
  );

  if (activeText) activeText.dataset.mode = "iris-complete";
}