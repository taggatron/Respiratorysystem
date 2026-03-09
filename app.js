import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const TAB_ACTIVITY = "activity";
const TAB_SIMULATOR = "simulator";

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

let resizeSimulator = null;

function setActiveTab(tabId) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.panel === tabId;
    panel.classList.toggle("is-active", isActive);
    panel.classList.toggle("is-hidden", !isActive);
  });

  if (tabId === TAB_SIMULATOR && typeof resizeSimulator === "function") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resizeSimulator());
    });
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab || TAB_ACTIVITY);
  });
});

setActiveTab(TAB_ACTIVITY);

function initAnatomyActivity() {
  const board = document.getElementById("activityBoard");
  const tokenBank = document.getElementById("tokenBank");
  const checkBtn = document.getElementById("checkAnswers");
  const resetBtn = document.getElementById("resetActivity");
  const status = document.getElementById("activityStatus");
  const tokens = Array.from(document.querySelectorAll(".label-token"));
  const targets = Array.from(document.querySelectorAll(".drop-target"));

  if (!board || !tokenBank || !checkBtn || !resetBtn || !status || !tokens.length || !targets.length) {
    return;
  }

  const labelById = new Map(tokens.map((token) => [token.dataset.id, token.textContent.trim()]));
  const placements = new Map();
  const tokenToTarget = new Map();

  let dragState = null;

  function scorePlacements() {
    let score = 0;
    targets.forEach((target) => {
      if (target.dataset.accept && placements.get(target.dataset.accept) === target.dataset.accept) {
        score += 1;
      }
    });
    return score;
  }

  function clearWrongHighlights() {
    targets.forEach((target) => target.classList.remove("is-wrong"));
  }

  function updateStatus() {
    const score = scorePlacements();
    status.textContent = `Score: ${score} / ${targets.length}`;
  }

  function updateTokens() {
    tokens.forEach((token) => {
      const placed = tokenToTarget.has(token.dataset.id);
      token.classList.toggle("is-placed", placed);
      token.disabled = placed;
    });
  }

  function updateTargets() {
    targets.forEach((target, index) => {
      const tokenId = placements.get(target.dataset.accept);
      if (!tokenId) {
        target.classList.remove("has-token");
        target.removeAttribute("title");
        target.textContent = String(index + 1);
        return;
      }

      target.classList.add("has-token");
      target.textContent = labelById.get(tokenId) || tokenId;
      target.title = labelById.get(tokenId) || tokenId;
    });
  }

  function placeToken(tokenId, target) {
    const targetAccept = target.dataset.accept;
    const existingTargetKey = tokenToTarget.get(tokenId);

    if (existingTargetKey) {
      placements.delete(existingTargetKey);
      const oldTarget = targets.find((item) => item.dataset.accept === existingTargetKey);
      if (oldTarget) {
        oldTarget.classList.remove("is-wrong");
      }
    }

    const currentlyPlacedTokenId = placements.get(targetAccept);
    if (currentlyPlacedTokenId && currentlyPlacedTokenId !== tokenId) {
      tokenToTarget.delete(currentlyPlacedTokenId);
    }

    placements.set(targetAccept, tokenId);
    tokenToTarget.set(tokenId, targetAccept);

    clearWrongHighlights();
    updateTokens();
    updateTargets();
    updateStatus();
  }

  function resetActivity() {
    placements.clear();
    tokenToTarget.clear();
    clearWrongHighlights();
    updateTokens();
    updateTargets();
    updateStatus();
  }

  function checkAnswers() {
    clearWrongHighlights();
    targets.forEach((target) => {
      const expected = target.dataset.accept;
      const placed = placements.get(expected);
      if (placed && placed !== expected) {
        target.classList.add("is-wrong");
      }
    });

    const score = scorePlacements();
    if (score === targets.length) {
      status.textContent = `Perfect: ${score} / ${targets.length}`;
    } else {
      status.textContent = `Score: ${score} / ${targets.length} - keep going`;
    }
  }

  function getDropTargetFromPoint(clientX, clientY) {
    const elements = document.elementsFromPoint(clientX, clientY);
    return elements.find((el) => el.classList && el.classList.contains("drop-target")) || null;
  }

  function endDrag(clientX, clientY) {
    if (!dragState) {
      return;
    }

    const target = getDropTargetFromPoint(clientX, clientY);
    if (target) {
      placeToken(dragState.tokenId, target);
    }

    dragState.ghost.remove();
    dragState = null;
  }

  function moveGhost(clientX, clientY) {
    if (!dragState) {
      return;
    }

    dragState.ghost.style.left = `${clientX + 8}px`;
    dragState.ghost.style.top = `${clientY + 8}px`;
  }

  tokens.forEach((token) => {
    token.addEventListener("pointerdown", (event) => {
      if (token.disabled) {
        return;
      }

      event.preventDefault();
      const tokenId = token.dataset.id;
      const text = token.textContent.trim();

      const ghost = document.createElement("div");
      ghost.className = "drag-ghost";
      ghost.textContent = text;
      document.body.appendChild(ghost);

      dragState = {
        tokenId,
        ghost,
        pointerId: event.pointerId
      };

      token.setPointerCapture(event.pointerId);
      moveGhost(event.clientX, event.clientY);

      const onMove = (moveEvent) => {
        if (!dragState || moveEvent.pointerId !== dragState.pointerId) {
          return;
        }
        moveGhost(moveEvent.clientX, moveEvent.clientY);
      };

      const onUp = (upEvent) => {
        if (!dragState || upEvent.pointerId !== event.pointerId) {
          return;
        }
        token.removeEventListener("pointermove", onMove);
        token.removeEventListener("pointerup", onUp);
        token.removeEventListener("pointercancel", onCancel);
        endDrag(upEvent.clientX, upEvent.clientY);
      };

      const onCancel = () => {
        token.removeEventListener("pointermove", onMove);
        token.removeEventListener("pointerup", onUp);
        token.removeEventListener("pointercancel", onCancel);
        if (dragState) {
          dragState.ghost.remove();
          dragState = null;
        }
      };

      token.addEventListener("pointermove", onMove);
      token.addEventListener("pointerup", onUp);
      token.addEventListener("pointercancel", onCancel);
    });
  });

  checkBtn.addEventListener("click", checkAnswers);
  resetBtn.addEventListener("click", resetActivity);

  resetActivity();
}

function initSimulator() {
  const canvas = document.getElementById("simCanvas");
  const rateInput = document.getElementById("rate");
  const tidalInput = document.getElementById("tidal");
  const ratioInput = document.getElementById("ratio");
  const playInput = document.getElementById("play");
  const showRibsInput = document.getElementById("showRibs");
  const cutawayInput = document.getElementById("cutaway");
  const cutawayDepthInput = document.getElementById("cutawayDepth");

  const rateValue = document.getElementById("rateValue");
  const tidalValue = document.getElementById("tidalValue");
  const ratioValue = document.getElementById("ratioValue");
  const cutawayValue = document.getElementById("cutawayValue");
  const phaseText = document.getElementById("phaseText");
  const timeText = document.getElementById("timeText");

  if (!canvas || !rateInput || !tidalInput || !ratioInput) {
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf2efe7, 12, 30);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
  camera.position.set(0, 3.6, 11.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 2.2, 0);
  controls.minDistance = 6;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI * 0.56;

  const hemi = new THREE.HemisphereLight(0xf6f3e8, 0x6f6a5f, 0.95);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(5, 8, 9);
  scene.add(key);

  const fill = new THREE.PointLight(0x7bc2d8, 0.8, 35);
  fill.position.set(-8, 5, 6);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  const chestMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8cfbe,
    roughness: 0.65,
    transmission: 0.22,
    thickness: 0.4,
    transparent: true,
    opacity: 0.42
  });

  const lungMat = new THREE.MeshStandardMaterial({
    color: 0xb44f6f,
    roughness: 0.38,
    metalness: 0.02
  });

  const airwayMat = new THREE.MeshStandardMaterial({
    color: 0xe7d9bc,
    roughness: 0.55,
    metalness: 0.02
  });

  const diaphragmMat = new THREE.MeshStandardMaterial({
    color: 0x5f6866,
    roughness: 0.72,
    metalness: 0.08
  });

  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xf2ead8,
    roughness: 0.48,
    metalness: 0.06
  });

  const ribCage = new THREE.Mesh(
    new THREE.SphereGeometry(3.35, 42, 32, 0, Math.PI * 2, 0.2, Math.PI * 0.82),
    chestMat
  );
  ribCage.position.y = 1.95;
  ribCage.scale.set(1, 1.08, 0.86);
  root.add(ribCage);

  const ribFrame = new THREE.Group();
  ribFrame.position.set(0, 1.95, 0);
  root.add(ribFrame);

  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 3.4, 6, 16), boneMat);
  spine.position.set(0, 0.2, -2.05);
  spine.rotation.x = Math.PI * 0.02;
  ribFrame.add(spine);

  const sternum = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 2.1, 6, 16), boneMat);
  sternum.position.set(0, 0.45, 2.05);
  ribFrame.add(sternum);

  function createRibArc(yOffset, depth, width, thickness) {
    const points = [];
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24;
      const ang = -Math.PI * 0.9 + t * Math.PI * 1.8;
      const x = Math.cos(ang) * width;
      const z = Math.sin(ang) * depth;
      points.push(new THREE.Vector3(x, yOffset + Math.sin(t * Math.PI) * 0.08, z));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 50, thickness, 10, false);
    return new THREE.Mesh(geo, boneMat);
  }

  for (let i = 0; i < 9; i += 1) {
    const y = 1.4 - i * 0.34;
    const depth = 2.15 - i * 0.08;
    const width = 3.05 - i * 0.12;
    const rib = createRibArc(y, depth, width, 0.06);
    rib.rotation.x = 0.12;
    ribFrame.add(rib);
  }

  const trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.6, 20), airwayMat);
  trachea.position.y = 4.1;
  root.add(trachea);

  const carina = new THREE.Group();
  carina.position.set(0, 2.95, 0);
  root.add(carina);

  function createBronchus(dir) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.5, 16), airwayMat);
    branch.rotation.z = dir * 0.58;
    branch.position.set(dir * 0.8, -0.58, 0);
    return branch;
  }

  carina.add(createBronchus(-1));
  carina.add(createBronchus(1));

  function createLung(side) {
    const lung = new THREE.Mesh(new THREE.SphereGeometry(1.55, 44, 32), lungMat);
    lung.position.set(side * 1.72, 2.08, 0);
    lung.scale.set(0.86, 1.06, 0.7);
    return lung;
  }

  const leftLung = createLung(-1);
  const rightLung = createLung(1);
  root.add(leftLung, rightLung);

  const alveoliCloud = new THREE.Group();
  root.add(alveoliCloud);

  const alveoliGeo = new THREE.SphereGeometry(0.09, 10, 10);
  const alveoliMat = new THREE.MeshStandardMaterial({
    color: 0xd97895,
    roughness: 0.35,
    emissive: 0x3e0e1d,
    emissiveIntensity: 0.2
  });

  for (let i = 0; i < 210; i += 1) {
    const dot = new THREE.Mesh(alveoliGeo, alveoliMat);
    const side = i % 2 === 0 ? -1 : 1;
    dot.position.set(
      side * (1.15 + Math.random() * 1.2),
      1 + Math.random() * 2.1,
      (Math.random() - 0.5) * 1.6
    );
    dot.userData.seed = Math.random() * Math.PI * 2;
    alveoliCloud.add(dot);
  }

  const diaphragm = new THREE.Mesh(
    new THREE.SphereGeometry(2.55, 34, 24, 0, Math.PI * 2, 0, Math.PI * 0.5),
    diaphragmMat
  );
  const diaphragmBaseY = -0.92;
  const diaphragmBaseScaleY = 0.54;
  // Keep the dome facing upward so it projects into the thoracic cavity from below.
  diaphragm.rotation.x = 0;
  diaphragm.position.y = diaphragmBaseY;
  diaphragm.scale.set(1.1, diaphragmBaseScaleY, 0.96);
  root.add(diaphragm);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(8.5, 56),
    new THREE.MeshStandardMaterial({ color: 0xded6c7, roughness: 1, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.45;
  scene.add(floor);

  const clock = new THREE.Clock();
  let cycleElapsed = 0;

  function getSettings() {
    const bpm = Number(rateInput.value);
    const tidal = Number(tidalInput.value);
    const inhaleFrac = Number(ratioInput.value);
    const cycleSeconds = 60 / bpm;
    return { bpm, tidal, inhaleFrac, cycleSeconds };
  }

  function updateLabels() {
    const settings = getSettings();
    rateValue.textContent = settings.bpm.toFixed(0);
    tidalValue.textContent = settings.tidal.toFixed(2);
    ratioValue.textContent = settings.inhaleFrac.toFixed(2);
    cutawayValue.textContent = Number(cutawayDepthInput.value).toFixed(2);
    timeText.textContent = `Cycle Time: ${settings.cycleSeconds.toFixed(2)}s`;
  }

  function updateDisplayControls() {
    cutawayDepthInput.disabled = !cutawayInput.checked;
  }

  function resize() {
    const parent = canvas.parentElement;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resizeSimulator = resize;
  window.addEventListener("resize", resize);

  [rateInput, tidalInput, ratioInput, cutawayDepthInput].forEach((el) => {
    el.addEventListener("input", updateLabels);
  });

  cutawayInput.addEventListener("change", () => {
    updateDisplayControls();
    updateLabels();
  });

  function smoothstep01(x) {
    return x * x * (3 - 2 * x);
  }

  function ventilationSignal(t, inhaleFraction) {
    if (t <= inhaleFraction) {
      return smoothstep01(t / inhaleFraction);
    }
    const exhaleT = (t - inhaleFraction) / Math.max(1 - inhaleFraction, 1e-4);
    return 1 - smoothstep01(exhaleT);
  }

  function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    const settings = getSettings();

    if (playInput.checked) {
      cycleElapsed += dt;
    }

    cycleElapsed %= settings.cycleSeconds;
    const t = cycleElapsed / settings.cycleSeconds;
    const vent = ventilationSignal(t, settings.inhaleFrac);

    const phase = t <= settings.inhaleFrac ? "Inhale" : "Exhale";
    phaseText.textContent = `Phase: ${phase}`;
    phaseText.style.color = phase === "Inhale" ? "#2e6f8f" : "#ca4a34";

    const amplitude = THREE.MathUtils.mapLinear(settings.tidal, 0.3, 1.2, 0.12, 0.48);
    const cutawayAmount = cutawayInput.checked ? Number(cutawayDepthInput.value) : 0;
    const ribLift = amplitude * 0.34 * vent;
    const ribOut = amplitude * 0.26 * vent;

    ribFrame.visible = showRibsInput.checked;
    chestMat.opacity = THREE.MathUtils.lerp(0.42, 0.05, cutawayAmount);
    chestMat.transmission = THREE.MathUtils.lerp(0.22, 0.72, cutawayAmount);

    leftLung.scale.set(0.86 + amplitude * 0.28 * vent, 1.06 + amplitude * 0.38 * vent, 0.7 + amplitude * 0.2 * vent);
    rightLung.scale.set(0.86 + amplitude * 0.28 * vent, 1.06 + amplitude * 0.38 * vent, 0.7 + amplitude * 0.2 * vent);

    trachea.scale.y = 1 + 0.08 * vent;
    trachea.position.y = 4.1 + 0.08 * vent;

    ribCage.scale.set(1 + amplitude * 0.16 * vent, 1.08 + amplitude * 0.13 * vent, 0.86 + amplitude * 0.2 * vent);
    ribFrame.position.y = 1.95 + ribLift;
    ribFrame.scale.set(1 + ribOut, 1 + amplitude * 0.07 * vent, 1 + amplitude * 0.2 * vent);
    ribFrame.rotation.x = 0.02 + amplitude * 0.1 * vent;
    sternum.position.z = 2.05 + amplitude * 0.08 * vent;

    diaphragm.position.y = diaphragmBaseY - amplitude * 0.58 * vent;
    diaphragm.scale.y = diaphragmBaseScaleY + amplitude * 0.14 * (1 - vent);

    const pulse = 0.15 + vent * 0.7;
    alveoliCloud.children.forEach((dot, i) => {
      const drift = Math.sin(clock.elapsedTime * 1.4 + dot.userData.seed + i * 0.002) * 0.02;
      dot.scale.setScalar(0.85 + vent * 0.4 + drift);
    });
    alveoliMat.emissiveIntensity = pulse;

    root.rotation.y = Math.sin(clock.elapsedTime * 0.28) * 0.12;

    controls.update();
    renderer.render(scene, camera);
  }

  resize();
  updateDisplayControls();
  updateLabels();
  animate();
}

initAnatomyActivity();
initSimulator();
