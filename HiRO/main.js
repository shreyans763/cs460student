// ===== BASIC THREE.JS SETUP =====
let scene, camera, renderer, clock;
let controls; // optional
let currentLevel = 1;

const keys = {};
let uiOverlay;
let activeText = null;
let uiHidden = false;

// FPS overlay
let fpsPanel = null;
let fpsVisible = false;
let fpsSmooth = 0;

// Pointer lock state
let isPointerLocked = false;

// Level 1 objects (used and reset in level1.js)
let level1Floor;
let level1FloorMaterial;
let level1Walls = [];
let level1Spots = [];
let level1CenterPortal = null;
let level1ActivatedCount = 0;
let level1AllSeen = false;

// Footsteps driven inside the shader
const MAX_FOOTSTEPS = 16;
const FOOTSTEP_LIFETIME = 10.0;
const FOOTSTEP_STEP_DIST = 0.6;
let footstepList = [];
let lastFootstepPos = null;

// Camera move speed
const MOVE_SPEED = 3;
const SPRINT_MULTIPLIER = 3;

// Mouse-look state
let yaw = 0;
let pitch = 0;
let lastMouseX = null;
let lastMouseY = null;
const MOUSE_SENSITIVITY = 0.0015;

// ===== JUMP STATE (SPACE = jump, double-tap = long jump) =====
let jumpVelocity = 0;
let isOnGround = true;
let cameraBaseHeight = 5;
let lastJumpPressTime = 0;
const JUMP_DOUBLE_TAP_WINDOW = 0.25; // seconds
const JUMP_VELOCITY = 7.0;
const LONG_JUMP_VELOCITY = 11.0;
const GRAVITY = 20.0;

// ===== SHARED RAYCAST / CROSSHAIR FOR LEVEL 2 + LEVEL 4 =====
let raycaster = null;
let crosshairEl = null;
let isAimMode = false;

window.addEventListener("load", () => {
  uiOverlay = document.getElementById("ui-overlay");
  if (uiOverlay) {
    uiOverlay.style.display = "block";
  }
  initThree();
  initCrosshairUI();
  initLevel1IntroText();
  initFPSOverlay();
  animate();
});

// ===== THREE INIT =====
function initThree() {
  const canvas = document.getElementById("game-canvas");

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // --- POINTER LOCK SETUP (O key will control it) ---
  canvas.style.cursor = "none";

  function updatePointerLockState() {
    isPointerLocked = (document.pointerLockElement === document.body);
    console.log("Pointer locked:", isPointerLocked);
    canvas.style.cursor = isPointerLocked ? "none" : "auto";
  }

  document.addEventListener("pointerlockchange", updatePointerLockState);
  document.addEventListener("pointerlockerror", () => {
    console.warn("Pointer lock error");
  });
  // --- END POINTER LOCK SETUP ---

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070b);

  const fov = 60;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 1000;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 5, 12);
  camera.lookAt(0, 0, 0);

  yaw = 0;
  pitch = 0;

  clock = new THREE.Clock();

  // Lights
  const ambient = new THREE.AmbientLight(0x8888aa, 0.7);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  scene.add(dir);

  raycaster = new THREE.Raycaster();

  // Input
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("contextmenu", (e) => e.preventDefault());

  initLevel1();
}

// ===== INPUT HANDLERS =====
function onKeyDown(e) {
  keys[e.code] = true;

  if (e.code === "Space") {
    const now = performance.now() / 1000;
    const delta = now - lastJumpPressTime;

    if (isOnGround) {
      jumpVelocity = (delta < JUMP_DOUBLE_TAP_WINDOW) ? LONG_JUMP_VELOCITY : JUMP_VELOCITY;
      isOnGround = false;
    }

    lastJumpPressTime = now;
    return;
  }

  if (e.code === "KeyG") {
    if (currentLevel === 4 && typeof toggleLevel4ThrowMode === "function") {
      toggleLevel4ThrowMode();
    }
    return;
  }

  if (e.code === "KeyF") {
    if (currentLevel === 4 && typeof toggleLevel4Weapon === "function") {
      toggleLevel4Weapon();
    }
    return;
  }

  if (e.code === "KeyR") {
    if (currentLevel === 4 && typeof level4CanReplay !== "undefined" && level4CanReplay) {
      restartGameToLevel1();
    }
    return;
  }

  if (e.code === "KeyE") {
    if (currentLevel === 3 && typeof handleLevel3Interact === "function") {
      handleLevel3Interact();
    }
    return;
  }

  if (e.code === "Enter") {

    if (currentLevel === 1 && activeText && activeText.dataset.mode === "intro") {
      clearText();
      showTextPanel(
        "Level 1 – Broken Future",
        "Move with WASD / Arrow keys.\nFollow the glowing ring.\nOnly one ring awakens at a time.",
        "Press ENTER to close any memory panel."
      );
      activeText.dataset.mode = "hint";
      return;
    }

    if (
      currentLevel === 1 &&
      activeText &&
      (activeText.dataset.mode === "hint" ||
        activeText.dataset.mode === "level1-memory" ||
        activeText.dataset.mode === "level1-wrong-ring")
    ) {
      clearText();
      return;
    }

    if (currentLevel === 1 && activeText && activeText.dataset.mode === "portal-hint") {
      clearText();
      if (typeof initLevel2 === "function") {
        console.log("Switching to Level 2 – Iris Wall (via ENTER)");
        initLevel2();
      } else {
        console.error("initLevel2 is not defined. Is levels/level2.js loaded correctly?");
        showTextPanel(
          "Level 2 Not Loaded",
          "The Iris Wall script (levels/level2.js) is not available or has an error.\nOpen the browser console to see more details.",
          ""
        );
      }
      return;
    }

    if (currentLevel === 2 && activeText && activeText.dataset.mode === "iris-complete") {
      clearText();
      if (typeof initLevel3 === "function") {
        console.log("Switching to Level 3 – InsideOut House");
        initLevel3();
      } else {
        showTextPanel(
          "Level 3 Not Loaded",
          "The InsideOut House script (levels/level3.js) is missing or has an error.",
          "Check the browser console for details."
        );
      }
      return;
    }

    if (currentLevel === 3 && activeText && activeText.dataset.mode === "level3-intro") {
      clearText();
      return;
    }

    if (currentLevel === 3) {
      const completed = (typeof level3Completed !== "undefined" && level3Completed === true);

      if (completed) {
        clearText();
        if (typeof initLevel4 === "function") {
          console.log("Switching to Level 4 – Infinity Orbs (Level 3 completed)");
          initLevel4();
        } else {
          showTextPanel(
            "Level 4 Not Loaded",
            "Level 4 script (levels/level4.js) is missing or has an error.",
            "Check the browser console for details."
          );
        }
        return;
      }

      if (activeText && activeText.dataset.mode === "level3-complete") {
        clearText();
        if (typeof initLevel4 === "function") {
          console.log("Switching to Level 4 – Infinity Orbs (via panel)");
          initLevel4();
        } else {
          showTextPanel(
            "Level 4 Not Loaded",
            "Level 4 script (levels/level4.js) is missing or has an error.",
            "Check the browser console for details."
          );
        }
        return;
      }
    }

  }

  if (e.code === "KeyH") {
    console.log("Cheat key H pressed");
    if (currentLevel === 1) {
      clearText();
      if (typeof initLevel2 === "function") {
        console.log("Cheat: skipping Level 1 → Level 2");
        initLevel2();
      } else {
        showTextPanel(
          "Cheat Failed",
          "Level 2 script (levels/level2.js) is missing or has an error.",
          "Check the browser console for details."
        );
      }
    } else if (currentLevel === 2) {
      clearText();
      if (typeof initLevel3 === "function") {
        console.log("Cheat: skipping Level 2 → Level 3");
        initLevel3();
      } else {
        showTextPanel(
          "Cheat Failed",
          "Level 3 script (levels/level3.js) is missing or has an error.",
          "Check the browser console for details."
        );
      }
    } else if (currentLevel === 3) {
      console.log("Cheat: auto-completing Level 3");
      if (typeof onLevel3AllConnectionsComplete === "function") {
        onLevel3AllConnectionsComplete();
      } else {
        clearText();
        showTextPanel(
          "Cheat Failed",
          "Level 3 completion function is missing.",
          ""
        );
      }
    } else if (currentLevel === 4) {
      console.log("Cheat: auto-completing Level 4");
      if (typeof cheatCompleteLevel4 === "function") {
        cheatCompleteLevel4();
      }
    }
    return;
  }

  if (e.code === "KeyO") {
    if (!isPointerLocked) {
      console.log("Requesting pointer lock via O…");
      document.body.requestPointerLock();
    } else {
      console.log("Exiting pointer lock via O…");
      document.exitPointerLock();
    }
    return;
  }

  if (e.code === "KeyP") {
    fpsVisible = !fpsVisible;
    if (fpsPanel) {
      fpsPanel.style.display = (!uiHidden && fpsVisible) ? "block" : "none";
    }
    return;
  }

  if (e.code === "KeyJ") {
    uiHidden = !uiHidden;

    if (uiOverlay) {
      uiOverlay.style.display = uiHidden ? "none" : "block";
    }

    if (fpsPanel) {
      fpsPanel.style.display = (!uiHidden && fpsVisible) ? "block" : "none";
    }

    setAimMode(isAimMode);

    return;
  }
}

function onKeyUp(e) {
  keys[e.code] = false;
}

function onMouseMove(e) {
  let dx = 0;
  let dy = 0;

  if (isPointerLocked) {
    dx = e.movementX || 0;
    dy = e.movementY || 0;
  } else {
    if (lastMouseX === null || lastMouseY === null) {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      return;
    }
    dx = e.clientX - lastMouseX;
    dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  yaw += dx * MOUSE_SENSITIVITY;
  pitch -= dy * MOUSE_SENSITIVITY;

  const maxPitch = Math.PI / 2 - 0.1;
  pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));

  updateCameraDirection();
}

function onMouseDown(e) {
  // Level 2 only
  if (currentLevel === 2) {
    if (e.button === 2) {
      setAimMode(!isAimMode);
      return;
    }
    if (e.button === 0 && isAimMode) {
      if (typeof tryInteractWithIrisEye === "function") {
        tryInteractWithIrisEye();
      }
      return;
    }
  }

  // Level 4
  if (currentLevel === 4) {
    if (e.button === 2) {
      if (typeof level4ThrowModeEnabled !== "undefined" && level4ThrowModeEnabled) {
        setAimMode(!isAimMode);
      }
      return;
    }

    if (e.button === 0) {
      if (typeof level4ThrowModeEnabled !== "undefined" && level4ThrowModeEnabled && isAimMode) {
        if (typeof level4ThrowCricketBall === "function") {
          level4ThrowCricketBall();
        }
        return;
      }

      if (typeof level4TrySwing === "function") {
        level4TrySwing();
      }
      return;
    }
  }
}

function updateCameraDirection() {
  const dir = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );
  const target = new THREE.Vector3().copy(camera.position).add(dir);
  camera.lookAt(target);
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  updateFPS(dt);

  if (currentLevel === 1) {
    updateLevel1(dt);
    if (level1FloorMaterial) {
      level1FloorMaterial.uniforms.u_time.value = clock.getElapsedTime();
    }
  } else if (currentLevel === 2) {
    updateLevel2(dt);
  } else if (currentLevel === 3) {
    updateLevel3(dt);
  } else if (currentLevel === 4) {
    updateLevel4(dt);
  }

  updateJump(dt);

  renderer.render(scene, camera);
}

function showTextPanel(title, body, hint = "") {
  uiOverlay.innerHTML = `
    <div class="panel" data-mode="">
      <div class="title">${title}</div>
      <div class="body">${body.replace(/\n/g, "<br>")}</div>
      ${hint ? `<div class="hint">${hint}</div>` : ""}
    </div>
  `;
  activeText = uiOverlay.querySelector(".panel");
}

function clearText() {
  uiOverlay.innerHTML = "";
  activeText = null;
}

function initFPSOverlay() {
  fpsPanel = document.createElement("div");
  fpsPanel.textContent = "FPS: 0";
  Object.assign(fpsPanel.style, {
    position: "fixed",
    left: "10px",
    bottom: "10px",
    padding: "4px 8px",
    borderRadius: "6px",
    background: "rgba(0, 0, 0, 0.6)",
    border: "1px solid rgba(150, 200, 255, 0.6)",
    color: "#E1EFFF",
    fontSize: "12px",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    pointerEvents: "none",
    display: "none",
    zIndex: "1000"
  });
  document.body.appendChild(fpsPanel);
}

function updateFPS(dt) {
  if (!fpsVisible || !fpsPanel) return;

  const instFPS = dt > 0 ? 1 / dt : 0;
  if (fpsSmooth === 0) fpsSmooth = instFPS;
  fpsSmooth = fpsSmooth * 0.9 + instFPS * 0.1;

  fpsPanel.textContent = "FPS: " + fpsSmooth.toFixed(0);
}

function updateJump(dt) {
  if (!isOnGround || jumpVelocity !== 0) {
    jumpVelocity -= GRAVITY * dt;
    camera.position.y += jumpVelocity * dt;

    if (camera.position.y <= cameraBaseHeight) {
      camera.position.y = cameraBaseHeight;
      jumpVelocity = 0;
      isOnGround = true;
    }
  }
}

function initCrosshairUI() {
  crosshairEl = document.createElement("div");
  Object.assign(crosshairEl.style, {
    position: "fixed",
    left: "50%",
    top: "50%",
    width: "14px",
    height: "14px",
    marginLeft: "-7px",
    marginTop: "-7px",
    borderRadius: "50%",
    border: "2px solid rgba(200, 230, 255, 0.9)",
    boxSizing: "border-box",
    pointerEvents: "none",
    zIndex: "999",
    display: "none",
    backdropFilter: "blur(2px)"
  });

  const horizontal = document.createElement("div");
  const vertical = document.createElement("div");
  [horizontal, vertical].forEach(line => {
    Object.assign(line.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      background: "rgba(200, 230, 255, 0.9)",
      transform: "translate(-50%, -50%)"
    });
  });
  horizontal.style.width = "8px";
  horizontal.style.height = "1px";
  vertical.style.width = "1px";
  vertical.style.height = "8px";

  crosshairEl.appendChild(horizontal);
  crosshairEl.appendChild(vertical);
  document.body.appendChild(crosshairEl);
}

function setAimMode(enabled) {
  isAimMode = enabled;
  if (!crosshairEl) return;

  const allow =
    (currentLevel === 2) ||
    (currentLevel === 4 && typeof level4ThrowModeEnabled !== "undefined" && level4ThrowModeEnabled);

  if (allow && enabled && !uiHidden) {
    crosshairEl.style.display = "block";
  } else {
    crosshairEl.style.display = "none";
  }
}

// =====================================================
// HARD RESET HELPERS
// =====================================================
function cleanupLevel1() {
  if (typeof level1Floor !== "undefined" && level1Floor) {
    scene.remove(level1Floor);
    level1Floor = null;
  }
  if (typeof level1Walls !== "undefined" && level1Walls.length) {
    level1Walls.forEach(w => scene.remove(w));
    level1Walls = [];
  }
  if (typeof level1Spots !== "undefined" && level1Spots.length) {
    level1Spots.forEach(s => scene.remove(s));
    level1Spots = [];
  }
  if (typeof level1CenterPortal !== "undefined" && level1CenterPortal) {
    scene.remove(level1CenterPortal);
    level1CenterPortal = null;
  }
  level1ActivatedCount = 0;
  level1AllSeen = false;

  footstepList = [];
  lastFootstepPos = null;
}

function cleanupLevel2() {
  try {
    if (typeof irisWallGroup !== "undefined" && irisWallGroup) {
      scene.remove(irisWallGroup);
      irisWallGroup = null;
    }
    if (typeof irisFloor !== "undefined" && irisFloor) {
      scene.remove(irisFloor);
      irisFloor = null;
    }
    if (typeof irisRoof !== "undefined" && irisRoof) {
      scene.remove(irisRoof);
      irisRoof = null;
    }
    if (typeof irisRoomWalls !== "undefined" && irisRoomWalls.length) {
      irisRoomWalls.forEach(w => scene.remove(w));
      irisRoomWalls = [];
    }
    if (typeof irisClueHud !== "undefined" && irisClueHud && irisClueHud.parentElement) {
      irisClueHud.parentElement.removeChild(irisClueHud);
      irisClueHud = null;
    }
  } catch (err) {
    console.warn("cleanupLevel2 warning:", err);
  }
  setAimMode(false);
}

function cleanupLevel3() {
  try {
    if (typeof level3Group !== "undefined" && level3Group) {
      scene.remove(level3Group);
      level3Group = null;
    }
  } catch (err) {
    console.warn("cleanupLevel3 warning:", err);
  }
}

function cleanupLevel4() {
  if (typeof disposeLevel4 === "function") {
    disposeLevel4();
    return;
  }

  try {
    if (typeof level4WeaponMesh !== "undefined" && level4WeaponMesh && level4WeaponMesh.parent) {
      level4WeaponMesh.parent.remove(level4WeaponMesh);
    }
    if (typeof level4Group !== "undefined" && level4Group) {
      scene.remove(level4Group);
      level4Group = null;
    }
  } catch (err) {
    console.warn("cleanupLevel4 warning:", err);
  }
}

function restartGameToLevel1() {
  clearText();
  setAimMode(false);

  cleanupLevel4();
  cleanupLevel3();
  cleanupLevel2();
  cleanupLevel1();

  yaw = 0;
  pitch = 0;
  jumpVelocity = 0;
  isOnGround = true;

  currentLevel = 1;
  initLevel1();
  initLevel1IntroText();
}

window.restartGameToLevel1 = restartGameToLevel1;

window.goToLevel4 = function () {
  if (typeof initLevel4 === "function") {
    initLevel4();
  } else {
    console.error("initLevel4 is not defined.");
  }
};