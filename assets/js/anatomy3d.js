/* Avgust — "Anatomija torte": a semi-naked layer cake on a porcelain cake stand, modelled procedurally
   (three.js r149, global THREE). Scroll progress drives an exploded view: the layers lift apart,
   HTML labels attach to their layer, then the cake reassembles. Renders only while on screen. */
window.initCakeAnatomy = function ({ host, reduce }) {
  if (!window.THREE || !host) return null;
  const T = THREE;
  T.ColorManagement.legacyMode = false;

  const canvas = document.createElement('canvas');
  canvas.className = 'anatomy__gl';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  host.prepend(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(24, 1, 0.1, 200);

  /* ---------- warm studio light ---------- */
  const pmrem = new T.PMREMGenerator(renderer);
  const env = new T.Scene();
  env.background = new T.Color(0x050302);
  const panel = (w, h, pos, col, k) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(8, 3, [0, 9, 4], 0xffe4c0, 3);
  panel(2.5, 8, [-9, 2, 4], 0xffc07a, 1.8);
  panel(1.5, 8, [9, 1, -3], 0xffffff, 1.3);
  panel(10, 2, [0, -6, 6], 0x6a3a20, 0.6);
  scene.environment = pmrem.fromScene(env, 0.02).texture;

  const key = new T.DirectionalLight(0xffe6c4, 2.1);
  key.position.set(-4, 10, 7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 8, bottom: -4, near: 1, far: 40 });
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
  const rim = new T.DirectionalLight(0xe0a36a, 2.2); rim.position.set(7, 3, -7);
  const berryLight = new T.PointLight(0xc4566a, 0.9, 40); berryLight.position.set(6, -1, 6);
  const front = new T.DirectionalLight(0xffe0c0, 0.9); front.position.set(6, 4, 9);
  scene.add(key, key.target, rim, front, berryLight, new T.AmbientLight(0x2a1c12, 0.35));

  /* ---------- helpers ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const phys = o => new T.MeshPhysicalMaterial(Object.assign({ envMapIntensity: 1.1 }, o));
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  // sponge crumb: warm base with pores (colour) + a matching bump map
  const pores = Array.from({ length: 5200 }, () => [rnd(0, 512), rnd(0, 512), rnd(0.8, 3.2), rnd(0.55, 1), rnd(0, 3), Math.random()]);
  const crumb = (base, dark, light) => (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    pores.forEach(([x, y, r, s, a, k]) => {
      g.fillStyle = k < 0.72 ? dark(k) : light(k);
      g.beginPath(); g.ellipse(x, y, r, r * s, a, 0, 6.28); g.fill();
    });
  };
  const crumbTex = canvasTex(512, 512, crumb('#efc987', k => `rgba(176,112,48,${0.2 + k * 0.45})`, k => `rgba(255,240,205,${k * 0.45})`));
  const crumbBump = canvasTex(512, 512, crumb('#9a9a9a', k => `rgba(30,30,30,${0.4 + k * 0.5})`, k => `rgba(230,230,230,${k * 0.5})`), false);
  const crustTex = canvasTex(512, 512, crumb('#cf9350', k => `rgba(120,66,22,${0.25 + k * 0.45})`, k => `rgba(246,205,150,${k * 0.4})`));
  crumbTex.repeat.set(0.7, 0.7); crumbBump.repeat.set(0.7, 0.7); crustTex.repeat.set(5.5, 0.24);
  const crustBump = crumbBump.clone(); crustBump.needsUpdate = true; crustBump.repeat.set(5.5, 0.24);

  const M = {
    sponge: new T.MeshStandardMaterial({ map: crumbTex, bumpMap: crumbBump, bumpScale: 0.025, roughness: 0.92 }),
    crust: new T.MeshStandardMaterial({ map: crustTex, bumpMap: crustBump, bumpScale: 0.03, roughness: 0.85 }),
    cream: phys({ color: 0xfbf2e4, roughness: 0.48, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
    berryCream: phys({ color: 0xf1a3b2, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
    glaze: phys({ color: 0x2b1309, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 }),
    porcelain: phys({ color: 0xf7f2ea, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06 }),
    gold: phys({ color: 0xe4b46e, metalness: 1, roughness: 0.2, envMapIntensity: 1.6 }),
    goldLeaf: new T.MeshStandardMaterial({ color: 0xf3cb7c, metalness: 1, roughness: 0.3, side: T.DoubleSide, envMapIntensity: 2 }),
    berry: phys({ color: 0xc81d33, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.12 }),
    leaf: new T.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 0.55, side: T.DoubleSide }),
    mint: phys({ color: 0x4f8f38, roughness: 0.4, clearcoat: 0.5, side: T.DoubleSide }),
  };
  const lathe = (pts, seg = 96) => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg);
  const shadowed = m => { m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };

  /* ---------- cake geometry ---------- */
  const R = 1.5, CUT = Math.PI / 3.1;              // radius, removed wedge
  function cutDisc(r) {
    const s = new T.Shape();
    s.moveTo(0, 0); s.absarc(0, 0, r, CUT / 2, Math.PI * 2 - CUT / 2, false); s.lineTo(0, 0);
    return s;
  }
  function discGeo(r, h, bevel) {
    const geo = new T.ExtrudeGeometry(cutDisc(r - bevel), {
      depth: Math.max(0.001, h - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 120
    });
    geo.rotateX(-Math.PI / 2); geo.translate(0, bevel, 0);
    return geo;
  }
  // outer baked wall of a sponge layer (only the round part, the cut shows the crumb)
  const crustGeo = h => new T.CylinderGeometry(R + 0.004, R + 0.004, h, 120, 1, true, CUT / 2 + Math.PI / 2, Math.PI * 2 - CUT);
  function sponge(h) {
    const g = new T.Group();
    g.add(new T.Mesh(discGeo(R, h, 0.006), M.sponge));
    const wall = new T.Mesh(crustGeo(h - 0.01), M.crust); wall.position.y = h / 2; g.add(wall);
    return g;
  }
  const creamLayer = (h, mat) => { const g = new T.Group(); g.add(new T.Mesh(discGeo(R - 0.012, h, 0.04), mat)); return g; };
  function glaze(h) {
    const g = new T.Group();
    g.add(new T.Mesh(discGeo(R + 0.012, h, 0.03), M.glaze));
    // chocolate drips down the outside
    const n = 30;
    for (let i = 0; i < n; i++) {
      const a = CUT / 2 + 0.12 + (i / (n - 1)) * (Math.PI * 2 - CUT - 0.24) + rnd(-0.04, 0.04);
      const len = rnd(0.06, 0.34), rad = rnd(0.03, 0.045);
      const d = new T.Mesh(new T.CapsuleGeometry(rad, len, 4, 10), M.glaze);
      d.scale.set(1, 1, 0.7);
      d.position.set(Math.cos(a) * (R + 0.01), h - 0.02 - len / 2, -Math.sin(a) * (R + 0.01));
      d.rotation.y = a; g.add(d);
    }
    return g;
  }

  /* ---------- toppings ---------- */
  function rosetteGeo() {
    const pts = [];
    for (let i = 0; i <= 26; i++) { const t = i / 26; pts.push([0.25 * Math.pow(1 - t, 0.7) * (t < 0.14 ? 0.86 + t : 1), 0.38 * t]); }
    const g = lathe(pts, 72), p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const th = Math.atan2(v.z, v.x), k = 1 + 0.17 * Math.cos(8 * (th + v.y * 4.2));
      p.setXYZ(i, v.x * k, v.y, v.z * k);
    }
    g.computeVertexNormals();
    return g;
  }
  const berryGeo = lathe([[0, 0], [0.2, 0.06], [0.4, 0.26], [0.5, 0.55], [0.47, 0.82], [0.3, 1.0], [0, 1.04]], 48);
  function strawberry(s) {
    const g = new T.Group();
    g.add(new T.Mesh(berryGeo, M.berry));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, lf = new T.Mesh(new T.ConeGeometry(0.1, 0.42, 6), M.leaf);
      lf.scale.z = 0.3; lf.position.set(Math.cos(a) * 0.18, 1.02, Math.sin(a) * 0.18);
      lf.rotation.set(Math.sin(a) * 1.2, -a, -Math.cos(a) * 1.2); g.add(lf);
    }
    g.scale.setScalar(s);
    return g;
  }
  function shard(s) {
    const sh = new T.Shape(); const n = 5;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, r = rnd(0.5, 1); i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.6) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r * 1.6); }
    const geo = new T.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    const m = new T.Mesh(geo, M.glaze); m.scale.setScalar(s); return m;
  }
  function goldLeaf(s) {
    const geo = new T.PlaneGeometry(1, 0.8, 5, 5), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, rnd(-0.09, 0.09));
    geo.computeVertexNormals();
    const m = new T.Mesh(geo, M.goldLeaf); m.scale.setScalar(s); return m;
  }
  function mintLeaf(s) {
    const sh = new T.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.45, 0.5, 0, 1.2); sh.quadraticCurveTo(-0.45, 0.5, 0, 0);
    const geo = new T.ShapeGeometry(sh, 16), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.pow(p.getX(i) * 2, 2) * 0.35);  // curl the edges
    geo.computeVertexNormals();
    const m = new T.Mesh(geo, M.mint); m.scale.setScalar(s); return m;
  }
  const at = (x, y) => [x, 0, -y];  // shape XY -> world XZ
  function toppings() {
    const g = new T.Group(), rg = rosetteGeo();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = CUT / 2 + 0.3 + (i / (n - 1)) * (Math.PI * 2 - CUT - 0.6);
      const r = new T.Mesh(rg, M.cream); r.position.set(...at(Math.cos(a) * 1.18, Math.sin(a) * 1.18)); r.rotation.y = rnd(0, 6); g.add(r);
      if (i % 2 === 1) { const gl = goldLeaf(0.13); gl.position.set(...at(Math.cos(a) * 1.18, Math.sin(a) * 1.18)); gl.position.y = 0.38; gl.rotation.set(-1.3, 0, rnd(0, 6)); g.add(gl); }
    }
    [[-0.5, 0.05, 0.42, 0.2, 0.3], [-0.12, 0.42, 0.36, -0.3, 1.5], [-0.2, -0.4, 0.38, 0.35, -1.2], [-0.82, -0.3, 0.32, -0.4, 2.3], [-0.8, 0.42, 0.3, 0.5, 0.8]]
      .forEach(([x, y, s, tilt, ry]) => { const b = strawberry(s); b.position.set(...at(x, y)); b.rotation.set(tilt, ry, tilt * 0.6); g.add(b); });
    [[-0.35, -0.05, 0.22, 0.5], [0.05, 0.1, 0.18, -0.6], [-0.6, 0.62, 0.16, 0.9]].forEach(([x, y, s, rz]) => {
      const sd = shard(s); sd.position.set(...at(x, y)); sd.position.y = 0.2; sd.rotation.set(-0.3, rnd(0, 6), rz); g.add(sd);
    });
    [[-0.3, 0.25, 0.2], [-0.62, -0.08, 0.17]].forEach(([x, y, s]) => { const m = mintLeaf(s); m.position.set(...at(x, y)); m.position.y = 0.33; m.rotation.set(-0.9, rnd(0, 6), 0.3); g.add(m); });
    [[-0.45, 0.3, 0.1], [-0.25, -0.2, 0.08], [-0.7, 0.1, 0.09]].forEach(([x, y, s]) => { const gl = goldLeaf(s); gl.position.set(...at(x, y)); gl.position.y = 0.46; gl.rotation.set(-1.1, 0, rnd(0, 6)); g.add(gl); });
    return g;
  }

  /* ---------- assemble ---------- */
  const root = new T.Group(); scene.add(root);
  const spin = new T.Group(); root.add(spin);
  // cake stand
  const stand = new T.Group();
  const plate = new T.Mesh(lathe([[0, -0.1], [1.9, -0.1], [2.05, -0.06], [2.13, 0.03], [2.09, 0.05], [1.96, 0.01], [0, 0.0]]), M.porcelain);
  const plRim = new T.Mesh(new T.TorusGeometry(2.115, 0.02, 12, 160), M.gold); plRim.rotation.x = Math.PI / 2; plRim.position.y = 0.04;
  const stem = new T.Mesh(lathe([[0, -1.3], [0.98, -1.3], [1.03, -1.25], [0.98, -1.19], [0.56, -1.1], [0.26, -0.8], [0.18, -0.38], [0.23, -0.18], [0.42, -0.1], [0, -0.1]]), M.porcelain);
  const baseRim = new T.Mesh(new T.TorusGeometry(1.0, 0.018, 12, 120), M.gold); baseRim.rotation.x = Math.PI / 2; baseRim.position.y = -1.22;
  stand.add(plate, plRim, stem, baseRim);
  spin.add(shadowed(stand));
  stand.traverse(o => { if (o.isMesh) o.castShadow = false; });

  // layers bottom -> top: [builder, height]
  const spec = [[sponge, 0.36], [h => creamLayer(h, M.cream), 0.11], [sponge, 0.33], [h => creamLayer(h, M.berryCream), 0.11], [sponge, 0.33], [glaze, 0.07]];
  const layers = [];
  let y = 0;
  spec.forEach(([build, h]) => { const g = shadowed(build(h)); g.userData = { base: y, h }; spin.add(g); layers.push(g); y += h + 0.002; });
  const TOP = y;
  const tops = shadowed(toppings()); tops.userData = { base: TOP, h: 0.4 }; spin.add(tops); layers.push(tops);

  /* ---------- labels ---------- */
  const labels = [...host.querySelectorAll('[data-layer]')].map(el => ({ el, k: +el.dataset.layer, th: +el.dataset.at, on: false }));

  /* ---------- state + layout ---------- */
  const st = { p: 0, target: 0, e: 0 };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let W = 0, H = 0;
  const v = new T.Vector3(), VH = 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)), EL = 0.2;

  let lastT = performance.now();
  function draw(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    const r = host.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (w !== W || h !== H) { W = w; H = h; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
    const t = now / 1000, aspect = W / H, narrow = aspect < 0.85;
    st.p += (st.target - st.p) * (1 - Math.exp(-dt * 7));
    const p = st.p;
    const e = smooth(0.1, 0.52, p) * (1 - smooth(0.8, 0.96, p));
    st.e = e;
    const gap = narrow ? 0.72 : 0.5;

    // explode: every layer rises by its index, toppings a little more
    layers.forEach((g, i) => {
      const lift = e * gap * (i + (i === layers.length - 1 ? 0.8 : 0));
      g.position.y = g.userData.base + lift + (i === layers.length - 1 && !reduce ? Math.sin(t * 1.3) * 0.02 * e : 0);
    });
    // turn with the scroll; cut side swings toward the viewer
    spin.rotation.y = -Math.PI / 2 + 0.55 + (p - 0.5) * 1.5 + (reduce ? 0 : Math.sin(t * 0.35) * 0.06);
    spin.rotation.x = reduce ? 0 : Math.sin(t * 0.5) * 0.015;
    const intro = smooth(0, 0.12, p);
    spin.scale.setScalar(0.88 + 0.12 * intro);

    // fit camera to the content (height and width), keep the cake left of the labels
    const top = TOP + 0.45 + e * gap * (layers.length - 1 + 0.8), bottom = -1.35;
    const needH = (top - bottom) / (narrow ? 0.58 : 0.72);
    const needW = 4.4 / (narrow ? 0.54 : 0.42);
    const d = Math.max(needH / VH, needW / (VH * aspect));
    const visH = VH * d, visW = visH * aspect;
    const cx = narrow ? 0.35 : 0.5, cy = narrow ? 0.6 : 0.54;
    root.position.x = (cx - 0.5) * visW;
    const ty = (top + bottom) / 2 + (cy - 0.5) * visH;
    camera.position.set(0, ty + Math.sin(EL) * d, Math.cos(EL) * d);
    camera.lookAt(0, ty, 0);
    key.target.position.set(root.position.x, 1, 0);
    key.position.set(root.position.x - 4, 10, 7);

    renderer.render(scene, camera);

    // pin labels to their layer: text in one column past the stand, a hairline reaches back to the cake edge
    labels.forEach(L => {
      const g = layers[L.k], ly = g.position.y + Math.min(g.userData.h, 0.35) / 2;
      v.set(root.position.x + R + 0.03, ly, 0).project(camera);
      const ex = (v.x + 1) / 2 * W, yy = (1 - v.y) / 2 * H;
      v.set(root.position.x + (narrow ? 2.05 : 2.45), ly, 0).project(camera);
      const x = (v.x + 1) / 2 * W;
      L.el.style.transform = `translate3d(${x.toFixed(1)}px,${yy.toFixed(1)}px,0)`;
      L.el.style.setProperty('--len', Math.max(12, x - ex - 10).toFixed(0) + 'px');
      const on = e > L.th && p < 0.86;
      if (on !== L.on) { L.on = on; L.el.classList.toggle('on', on); }
    });
  }

  let visible = false, raf = 0;
  function frame(now) { raf = requestAnimationFrame(frame); if (visible && !document.hidden) draw(now); }
  // when it comes back on screen after a jump, start from where the scroll already is (no replayed explosion)
  new IntersectionObserver(([en]) => { if (en.isIntersecting && !visible) st.p = st.target; visible = en.isIntersecting; }, { rootMargin: '120px' }).observe(host);
  raf = requestAnimationFrame(frame);

  return {
    setProgress(p) { st.target = p; if (reduce) st.p = p; },
    get state() { return st; },
    renderAt(p, now = performance.now()) { st.target = st.p = p; draw(now); return canvas; }
  };
};
