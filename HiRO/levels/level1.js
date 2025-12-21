// ====== LEVEL 1: LIGHT FLOOR ======

// Room height for Level 1 (walls + roof)
const ROOM_HEIGHT = 30;

// Story text for Level 1 spots
const level1SpotTexts = [
  "2018: Balaram Naidu is murdered.\nThat single night shatters the entire city.",
  "After the funeral, the gang slowly breaks.\nRam leaves Guntur for BTech, alone.",
  "By 2024, Vehaan is eaten alive by grief and politics.\nRevenge is the only thing that feels real.",
  "Under the neem tree, a drunk argument explodes.\nVehaan pushes Shiven.\nShiven falls on a rock and dies.\nBlood stains the roots of the tree."
];

// ====== ORDERED RING STATE (NEW) ======
let level1CurrentTargetIndex = 0;
let level1WaitingForPanelClose = false;
let level1PendingSpot = null;

const LEVEL1_PREMIUM = {
  vignetteStrength: 0.28,
  contrast: 1.12,
  saturation: 1.10,
  sheenStrength: 0.22,
  grain: 0.012
};

function initLevel1IntroText() {
  showTextPanel(
    "2024 – The Neem Tree",
    "Ram touches the old neem tree and is drowned in visions:\n" +
      "Balaram Naidu’s murder, the gang collapsing,\n" +
      "Shiven’s death, and a broken Guntur.",
    "Press ENTER to continue."
  );
  if (activeText) activeText.dataset.mode = "intro";
}

// ===== LEVEL 1 INIT =====
function initLevel1() {
  const floorGeo = new THREE.PlaneGeometry(60, 60);

  const footstepArray = [];
  for (let i = 0; i < MAX_FOOTSTEPS; i++) {
    footstepArray.push(new THREE.Vector2(9999, 9999));
  }

  level1FloorMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_time:   { value: 0 },
      u_color1: { value: new THREE.Color(0x020824) }, // deep blue
      u_color2: { value: new THREE.Color(0x1b5cff) }, // bright blue
      u_glow1:  { value: new THREE.Color(0xffd35b) }, // yellow
      u_glow2:  { value: new THREE.Color(0xff6a3c) }, // orange

      u_footsteps:     { value: footstepArray },
      u_footstepCount: { value: 0 },

      // premium knobs
      u_vignette: { value: LEVEL1_PREMIUM.vignetteStrength },
      u_contrast: { value: LEVEL1_PREMIUM.contrast },
      u_sat:      { value: LEVEL1_PREMIUM.saturation },
      u_sheen:    { value: LEVEL1_PREMIUM.sheenStrength },
      u_grain:    { value: LEVEL1_PREMIUM.grain }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vWorldXZ;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldXZ = worldPos.xz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float u_time;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_glow1;
      uniform vec3 u_glow2;

      uniform vec2 u_footsteps[${MAX_FOOTSTEPS}];
      uniform float u_footstepCount;

      uniform float u_vignette;
      uniform float u_contrast;
      uniform float u_sat;
      uniform float u_sheen;
      uniform float u_grain;

      varying vec2 vUv;
      varying vec2 vWorldXZ;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) +
               (c - a) * u.y * (1.0 - u.x) +
               (d - b) * u.x * u.y;
      }

      vec3 applySaturation(vec3 c, float s) {
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        return mix(vec3(l), c, s);
      }

      void main() {
        vec2 p = vUv * 10.0;
        float t = u_time * 0.3;

        float n1 = noise(p + vec2(t, -t));
        float n2 = noise(p * 1.7 - vec2(t * 0.7, t * 0.4));
        float n3 = noise(p * 3.5 + vec2(-t * 0.2, t * 0.9));

        float base = n1 * 0.55 + n2 * 0.35 + n3 * 0.10;

        float ink = smoothstep(0.15, 0.85, base);
        vec3 col = mix(u_color1, u_color2, ink);

        // FOOTSTEP GLOW (only on mostly horizontal surfaces)
        float footGlow = 0.0;

        if (abs(vWorldNormal.y) > 0.5) {
          const int MAX_STEPS = ${MAX_FOOTSTEPS};
          for (int i = 0; i < MAX_STEPS; i++) {
            if (float(i) >= u_footstepCount) break;
            vec2 stepPos = u_footsteps[i];
            float d = length(vWorldXZ - stepPos);

            float radius = 2.2;
            float f = smoothstep(radius, 0.0, d);
            footGlow = max(footGlow, f);
          }
        }

        if (footGlow > 0.0) {
          float detail = noise(vWorldXZ * 8.0);
          float mask   = smoothstep(0.35, 1.0, detail);
          float splash = footGlow * mask;

          col = mix(col, u_glow1, splash * 0.9);
          col = mix(col, u_glow2, splash * 0.7);
        }

        // PREMIUM (no postprocessing)
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
        col += (u_sheen * fres) * vec3(0.35, 0.55, 1.0);

        vec2 dv = vUv - 0.5;
        float v = smoothstep(0.80, 0.15, length(dv));
        col *= mix(1.0 - u_vignette, 1.0, v);

        col = (col - 0.5) * u_contrast + 0.5;
        col = applySaturation(col, u_sat);

        float g = (hash(vUv * 900.0 + vec2(t, -t)) - 0.5) * u_grain;
        col += g;

        col = clamp(col, 0.0, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });

  level1Floor = new THREE.Mesh(floorGeo, level1FloorMaterial);
  level1Floor.rotation.x = -Math.PI / 2;
  scene.add(level1Floor);

  level1Walls.forEach(w => scene.remove(w));
  level1Walls = [];

  const wallGeo = new THREE.PlaneGeometry(60, ROOM_HEIGHT);

  const makeWall = (position, rotationY) => {
    const wall = new THREE.Mesh(wallGeo, level1FloorMaterial);
    wall.position.copy(position);
    wall.rotation.y = rotationY;
    scene.add(wall);
    level1Walls.push(wall);
  };

  makeWall(new THREE.Vector3(0, ROOM_HEIGHT * 0.5, -30), 0);
  makeWall(new THREE.Vector3(0, ROOM_HEIGHT * 0.5,  30), Math.PI);
  makeWall(new THREE.Vector3(-30, ROOM_HEIGHT * 0.5, 0), Math.PI / 2);
  makeWall(new THREE.Vector3( 30, ROOM_HEIGHT * 0.5, 0), -Math.PI / 2);

  const roof = new THREE.Mesh(floorGeo, level1FloorMaterial);
  roof.position.set(0, ROOM_HEIGHT, 0);
  roof.rotation.x = Math.PI / 2;
  scene.add(roof);
  level1Walls.push(roof);

  level1Spots.forEach(s => scene.remove(s));
  level1Spots = [];

  const spotCount = 4;
  const usedPositions = [];
  const bounds = 24;
  const minDist = 10.0;
  const minCenterDist = 10.0;

  function randomSpotPosition() {
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = (Math.random() * 2 - 1) * bounds;
      const z = (Math.random() * 2 - 1) * bounds;
      const candidate = new THREE.Vector3(x, 0.01, z);

      if (candidate.length() < minCenterDist) continue;

      let ok = true;
      for (const p of usedPositions) {
        if (p.distanceTo(candidate) < minDist) { ok = false; break; }
      }
      if (ok) {
        usedPositions.push(candidate);
        return candidate;
      }
    }
    return new THREE.Vector3(
      (Math.random() * 2 - 1) * bounds,
      0.01,
      (Math.random() * 2 - 1) * bounds
    );
  }

  for (let i = 0; i < spotCount; i++) {
    const pos = randomSpotPosition();

    const ringGeo = new THREE.RingGeometry(1.15, 1.25, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
      roughness: 0.05,
      metalness: 0.9,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });

    const spot = new THREE.Mesh(ringGeo, ringMat);
    spot.position.copy(pos);
    spot.rotation.x = -Math.PI / 2;

    spot.userData = { index: i, activated: false };

    level1Spots.push(spot);
    scene.add(spot);
  }

  const portalGeo = new THREE.CircleGeometry(2, 40);
  const portalMat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    emissive: 0x001111,
    emissiveIntensity: 0.0,
    transparent: true,
    opacity: 0.6,
    roughness: 0.2,
    metalness: 0.8
  });
  level1CenterPortal = new THREE.Mesh(portalGeo, portalMat);
  level1CenterPortal.position.set(0, 0.011, 0);
  level1CenterPortal.rotation.x = -Math.PI / 2;
  scene.add(level1CenterPortal);
  level1CenterPortal.visible = false;

  level1ActivatedCount = 0;
  level1AllSeen = false;

  level1CurrentTargetIndex = 0;
  level1WaitingForPanelClose = false;
  level1PendingSpot = null;

  camera.position.set(0, 5, 12);
  yaw = 0;
  pitch = 0;
  updateCameraDirection();
  cameraBaseHeight = camera.position.y;
  isOnGround = true;
  jumpVelocity = 0;

  footstepList = [];
  lastFootstepPos = camera.position.clone();
  updateFootsteps();
}

function updateLevel1(dt) {
  if (level1FloorMaterial?.uniforms?.u_time) {
    level1FloorMaterial.uniforms.u_time.value = clock.getElapsedTime();
  }

  handleCameraMovement(dt);
  pulseSpots(dt);
  updateFootsteps();
  checkSpotTriggers();
  checkCenterPortal();
}

function handleCameraMovement(dt) {
  const forwardKey  = (keys["KeyW"] || keys["ArrowUp"]) ? 1 : 0;
  const backwardKey = (keys["KeyS"] || keys["ArrowDown"]) ? 1 : 0;
  const leftKey     = (keys["KeyA"] || keys["ArrowLeft"]) ? 1 : 0;
  const rightKey    = (keys["KeyD"] || keys["ArrowRight"]) ? 1 : 0;

  const moveZ = forwardKey - backwardKey;
  const moveX = rightKey - leftKey;

  if (moveZ === 0 && moveX === 0) return;

  const dir = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

  const moveVec = new THREE.Vector3();
  moveVec.addScaledVector(dir, moveZ);
  moveVec.addScaledVector(right, moveX);

  if (moveVec.lengthSq() > 0) {
    const isSprinting = keys["ShiftLeft"] || keys["ShiftRight"];
    const speed = MOVE_SPEED * (isSprinting ? SPRINT_MULTIPLIER : 1);

    moveVec.normalize().multiplyScalar(speed * dt);
    camera.position.add(moveVec);
    updateCameraDirection();

    if (!lastFootstepPos) {
      lastFootstepPos = camera.position.clone();
    } else {
      const dx = camera.position.x - lastFootstepPos.x;
      const dz = camera.position.z - lastFootstepPos.z;
      const distMoved = Math.sqrt(dx * dx + dz * dz);
      if (distMoved > FOOTSTEP_STEP_DIST) {
        addFootstepFromPosition(camera.position);
        lastFootstepPos.copy(camera.position);
      }
    }
  }

  const limit = 26;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -limit, limit);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -limit, limit);
}

function addFootstepFromPosition(pos) {
  const now = clock.getElapsedTime();

  const jitterAmount = 0.7;
  const jx = (Math.random() - 0.5) * jitterAmount;
  const jz = (Math.random() - 0.5) * jitterAmount;

  footstepList.push({ x: pos.x + jx, z: pos.z + jz, time: now });

  if (footstepList.length > MAX_FOOTSTEPS) footstepList.shift();
  updateFootsteps();
}

function updateFootsteps() {
  if (!level1FloorMaterial) return;

  const now = clock.getElapsedTime();

  for (let i = footstepList.length - 1; i >= 0; i--) {
    if (now - footstepList[i].time > FOOTSTEP_LIFETIME) {
      footstepList.splice(i, 1);
    }
  }

  const uSteps = level1FloorMaterial.uniforms.u_footsteps.value;
  const count = footstepList.length;

  for (let i = 0; i < MAX_FOOTSTEPS; i++) {
    if (i < count) uSteps[i].set(footstepList[i].x, footstepList[i].z);
    else uSteps[i].set(9999, 9999);
  }

  level1FloorMaterial.uniforms.u_footstepCount.value = count;
}

function pulseSpots(dt) {
  const t = performance.now() * 0.001;

  level1Spots.forEach((spot) => {
    const mat = spot.material;
    const idx = spot.userData.index;

    if (spot.userData.activated) {
      mat.emissiveIntensity = 0.55;
      mat.opacity = 0.42;
      return;
    }

    const isTarget = (idx === level1CurrentTargetIndex);

    if (isTarget) {
      const pulse = 2.2 + Math.sin(t * 3.2 + idx) * 0.85;
      mat.emissiveIntensity = pulse;
      mat.opacity = 0.92 + Math.sin(t * 2.0 + idx) * 0.06;
    } else {
      mat.emissiveIntensity = 0.25 + Math.sin(t * 1.5 + idx) * 0.05;
      mat.opacity = 0.35;
    }
  });

  if (level1AllSeen && level1CenterPortal) {
    const mat = level1CenterPortal.material;
    mat.emissiveIntensity = 0.8 + Math.sin(t * 3.0) * 0.3;
  }
}

function checkSpotTriggers() {
  if (level1WaitingForPanelClose) {
    if (!activeText) {
      if (level1PendingSpot) {
        level1PendingSpot.userData.activated = true;
        level1ActivatedCount++;
        level1CurrentTargetIndex++;

        const isLast = (level1ActivatedCount === level1Spots.length);
        if (isLast) {
          level1AllSeen = true;
          level1CenterPortal.visible = true;

          const mat = level1CenterPortal.material;
          mat.emissiveIntensity = 0.4;
          mat.color.set(0x00ffee);
        }
      }

      level1PendingSpot = null;
      level1WaitingForPanelClose = false;
    }
    return;
  }

  const camPos = camera.position;
  const cam2D = new THREE.Vector2(camPos.x, camPos.z);

  for (const spot of level1Spots) {
    if (spot.userData.activated) continue;

    const spot2D = new THREE.Vector2(spot.position.x, spot.position.z);
    const dist = cam2D.distanceTo(spot2D);

    if (dist < 1.5) {
      const idx = spot.userData.index;

      if (idx !== level1CurrentTargetIndex) return;

      const isLastIfCompleted = (level1ActivatedCount + 1 === level1Spots.length);
      const hintText = !isLastIfCompleted
        ? "Press ENTER after reading. The next ring will awaken."
        : "Press ENTER after reading.\nThen return to the center circle.";

      clearText();
      showTextPanel(
        "Future Memory " + (idx + 1),
        level1SpotTexts[idx],
        hintText
      );

      level1WaitingForPanelClose = true;
      level1PendingSpot = spot;

      if (activeText) {
        activeText.dataset.mode = "level1-memory";
        activeText.dataset.ringIndex = String(idx);
      }
      return;
    }
  }
}

function checkCenterPortal() {
  if (!level1AllSeen || !level1CenterPortal) return;

  const dx = camera.position.x - level1CenterPortal.position.x;
  const dz = camera.position.z - level1CenterPortal.position.z;
  const distXZ = Math.sqrt(dx * dx + dz * dz);

  if (distXZ < 3.2) {
    if (!activeText || activeText.dataset.mode !== "portal-hint") {
      clearText();
      showTextPanel(
        "Broken Timeline",
        "Ram now understands the shape of his failure:\n" +
          "Balaram Naidu’s death in 2018 shattered everything.\n" +
          "If he wants to save Shiven, Vehaan, and Guntur,\n" +
          "he must somehow prevent that murder.",
        "Press ENTER to continue."
      );
      if (activeText) activeText.dataset.mode = "portal-hint";
    }
  }
}