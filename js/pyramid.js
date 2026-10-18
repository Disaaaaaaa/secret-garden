/*
  pyramid.js — the interactive 3D Empathy Values Pyramid.
  5 layers (bottom → top): Respect, Understanding, Kindness, Caring, Compassion.
  Drag to rotate · scroll / pinch to zoom · click a layer to open its card.
*/
import * as THREE from 'three';
import { tween, motion, wait } from './animations.js';

export async function createPyramid(container, { layers, onSelect, onLabel }) {
  const w = () => container.clientWidth;
  const h = () => container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w(), h());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w() / h(), 0.1, 100);
  let dist = 15.5;
  const target = new THREE.Vector3(0, 1.6, 0);
  const placeCamera = () => {
    const aspect = w() / h();
    const k = aspect < 1.2 ? 1 + (1.2 - aspect) * 1.2 : 1;
    camera.position.set(0, 3.6 + dist * 0.12, dist * k);
    camera.lookAt(target);
  };
  placeCamera();

  scene.add(new THREE.AmbientLight('#fff4dd', 0.35));
  const rim = new THREE.DirectionalLight('#c9d4bb', 0.8);
  rim.position.set(-6, 4, -6);
  scene.add(rim);
  const key = new THREE.DirectionalLight('#fff0d0', 0.2);
  key.position.set(5, 10, 8);
  scene.add(key);
  const core = new THREE.PointLight('#ffe2a8', 0, 30, 1.2);
  core.position.set(0, 3.2, 6);
  scene.add(core);

  // glowing orb ("a light appears in the middle")
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,248,220,1)');
    grd.addColorStop(0.3, 'rgba(255,226,160,.6)');
    grd.addColorStop(1, 'rgba(255,226,160,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  orb.position.set(0, 2.2, 0);
  orb.scale.setScalar(0.01);
  scene.add(orb);

  // floor glow + sparkles
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  scene.add(floor);
  const SP = 80;
  const spGeo = new THREE.BufferGeometry();
  const spPos = new Float32Array(SP * 3);
  const spSeed = [];
  for (let i = 0; i < SP; i++) {
    spSeed.push([Math.random() * Math.PI * 2, 2 + Math.random() * 4, Math.random() * 6, 0.2 + Math.random() * 0.5]);
  }
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const sparkles = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.12, map: glowTex, color: '#e2c98b', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(sparkles);

  // pyramid layers
  const group = new THREE.Group();
  scene.add(group);
  const R = 3.3, H = 0.86, GAP = 0.05;
  const meshes = [];
  layers.forEach((layer, i) => {
    const bottom = R * (1 - i / 5);
    const top = i === 4 ? 0.001 : R * (1 - (i + 1) / 5);
    const geo = new THREE.CylinderGeometry(top * Math.SQRT2 / 1.0, bottom * Math.SQRT2 / 1.0, H, 4, 1);
    geo.rotateY(Math.PI / 4);
    const pct = typeof layer.pct === 'number' ? layer.pct / 100 : 0.3;
    const mat = new THREE.MeshStandardMaterial({
      color: layer.color,
      roughness: 0.42,
      metalness: 0.12,
      emissive: layer.color,
      emissiveIntensity: 0.06 + 0.22 * pct,
      flatShading: true,
      transparent: true,
      opacity: 0
    });
    const mesh = new THREE.Mesh(geo, mat);
    const y = i * (H + GAP) + H / 2;
    mesh.userData = { key: layer.key, y, baseEmissive: mat.emissiveIntensity, index: i, halfWidth: (bottom + top) / 2 };
    mesh.position.y = y - 7;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: '#f3dfa6', transparent: true, opacity: 0 }));
    mesh.add(edges);
    mesh.userData.edges = edges;
    group.add(mesh);
    meshes.push(mesh);
  });

  // interaction: rotate, zoom, select
  let rotY = 0.6, rotX = 0.12, autoRotate = true, dragging = false, last = null, downAt = null;
  const pointers = new Map();
  let pinchStart = null;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null;
  let selected = null;
  const el = renderer.domElement;
  el.style.touchAction = 'none';

  const pickLayer = e => {
    const r = el.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit ? hit.object : null;
  };

  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), dist };
    }
    dragging = true;
    autoRotate = false;
    last = { x: e.clientX, y: e.clientY };
    downAt = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      dist = Math.max(7, Math.min(20, pinchStart.dist * (pinchStart.d / d)));
      placeCamera();
      return;
    }
    if (dragging && last) {
      rotY += (e.clientX - last.x) * 0.01;
      rotX = Math.max(-0.35, Math.min(0.55, rotX + (e.clientY - last.y) * 0.005));
      last = { x: e.clientX, y: e.clientY };
    } else {
      const m = pickLayer(e);
      hovered = m;
      el.style.cursor = m ? 'pointer' : 'grab';
    }
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) {
      const m = pickLayer(e);
      if (m) select(m.userData.key, true);
    }
    dragging = false;
    last = null;
    downAt = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => {
    e.preventDefault();
    dist = Math.max(7, Math.min(20, dist + e.deltaY * 0.01));
    placeCamera();
  }, { passive: false });

  function select(key, fromClick = false) {
    selected = key;
    for (const m of meshes) {
      const on = m.userData.key === key;
      tween(m.scale, { x: on ? 1.07 : 1, y: 1, z: on ? 1.07 : 1 }, { duration: 0.4, ease: 'power2.out' });
    }
    if (fromClick) onSelect?.(key);
  }

  const onResize = () => {
    camera.aspect = w() / h();
    camera.updateProjectionMatrix();
    renderer.setSize(w(), h());
    placeCamera();
  };
  window.addEventListener('resize', onResize);

  // render loop
  let running = true;
  const clock = new THREE.Clock();
  let t = 0;
  const v = new THREE.Vector3();
  const loop = () => {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    if (autoRotate && !motion.reduced) rotY += dt * 0.25;
    group.rotation.y = rotY;
    group.rotation.x = rotX;
    for (const m of meshes) {
      const pulse = m.userData.pulse || 0;
      const sel = m.userData.key === selected ? 0.35 : 0;
      const hov = m === hovered ? 0.2 : 0;
      m.material.emissiveIntensity = m.userData.baseEmissive + pulse + sel + hov;
    }
    // sparkles rise slowly
    for (let i = 0; i < SP; i++) {
      const [a, r, ph, sp] = spSeed[i];
      const y = ((t * sp + ph) % 6);
      spPos[i * 3] = Math.cos(a + t * 0.1) * r;
      spPos[i * 3 + 1] = y;
      spPos[i * 3 + 2] = Math.sin(a + t * 0.1) * r;
    }
    spGeo.attributes.position.needsUpdate = true;
    orb.material.opacity = 0.75 + Math.sin(t * 2) * 0.15;
    renderer.render(scene, camera);
    // label positions: right side of each layer (not rotating)
    const positions = meshes.map(m => {
      v.set(m.userData.halfWidth * 1.15 + 0.35, m.position.y, 0);
      v.applyAxisAngle(new THREE.Vector3(1, 0, 0), rotX);
      v.project(camera);
      return { key: m.userData.key, x: (v.x + 1) / 2 * w(), y: (1 - v.y) / 2 * h(), shown: m.material.opacity > 0.5 };
    });
    onLabel?.(positions);
  };
  loop();

  /** The build animation: light appears, then each layer rises and pulses. */
  async function build(onLayerShown) {
    await tween(orb.scale, { x: 4, y: 4, z: 4 }, { duration: 1.2, ease: 'power2.out' });
    tween(core, { intensity: 22 }, { duration: 1.2 });
    tween(key, { intensity: 2.2 }, { duration: 1.2 });
    tween(floor.material, { opacity: 0.35 }, { duration: 1.5 });
    tween(sparkles.material, { opacity: 0.7 }, { duration: 2 });
    for (const m of meshes) {
      await Promise.all([
        tween(m.position, { y: m.userData.y }, { duration: 0.9, ease: 'back.out' }),
        tween(m.material, { opacity: 1 }, { duration: 0.6 }),
        tween(m.userData.edges.material, { opacity: 0.55 }, { duration: 0.8 })
      ]);
      m.userData.pulse = 0;
      await tween(m.userData, { pulse: 1.1 }, { duration: 0.18 });
      onLayerShown?.(m.userData.key);
      tween(m.userData, { pulse: 0 }, { duration: 0.6 });
      await wait(250);
    }
    tween(orb.position, { y: 5.5 }, { duration: 1.4, ease: 'power2.inOut' });
    tween(orb.scale, { x: 2.2, y: 2.2, z: 2.2 }, { duration: 1.4 });
  }

  function finishInstant() {
    for (const m of meshes) { m.position.y = m.userData.y; m.material.opacity = 1; m.userData.edges.material.opacity = 0.55; }
    orb.scale.setScalar(2.2); orb.position.y = 5.5; core.intensity = 22; key.intensity = 2.2;
    floor.material.opacity = 0.35; sparkles.material.opacity = 0.7;
  }

  function dispose() {
    running = false;
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { build, select, dispose, finishInstant };
}
