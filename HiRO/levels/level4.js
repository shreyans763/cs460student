// ====== LEVEL 4: INFINITY MIRROR ROOM + ORBS (FINAL) ======
let level4Group = null;

// Room
let level4RoomSize = 60;
let level4Half = level4RoomSize * 0.5;
let level4WallHeight = 16;

// Mirror env
let level4CubeCam = null;
let level4EnvRT = null;
let level4EnvUpdateTimer = 0;

// Orbs
let level4Orbs = [];
let level4SpecialOrbs = {}; // { A: orb, B: orb, C: orb }
let level4Found = { A: false, B: false, C: false };
let level4FoundCount = 0;
const LEVEL4_REQUIRED = 3;

// Weapon
let level4WeaponEquipped = false;
let level4WeaponMesh = null;
let level4WeaponSwinging = false;
let level4SwingTimer = 0;
const LEVEL4_SWING_DURATION = 0.18;

// End state
let level4Complete = false;
let level4CanReplay = false; // read in main.js

// Throw mode (cricket ball)
let level4ThrowModeEnabled = false; // toggled by G
let level4Projectiles = [];
let level4ProjectileCooldown = 0;

// Internal
let level4TempVec = new THREE.Vector3();

// Performance knobs
const LEVEL4_ENV_SIZE = 128;
const LEVEL4_ENV_UPDATE_SEC = 0.55;
const LEVEL4_SPHERE_SEG = 24;
const LEVEL4_TOTAL_ORBS = 60;
const LEVEL4_FLOAT_COUNT = 22;

// Orb-orb collision tuning
const LEVEL4_HASH_CELL = 2.4;
const LEVEL4_ORB_RESTITUTION = 0.72;
const LEVEL4_ORB_DAMP = 0.995;

function initLevel4() {
  console.log("initLevel4() – INFINITY ROOM");
  currentLevel = 4;

  clearText();
  setAimMode(false);

  if (typeof level3Group !== "undefined" && level3Group) {
    scene.remove(level3Group);
  }

  if (level4Group) scene.remove(level4Group);
  level4Group = new THREE.Group();
  level4Group.name = "LEVEL4_GROUP";
  scene.add(level4Group);

  level4Orbs = [];
  level4SpecialOrbs = {};
  level4Found = { A: false, B: false, C: false };
  level4FoundCount = 0;
  level4Complete = false;
  level4CanReplay = false;

  level4WeaponEquipped = false;
  level4WeaponSwinging = false;
  level4SwingTimer = 0;

  level4ThrowModeEnabled = false;
  level4Projectiles = [];
  level4ProjectileCooldown = 0;

  if (level4WeaponMesh) level4WeaponMesh = null;

  buildLevel4Room();
  spawnLevel4Orbs();
  setupLevel4Weapon();

  camera.position.set(0, 2.0, level4Half - 10);
  cameraBaseHeight = 2.0;
  isOnGround = true;
  jumpVelocity = 0;

  yaw = 0;
  pitch = 0;
  updateCameraDirection();

  showLevel4Intro();
}

function buildLevel4Room() {
  const floorGeo = new THREE.PlaneGeometry(level4RoomSize, level4RoomSize);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x020205, roughness: 0.25, metalness: 0.1 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  level4Group.add(floor);

  const roofGeo = new THREE.PlaneGeometry(level4RoomSize, level4RoomSize);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.2,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.x = Math.PI / 2;
  roof.position.y = level4WallHeight;
  level4Group.add(roof);

  const roofLight = new THREE.PointLight(0xffffff, 2.2, 200);
  roofLight.position.set(0, level4WallHeight - 1.0, 0);
  level4Group.add(roofLight);

  const fill = new THREE.AmbientLight(0xffffff, 0.25);
  level4Group.add(fill);

  level4EnvRT = new THREE.WebGLCubeRenderTarget(LEVEL4_ENV_SIZE, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter
  });
  level4CubeCam = new THREE.CubeCamera(0.1, 500, level4EnvRT);
  level4CubeCam.position.set(0, 6, 0);
  level4Group.add(level4CubeCam);

  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.05,
    envMap: level4EnvRT.texture,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide
  });

  const wallGeo = new THREE.PlaneGeometry(level4RoomSize, level4WallHeight);

  const back = new THREE.Mesh(wallGeo, mirrorMat.clone());
  back.position.set(0, level4WallHeight * 0.5, -level4Half);
  level4Group.add(back);

  const front = new THREE.Mesh(wallGeo, mirrorMat.clone());
  front.position.set(0, level4WallHeight * 0.5, level4Half);
  front.rotation.y = Math.PI;
  level4Group.add(front);

  const left = new THREE.Mesh(wallGeo, mirrorMat.clone());
  left.position.set(-level4Half, level4WallHeight * 0.5, 0);
  left.rotation.y = Math.PI / 2;
  level4Group.add(left);

  const right = new THREE.Mesh(wallGeo, mirrorMat.clone());
  right.position.set(level4Half, level4WallHeight * 0.5, 0);
  right.rotation.y = -Math.PI / 2;
  level4Group.add(right);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.95, metalness: 0.1 });
  const frameThickness = 0.18;
  const frameDepth = 0.18;
  const postGeo = new THREE.BoxGeometry(frameThickness, level4WallHeight, frameDepth);
  const corners = [
    [-level4Half, level4WallHeight * 0.5, -level4Half],
    [-level4Half, level4WallHeight * 0.5,  level4Half],
    [ level4Half, level4WallHeight * 0.5, -level4Half],
    [ level4Half, level4WallHeight * 0.5,  level4Half],
  ];
  for (const c of corners) {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(c[0], c[1], c[2]);
    level4Group.add(post);
  }
}

function spawnLevel4Orbs() {
  const orbMatBase = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0,
    roughness: 0.06,
    envMap: level4EnvRT ? level4EnvRT.texture : null,
    envMapIntensity: 1.15
  });

  const total = LEVEL4_TOTAL_ORBS;
  const floatCount = LEVEL4_FLOAT_COUNT;

  for (let i = 0; i < total; i++) {
    const r = 0.55 + Math.random() * 0.75;
    const geo = new THREE.SphereGeometry(r, LEVEL4_SPHERE_SEG, LEVEL4_SPHERE_SEG);
    const mat = orbMatBase.clone();

    const tint = 0.96 + Math.random() * 0.08;
    mat.color.setRGB(tint, tint, tint);

    const mesh = new THREE.Mesh(geo, mat);

    const margin = 6.0;
    const x = (Math.random() * 2 - 1) * (level4Half - margin);
    const z = (Math.random() * 2 - 1) * (level4Half - margin);

    let y, isFloating;
    if (i < floatCount) {
      isFloating = true;
      y = 3.0 + Math.random() * 8.0;
    } else {
      isFloating = false;
      y = r;
    }

    mesh.position.set(x, y, z);
    level4Group.add(mesh);

    const orb = {
      mesh,
      radius: r,
      isFloating,
      vel: new THREE.Vector3(
        (Math.random() * 2 - 1) * 0.6,
        (isFloating ? (Math.random() * 2 - 1) * 0.25 : 0),
        (Math.random() * 2 - 1) * 0.6
      ),
      bobPhase: Math.random() * Math.PI * 2,
      popped: false,
      specialKey: null,
      halo: null,
      haloPhase: Math.random() * Math.PI * 2
    };

    level4Orbs.push(orb);
  }

  const candidates = level4Orbs.filter(o => !o.popped);
  shuffleArrayInPlace(candidates);
  assignSpecialOrb(candidates[0], "A", 0x9be7ff);
  assignSpecialOrb(candidates[1], "B", 0xffe09b);
  assignSpecialOrb(candidates[2], "C", 0xffa3a3);

  updateLevel4EnvMap(true);
}

function assignSpecialOrb(orb, key, rimColorHex) {
  if (!orb) return;
  orb.specialKey = key;
  level4SpecialOrbs[key] = orb;

  orb.mesh.scale.multiplyScalar(1.06);

  const m = orb.mesh.material;
  m.emissive = new THREE.Color(rimColorHex).multiplyScalar(0.10);
  m.emissiveIntensity = 0.95;

  const haloGeo = new THREE.TorusGeometry(orb.radius * 1.07, orb.radius * 0.06, 10, 40);
  const haloMat = new THREE.MeshBasicMaterial({
    color: rimColorHex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = Math.PI / 2; // ring around orb
  orb.mesh.add(halo);
  orb.halo = halo;
}

function setupLevel4Weapon() {
  const batGroup = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0xcaa26a, roughness: 0.55, metalness: 0.05 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.9, metalness: 0.0 });

  const bladeGeo = new THREE.BoxGeometry(0.16, 1.05, 0.06);
  const blade = new THREE.Mesh(bladeGeo, woodMat);
  blade.position.set(0.18, 0.40, 0);
  batGroup.add(blade);

  const edgeGeo = new THREE.BoxGeometry(0.06, 1.02, 0.07);
  const edge = new THREE.Mesh(edgeGeo, woodMat.clone());
  edge.position.set(0.08, 0.40, 0);
  batGroup.add(edge);

  const handleGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.75, 16);
  const handle = new THREE.Mesh(handleGeo, gripMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-0.18, 0.05, 0);
  batGroup.add(handle);

  const capGeo = new THREE.SphereGeometry(0.06, 16, 16);
  const cap = new THREE.Mesh(capGeo, gripMat.clone());
  cap.position.set(-0.55, 0.05, 0);
  batGroup.add(cap);

  level4WeaponMesh = batGroup;
}

function toggleLevel4Weapon() {
  if (level4Complete) return;

  level4WeaponEquipped = !level4WeaponEquipped;

  if (level4WeaponEquipped) {
    if (level4WeaponMesh && !level4WeaponMesh.parent) {
      camera.add(level4WeaponMesh);
      level4WeaponMesh.position.set(0.38, -0.35, -0.75);
      level4WeaponMesh.rotation.set(-0.15, 0.35, 0.1);
    }

    showTextPanel(
      "Level 4 – Bat Equipped",
      "Ram grips the bat.\nClose orbs can be shattered by force.",
      "Tip: Press G for throw mode (for far / floating orbs)."
    );
    if (activeText) activeText.dataset.mode = "level4-hunt";

  } else {
    if (level4WeaponMesh && level4WeaponMesh.parent) camera.remove(level4WeaponMesh);

    showTextPanel(
      "Level 4 – Bat Unequipped",
      "The mirrors keep multiplying choices.",
      "Press F to equip the bat.\nPress G for throw mode."
    );
    if (activeText) activeText.dataset.mode = "level4-idle";
  }
}

// ===== THROW MODE (G) =====
function toggleLevel4ThrowMode() {
  if (level4Complete) return;

  level4ThrowModeEnabled = !level4ThrowModeEnabled;
  setAimMode(false);

  if (level4ThrowModeEnabled) {
    showTextPanel(
      "Throw Mode Enabled",
      "Cricket ball ready.\nFar or floating orbs won’t hide anymore.",
      "Right-click to focus (crosshair).\nLeft-click to throw.\nPress G again to disable."
    );
    if (activeText) activeText.dataset.mode = "level4-throw";
  } else {
    showTextPanel("Throw Mode Disabled", "Back to normal hunting.", "Press G to enable throw mode again.");
    if (activeText) activeText.dataset.mode = "level4-hunt";
  }
}

function showLevel4Intro() {
  showTextPanel(
    "Level 4 – Infinity Room (2017)",
    "Ram wakes inside a soft-white infinity.\nMirrors stretch the room into forever.\nChrome orbs drift like stolen gravity.\n\nEach orb is a decision point.\nOnly three matter.",
    "Press F to equip the bat.\nPress G to enable throw mode (for air/far orbs)."
  );
  if (activeText) activeText.dataset.mode = "level4-intro";
}

function level4ThrowCricketBall() {
  if (currentLevel !== 4) return;
  if (!level4ThrowModeEnabled) return;
  if (!isAimMode) return;
  if (level4Complete) return;
  if (level4ProjectileCooldown > 0) return;

  level4ProjectileCooldown = 0.18;

  const ballGeo = new THREE.SphereGeometry(0.12, 14, 14);
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.15,
    emissive: 0x111111,
    emissiveIntensity: 0.4
  });

  const mesh = new THREE.Mesh(ballGeo, ballMat);

  const camPos = camera.getWorldPosition(new THREE.Vector3());
  const camDir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  ).normalize();

  const start = camPos.clone().add(camDir.clone().multiplyScalar(0.7));
  mesh.position.copy(start);
  level4Group.add(mesh);

  const speed = 18.0;
  level4Projectiles.push({ mesh, vel: camDir.clone().multiplyScalar(speed), life: 1.6 });
}

function updateLevel4(dt) {
  handleCameraMovement(dt);

  const margin = 2.2;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -level4Half + margin, level4Half - margin);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -level4Half + margin, level4Half - margin);

  simulateLevel4Orbs(dt);
  simulateLevel4Projectiles(dt);

  if (level4ProjectileCooldown > 0) {
    level4ProjectileCooldown = Math.max(0, level4ProjectileCooldown - dt);
  }

  // ✅ animate halos (pulse + spin)
  const t = performance.now() * 0.001;
  for (const orb of level4Orbs) {
    if (orb.popped) continue;
    if (orb.specialKey && orb.halo) {
      orb.halo.rotation.z += dt * 1.6;
      const pulse = 1.0 + 0.08 * Math.sin(t * 2.1 + orb.haloPhase);
      orb.halo.scale.setScalar(pulse);
      orb.halo.material.opacity = 0.45 + 0.18 * (0.5 + 0.5 * Math.sin(t * 2.1 + orb.haloPhase));
    }
  }

  if (level4WeaponSwinging && level4WeaponMesh) {
    level4SwingTimer += dt;
    const tt = Math.min(1, level4SwingTimer / LEVEL4_SWING_DURATION);
    const arc = Math.sin(tt * Math.PI);
    level4WeaponMesh.rotation.x = -0.15 - arc * 0.85;
    level4WeaponMesh.rotation.y = 0.35 + arc * 0.40;
    level4WeaponMesh.rotation.z = 0.10 - arc * 0.25;
    if (tt >= 1) {
      level4WeaponSwinging = false;
      level4SwingTimer = 0;
      level4WeaponMesh.rotation.set(-0.15, 0.35, 0.1);
    }
  }

  level4EnvUpdateTimer += dt;
  if (level4EnvUpdateTimer > LEVEL4_ENV_UPDATE_SEC) {
    level4EnvUpdateTimer = 0;
    updateLevel4EnvMap(false);
  }
}

function simulateLevel4Orbs(dt) {
  const t = performance.now() * 0.001;
  const bound = level4Half - 2.0;

  for (const orb of level4Orbs) {
    if (orb.popped) continue;

    const p = orb.mesh.position;
    const r = orb.radius;

    if (orb.isFloating) {
      const bob = 0.25 * Math.sin(t * 1.2 + orb.bobPhase);
      orb.vel.y += (bob * 0.6 - orb.vel.y) * 0.25 * dt;

      orb.vel.multiplyScalar(1.0 - 0.18 * dt);
      p.addScaledVector(orb.vel, dt);

      const yMin = 2.2;
      const yMax = level4WallHeight - 2.6;
      if (p.y < yMin) { p.y = yMin; orb.vel.y *= -0.55; }
      if (p.y > yMax) { p.y = yMax; orb.vel.y *= -0.55; }

    } else {
      orb.vel.y = 0;
      orb.vel.multiplyScalar(1.0 - 0.28 * dt);
      p.addScaledVector(orb.vel, dt);
      p.y = r;
    }

    if (p.x < -bound) { p.x = -bound; orb.vel.x *= -0.7; }
    if (p.x > bound)  { p.x = bound;  orb.vel.x *= -0.7; }
    if (p.z < -bound) { p.z = -bound; orb.vel.z *= -0.7; }
    if (p.z > bound)  { p.z = bound;  orb.vel.z *= -0.7; }

    const dx = p.x - camera.position.x;
    const dz = p.z - camera.position.z;
    const dist2 = dx * dx + dz * dz;
    const minDist = 1.4;
    if (dist2 < minDist * minDist) {
      const dist = Math.max(0.00001, Math.sqrt(dist2));
      const push = (minDist - dist);
      p.x += (dx / dist) * push;
      p.z += (dz / dist) * push;
      orb.vel.x += (dx / dist) * push * 1.2;
      orb.vel.z += (dz / dist) * push * 1.2;
    }

    orb.vel.multiplyScalar(LEVEL4_ORB_DAMP);
  }

  resolveLevel4OrbOrbCollisions();
}

function hashKey(ix, iy, iz) {
  return ix + "," + iy + "," + iz;
}

function resolveLevel4OrbOrbCollisions() {
  const cell = LEVEL4_HASH_CELL;
  const map = new Map();

  for (let i = 0; i < level4Orbs.length; i++) {
    const a = level4Orbs[i];
    if (a.popped) continue;
    const p = a.mesh.position;

    const ix = Math.floor(p.x / cell);
    const iy = Math.floor(p.y / cell);
    const iz = Math.floor(p.z / cell);

    const key = hashKey(ix, iy, iz);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(i);
  }

  const neigh = [-1, 0, 1];

  for (const [key, indices] of map.entries()) {
    const parts = key.split(",").map(Number);
    const ix0 = parts[0], iy0 = parts[1], iz0 = parts[2];

    for (const dx of neigh) for (const dy of neigh) for (const dz of neigh) {
      const k2 = hashKey(ix0 + dx, iy0 + dy, iz0 + dz);
      const list2 = map.get(k2);
      if (!list2) continue;

      for (const i of indices) {
        for (const j of list2) {
          if (j <= i) continue;

          const A = level4Orbs[i];
          const B = level4Orbs[j];
          if (!A || !B || A.popped || B.popped) continue;

          const pa = A.mesh.position;
          const pb = B.mesh.position;

          const vx = pb.x - pa.x;
          const vy = pb.y - pa.y;
          const vz = pb.z - pa.z;

          const rr = A.radius + B.radius;
          const dist2 = vx*vx + vy*vy + vz*vz;
          if (dist2 >= rr*rr) continue;

          const dist = Math.max(0.00001, Math.sqrt(dist2));
          const nx = vx / dist, ny = vy / dist, nz = vz / dist;

          const penetration = rr - dist;
          const push = penetration * 0.5;

          pa.x -= nx * push;
          pa.y -= ny * push;
          pa.z -= nz * push;

          pb.x += nx * push;
          pb.y += ny * push;
          pb.z += nz * push;

          const rvx = B.vel.x - A.vel.x;
          const rvy = B.vel.y - A.vel.y;
          const rvz = B.vel.z - A.vel.z;
          const relVelN = rvx*nx + rvy*ny + rvz*nz;

          if (relVelN > 0) continue;

          const e = LEVEL4_ORB_RESTITUTION;
          const jImpulse = -(1 + e) * relVelN * 0.5;

          const ix = jImpulse * nx;
          const iy = jImpulse * ny;
          const iz = jImpulse * nz;

          A.vel.x -= ix; A.vel.y -= iy; A.vel.z -= iz;
          B.vel.x += ix; B.vel.y += iy; B.vel.z += iz;
        }
      }
    }
  }
}

function updateLevel4EnvMap(force) {
  if (!level4CubeCam || !level4EnvRT) return;

  let wasWeaponVisible = false;
  if (level4WeaponMesh && level4WeaponMesh.parent) {
    wasWeaponVisible = level4WeaponMesh.visible;
    level4WeaponMesh.visible = false;
  }

  level4CubeCam.update(renderer, scene);

  if (level4WeaponMesh && level4WeaponMesh.parent) {
    level4WeaponMesh.visible = wasWeaponVisible;
  }
}

function level4TrySwing() {
  if (currentLevel !== 4) return;
  if (!level4WeaponEquipped) return;
  if (level4Complete) return;
  if (level4WeaponSwinging) return;

  level4WeaponSwinging = true;
  level4SwingTimer = 0;

  const hit = findBestOrbHit();
  if (hit) popLevel4Orb(hit);
}

function findBestOrbHit() {
  const camPos = camera.position;
  const camDir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  ).normalize();

  let best = null;
  let bestScore = 1e9;

  const maxDist = 3.2;
  const minDot = 0.25;

  for (const orb of level4Orbs) {
    if (orb.popped) continue;

    level4TempVec.copy(orb.mesh.position).sub(camPos);
    const dist = level4TempVec.length();
    if (dist > maxDist) continue;

    const dirTo = level4TempVec.clone().normalize();
    const dot = camDir.dot(dirTo);
    if (dot < minDot) continue;

    const score = dist * 0.9 + (1.0 - dot) * 1.8;
    if (score < bestScore) {
      bestScore = score;
      best = orb;
    }
  }
  return best;
}

function simulateLevel4Projectiles(dt) {
  if (level4Projectiles.length === 0) return;

  const bound = level4Half - 1.0;

  for (let i = level4Projectiles.length - 1; i >= 0; i--) {
    const pr = level4Projectiles[i];
    pr.life -= dt;

    if (pr.life <= 0) {
      if (pr.mesh.parent) pr.mesh.parent.remove(pr.mesh);
      level4Projectiles.splice(i, 1);
      continue;
    }

    pr.mesh.position.addScaledVector(pr.vel, dt);

    const p = pr.mesh.position;
    if (p.x < -bound || p.x > bound || p.z < -bound || p.z > bound || p.y < 0.3 || p.y > level4WallHeight - 0.3) {
      if (pr.mesh.parent) pr.mesh.parent.remove(pr.mesh);
      level4Projectiles.splice(i, 1);
      continue;
    }

    for (const orb of level4Orbs) {
      if (orb.popped) continue;

      const dx = orb.mesh.position.x - p.x;
      const dy = orb.mesh.position.y - p.y;
      const dz = orb.mesh.position.z - p.z;
      const rr = orb.radius + 0.12;

      if (dx*dx + dy*dy + dz*dz < rr*rr) {
        popLevel4Orb(orb);
        if (pr.mesh.parent) pr.mesh.parent.remove(pr.mesh);
        level4Projectiles.splice(i, 1);
        break;
      }
    }
  }
}

function popLevel4Orb(orb) {
  orb.popped = true;

  const mesh = orb.mesh;
  const startScale = mesh.scale.x;
  const startTime = performance.now();

  function animatePop() {
    const now = performance.now();
    const t = (now - startTime) / 180;
    const k = Math.max(0, 1 - t);

    mesh.scale.setScalar(startScale * k);

    if (mesh.material && mesh.material.emissive) {
      mesh.material.emissiveIntensity = 0.9 * k;
    }

    if (t < 1) requestAnimationFrame(animatePop);
    else if (mesh.parent) mesh.parent.remove(mesh);
  }

  animatePop();

  if (orb.specialKey) {
    const key = orb.specialKey;
    if (!level4Found[key]) {
      level4Found[key] = true;
      level4FoundCount++;

      const choiceText = getChoiceTextByKey(key);
      clearText();
      showTextPanel("Decision Locked", choiceText, `Orbs popped: ${level4FoundCount} / ${LEVEL4_REQUIRED}`);
      if (activeText) activeText.dataset.mode = "level4-choice";

      if (level4FoundCount >= LEVEL4_REQUIRED) finishLevel4();
    }
  } else {
    if (!activeText || activeText.dataset.mode !== "level4-choice") {
      showTextPanel(
        "Shattered Reflection",
        "A future fragment collapses into nothing.\nNot this one.",
        `Find the 3 marked orbs. (${level4FoundCount} / ${LEVEL4_REQUIRED})`
      );
      if (activeText) activeText.dataset.mode = "level4-hunt";
    }
  }
}

function getChoiceTextByKey(key) {
  if (key === "A") return "Orb A → Expose Hiteshwar";
  if (key === "B") return "Orb B → Secretly warn Balaram Naidu";
  return "Orb C → Use gang to distract/corner goons";
}

function finishLevel4() {
  level4Complete = true;
  level4CanReplay = true;

  setAimMode(false);
  level4ThrowModeEnabled = false;

  if (level4WeaponMesh && level4WeaponMesh.parent) camera.remove(level4WeaponMesh);
  level4WeaponEquipped = false;

  const ending =
    "In the new timeline…\n" +
    "Ram leaks proof of Hiteshwar’s deal,\n" +
    "quietly warns Balaram Naidu’s team,\n" +
    "and uses his gang to corner the hired goons\n" +
    "before they reach their target.\n" +
    "The attack fails.\n" +
    "Balaram Naidu lives.\n" +
    "Without his father’s death,\n" +
    "Vehaan never collapses into madness.\n" +
    "Shiven never dies under the neem tree.\n" +
    "The neem remembers only laughter, not blood.\n" +
    "The timeline is saved.\n\n" +
    "THE END";

  clearText();
  showTextPanel("Timeline Restored", ending, "Press R to replay from Level 1.");
  if (activeText) activeText.dataset.mode = "level4-end";
}

function cheatCompleteLevel4() {
  if (level4Complete) return;
  level4Found.A = true;
  level4Found.B = true;
  level4Found.C = true;
  level4FoundCount = 3;
  finishLevel4();
}

function shuffleArrayInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function disposeLevel4() {
  try {
    if (level4WeaponMesh && level4WeaponMesh.parent) {
      level4WeaponMesh.parent.remove(level4WeaponMesh);
    }
  } catch (e) {}

  try {
    if (level4Group) {
      level4Group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
      if (level4Group.parent) level4Group.parent.remove(level4Group);
    }
  } catch (e) {}

  level4Group = null;

  try { if (level4EnvRT) level4EnvRT.dispose?.(); } catch (e) {}
  level4EnvRT = null;
  level4CubeCam = null;

  level4Orbs = [];
  level4SpecialOrbs = {};
  level4Found = { A: false, B: false, C: false };
  level4FoundCount = 0;
  level4Complete = false;
  level4CanReplay = false;
  level4WeaponEquipped = false;
  level4WeaponSwinging = false;
  level4SwingTimer = 0;
}

window.disposeLevel4 = disposeLevel4;