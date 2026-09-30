/* Avgust coffee & cake bar — realistic floating 3D menu objects (three.js r149, global THREE).
   Objects are modelled procedurally with PBR materials, lit by a warm generated environment,
   and float freely over the whole menu section around the #menuStage anchor. */
window.initFloat3D = function ({ section, stage, fine, reduce, scene: which = 'menu', autoShow = true, className = 'menu3d' }) {
  if (!window.THREE) return null;
  const T = THREE;
  T.ColorManagement.legacyMode = false; // treat hex colors as sRGB so tones stay rich

  const canvas = document.createElement('canvas');
  canvas.className = className;
  section.prepend(canvas);
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(26, 1, 0.1, 200);
  camera.position.set(0, 0, 30);

  /* ---------- warm studio environment for reflections ---------- */
  const pmrem = new T.PMREMGenerator(renderer);
  const envScene = new T.Scene();
  envScene.background = new T.Color(0x140d08);
  const panel = (w, h, pos, col, k) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  envScene.background = new T.Color(0x050302);
  panel(7, 3, [0, 8, 5], 0xffe4c0, 3);      // softbox above (sharp highlight)
  panel(2, 7, [-9, 1, 3], 0xffc07a, 1.6);   // warm strip light
  panel(1.5, 7, [9, 0, -2], 0xffffff, 1.4); // cool rim strip
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  const key = new T.DirectionalLight(0xffe2b8, 1.7); key.position.set(-5, 7, 9); scene.add(key);
  const rim = new T.DirectionalLight(0xd4a860, 1.6); rim.position.set(7, -1, -6); scene.add(rim);
  const fill = new T.PointLight(0xc0512d, 0.6, 60); fill.position.set(4, -6, 8); scene.add(fill);
  scene.add(new T.AmbientLight(0x2a1c12, 0.25));

  /* ---------- helpers ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  function canvasTex(w, h, draw, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if (srgb) t.encoding = T.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  const noiseTex = (scale = 1, base = 128, amp = 80) => canvasTex(256, 256, (g, w, h) => {
    const d = g.createImageData(w, h);
    for (let i = 0; i < d.data.length; i += 4) { const v = base + (Math.random() - 0.5) * amp; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }, false);
  function roundedBox(w, h, d, r, seg = 8) {
    const g = new T.BoxGeometry(w, h, d, seg, seg, seg);
    const p = g.attributes.position, n = g.attributes.normal, v = new T.Vector3(), c = new T.Vector3(), nn = new T.Vector3();
    const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(T.MathUtils.clamp(v.x, -hw, hw), T.MathUtils.clamp(v.y, -hh, hh), T.MathUtils.clamp(v.z, -hd, hd));
      nn.subVectors(v, c);
      if (nn.lengthSq() > 1e-8) { nn.normalize(); v.copy(c).addScaledVector(nn, r); n.setXYZ(i, nn.x, nn.y, nn.z); }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  }
  const lathe = (pts, seg = 72) => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg);
  // add light only: colour is summed onto the page, canvas alpha is left untouched
  const ADD = { blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor };
  const phys = o => new T.MeshPhysicalMaterial(Object.assign({ envMapIntensity: 1.2 }, o));

  /* ---------- shared materials ---------- */
  const M = {
    ceramic: phys({ color: 0xf6f1e8, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    goldRim: phys({ color: 0xd9b06a, metalness: 1, roughness: 0.22 }),
    bean: [0x3b2113, 0x4a2a17, 0x2f1a0f].map(c => phys({ color: c, envMapIntensity: 0.7, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, bumpMap: noiseTex(), bumpScale: 0.004 })),
    sugar: new T.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.92, bumpMap: noiseTex(1, 128, 160), bumpScale: 0.03 }),
    choc: phys({ envMapIntensity: 0.8, color: 0x3a1d10, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    // glass & ice: additive — only reflections/highlights are added, so they read as clear glass on the dark page
    glass: phys({ color: 0x0a0a0a, roughness: 0.03, clearcoat: 1, envMapIntensity: 3.5, side: T.DoubleSide, transparent: true, depthWrite: false, ...ADD }),
    ice: phys({ color: 0x4a6272, roughness: 0.1, clearcoat: 1, envMapIntensity: 3, transparent: true, depthWrite: false, ...ADD }),
    iceCore: new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
    cinnamon: new T.MeshStandardMaterial({ color: 0x7a3a1a, roughness: 0.85 }),
    anise: new T.MeshStandardMaterial({ color: 0x5e2a15, roughness: 0.78, bumpMap: noiseTex(), bumpScale: 0.02 }),
    seed: phys({ color: 0xa9682f, roughness: 0.25, clearcoat: 0.8 }),
  };

  /* ---------- textures ---------- */
  const latteTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    let gr = g.createRadialGradient(c, c, 10, c, c, c);
    gr.addColorStop(0, '#b5773f'); gr.addColorStop(0.75, '#8a4d24'); gr.addColorStop(0.95, '#5a2e14'); gr.addColorStop(1, '#3a1c0c');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    // latte-art heart: milk foam with soft edges and a crema line pulled through it
    const heart = (s, col) => {
      g.fillStyle = col; g.beginPath();
      g.moveTo(c, c + 120 * s);
      g.bezierCurveTo(c - 200 * s, c - 10 * s, c - 120 * s, c - 170 * s, c, c - 70 * s);
      g.bezierCurveTo(c + 120 * s, c - 170 * s, c + 200 * s, c - 10 * s, c, c + 120 * s);
      g.fill();
    };
    g.shadowColor = '#f6ead6'; g.shadowBlur = 24; heart(1, '#f6ead6');
    g.shadowBlur = 10; heart(0.62, '#c98c55'); heart(0.5, '#f6ead6');
    g.shadowBlur = 0; g.strokeStyle = 'rgba(160,100,55,.8)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(c, c - 150); g.lineTo(c, c + 118); g.stroke();
    // crema speckles
    for (let i = 0; i < 400; i++) { const a = rnd(0, 6.28), r = rnd(150, 250); g.fillStyle = `rgba(60,25,8,${rnd(0.05, 0.2)})`; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, rnd(1, 3), 0, 6.28); g.fill(); }
  });
  const chocoTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    let gr = g.createRadialGradient(c, c, 10, c, c, c);
    gr.addColorStop(0, '#6b3a1e'); gr.addColorStop(0.9, '#4a2412'); gr.addColorStop(1, '#2a1208');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(214,170,120,.55)'; g.lineWidth = 7; g.shadowColor = '#d6aa78'; g.shadowBlur = 10;
    g.beginPath(); for (let a = 0; a < Math.PI * 6; a += 0.05) { const r = 12 + a * 11; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.stroke();
  });
  const lemonTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#f0c419'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fbf3d2'; g.beginPath(); g.arc(c, c, c * 0.9, 0, Math.PI * 2); g.fill();
    const seg = 10;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2 + 0.05, a1 = ((i + 1) / seg) * Math.PI * 2 - 0.05;
      const gr = g.createRadialGradient(c, c, 10, c, c, c * 0.82);
      gr.addColorStop(0, '#fff6b8'); gr.addColorStop(1, '#f5d63a');
      g.fillStyle = gr; g.beginPath(); g.moveTo(c + Math.cos((a0 + a1) / 2) * 16, c + Math.sin((a0 + a1) / 2) * 16);
      g.arc(c, c, c * 0.82, a0, a1); g.closePath(); g.fill();
      // juice vesicles
      g.fillStyle = 'rgba(255,255,255,.35)';
      for (let k = 0; k < 40; k++) { const a = rnd(a0, a1), r = rnd(30, c * 0.78); g.beginPath(); g.ellipse(c + Math.cos(a) * r, c + Math.sin(a) * r, 3, 7, a, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = '#fbf3d2'; g.beginPath(); g.arc(c, c, 18, 0, Math.PI * 2); g.fill();
  });
  const barkTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7a3a1a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${rnd(40, 140)},${rnd(20, 60)},${rnd(5, 25)},.6)`; g.lineWidth = rnd(1, 4); const x = rnd(0, w); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rnd(-6, 6), h); g.stroke(); }
  });
  // tube UV: x runs along the croissant, y runs around it (top of the bake is darker)
  const pastryTex = canvasTex(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e7b467'); gr.addColorStop(0.25, '#a8561a'); gr.addColorStop(0.5, '#7e3a10'); gr.addColorStop(0.75, '#a8561a'); gr.addColorStop(1, '#e7b467');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const ends = g.createLinearGradient(0, 0, w, 0);
    ends.addColorStop(0, 'rgba(240,200,130,.7)'); ends.addColorStop(0.12, 'rgba(240,200,130,0)'); ends.addColorStop(0.88, 'rgba(240,200,130,0)'); ends.addColorStop(1, 'rgba(240,200,130,.7)');
    g.fillStyle = ends; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd(60, 110)},${rnd(25, 45)},8,${rnd(0.08, 0.25)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(4, 18), rnd(1, 3)); }
  });
  const flakeTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const s = rnd(90, 200); g.fillStyle = `rgb(${s},${s},${s})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(3, 12), rnd(1, 2)); }
  }, false);

  /* ---------- object builders (each returns a Group roughly 2 units across) ---------- */
  function coffeeCup() {
    const g = new T.Group();
    const cup = new T.Mesh(lathe([[0, 0], [0.5, 0], [0.56, 0.05], [0.72, 0.3], [0.9, 0.75], [0.99, 1.1], [0.97, 1.13], [0.93, 1.1], [0.86, 0.75], [0.68, 0.34], [0.48, 0.13], [0, 0.13]]), M.ceramic);
    const rimRing = new T.Mesh(new T.TorusGeometry(0.98, 0.012, 8, 96), M.goldRim); rimRing.rotation.x = Math.PI / 2; rimRing.position.y = 1.115;
    const coffee = new T.Mesh(new T.CircleGeometry(0.925, 64), phys({ map: latteTex, roughness: 0.25, clearcoat: 0.5 }));
    coffee.rotation.x = -Math.PI / 2; coffee.position.y = 1.0;
    const handle = new T.Mesh(new T.TorusGeometry(0.27, 0.065, 20, 48, Math.PI * 1.25), M.ceramic);
    handle.rotation.z = -Math.PI * 0.62; handle.position.set(0.9, 0.62, 0);
    const saucer = new T.Mesh(lathe([[0, 0], [0.9, 0], [1.4, 0.1], [1.52, 0.17], [1.49, 0.19], [1.36, 0.14], [0.95, 0.07], [0, 0.07]]), M.ceramic);
    saucer.position.y = -0.07;
    const sRim = new T.Mesh(new T.TorusGeometry(1.505, 0.012, 8, 128), M.goldRim); sRim.rotation.x = Math.PI / 2; sRim.position.y = 0.11;
    g.add(cup, rimRing, coffee, handle, saucer, sRim);
    g.children.forEach(m => m.position.y -= 0.5);
    return g;
  }
  function hotMug() {
    const g = new T.Group();
    const mat = phys({ color: 0x7c2e1c, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 });
    const inner = phys({ color: 0xf2ebe0, roughness: 0.2, clearcoat: 1 });
    const outer = new T.Mesh(lathe([[0, 0], [0.74, 0], [0.8, 0.05], [0.82, 0.8], [0.8, 1.45], [0.77, 1.48]]), mat);
    const inside = new T.Mesh(lathe([[0.77, 1.48], [0.74, 1.44], [0.74, 0.12], [0, 0.12]]), inner);
    const drink = new T.Mesh(new T.CircleGeometry(0.74, 64), phys({ map: chocoTex, roughness: 0.3, clearcoat: 0.6 }));
    drink.rotation.x = -Math.PI / 2; drink.position.y = 1.28;
    const handle = new T.Mesh(new T.TorusGeometry(0.36, 0.085, 20, 48, Math.PI * 1.2), mat);
    handle.rotation.z = -Math.PI * 0.6; handle.position.set(0.82, 0.74, 0);
    g.add(outer, inside, drink, handle);
    g.children.forEach(m => m.position.y -= 0.72);
    return g;
  }
  const beanGeo = (() => {
    const geo = new T.SphereGeometry(1, 56, 40), p = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.x *= 0.72; v.z *= 0.52;
      if (v.z > 0) { v.z *= 0.55; const s = v.x - 0.1 * Math.sin(v.y * 3.2); v.z -= 0.2 * Math.exp(-(s * s) / 0.005) * (1 - v.y * v.y * 0.85); }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals(); return geo;
  })();
  const bean = () => new T.Mesh(beanGeo, M.bean[(Math.random() * 3) | 0]);
  const sugarGeo = roundedBox(1, 1, 1, 0.1, 6);
  const sugar = () => new T.Mesh(sugarGeo, M.sugar);
  const chocGeo = roundedBox(1.5, 1, 0.3, 0.07, 6);
  const chocolate = () => {
    const g = new T.Group(); g.add(new T.Mesh(chocGeo, M.choc));
    const tile = roundedBox(0.62, 0.4, 0.12, 0.05, 4);
    [[-0.36, 0.23], [0.36, 0.23], [-0.36, -0.23], [0.36, -0.23]].forEach(([x, y]) => { const m = new T.Mesh(tile, M.choc); m.position.set(x, y, 0.17); g.add(m); });
    return g;
  };
  const iceGeo = roundedBox(1, 1, 1, 0.16, 6), iceCoreGeo = roundedBox(0.55, 0.5, 0.55, 0.2, 4);
  const ice = () => { const g = new T.Group(); g.add(new T.Mesh(iceGeo, M.ice), new T.Mesh(iceCoreGeo, M.iceCore)); return g; };
  function lemonSlice() {
    const flesh = phys({ map: lemonTex, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const rind = phys({ color: 0xf2c418, roughness: 0.45, bumpMap: noiseTex(), bumpScale: 0.01 });
    const m = new T.Mesh(new T.CylinderGeometry(1, 1, 0.16, 64), [rind, flesh, flesh]);
    m.rotation.x = Math.PI / 2; const g = new T.Group(); g.add(m); return g;
  }
  function cinnamon() {
    const g = new T.Group();
    const side = new T.MeshStandardMaterial({ map: barkTex, roughness: 0.85, bumpMap: barkTex, bumpScale: 0.02 });
    const endTex = canvasTex(256, 256, (c, w) => {
      c.fillStyle = '#5a2810'; c.fillRect(0, 0, w, w); c.strokeStyle = '#9a5a2c'; c.lineWidth = 9;
      c.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.05) { const r = 8 + a * 7.5; c.lineTo(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r); } c.stroke();
    });
    const end = new T.MeshStandardMaterial({ map: endTex, roughness: 0.9 });
    g.add(new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 2.4, 32), [side, end, end]));
    return g;
  }
  function starAnise() {
    const g = new T.Group(), pod = new T.SphereGeometry(1, 24, 16), seed = new T.SphereGeometry(1, 16, 12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new T.Mesh(pod, M.anise); p.scale.set(0.5, 0.19, 0.2); p.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0); p.rotation.z = a; g.add(p);
      const s = new T.Mesh(seed, M.seed); s.scale.set(0.12, 0.08, 0.08); s.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.14); s.rotation.z = a; g.add(s);
    }
    const hub = new T.Mesh(seed, M.anise); hub.scale.set(0.14, 0.14, 0.12); g.add(hub);
    return g;
  }
  function coupeGlass() {
    const g = new T.Group();
    const glass = new T.Mesh(lathe([[0, 0], [0.7, 0], [0.72, 0.03], [0.12, 0.08], [0.06, 0.14], [0.05, 1.1], [0.1, 1.2], [0.42, 1.3], [0.82, 1.5], [1.06, 1.8], [1.11, 1.93], [1.08, 1.94], [1.03, 1.8], [0.8, 1.53], [0.4, 1.34], [0.08, 1.3], [0, 1.3]], 80), M.glass);
    const liquid = new T.Mesh(lathe([[0, 1.33], [0.38, 1.36], [0.76, 1.55], [0.96, 1.76], [0, 1.76]], 64),
      phys({ color: 0xf0cf52, roughness: 0.12, transparent: true, opacity: 0.9, clearcoat: 0.4, emissive: 0x6a4800, emissiveIntensity: 0.45 }));
    const peel = new T.Mesh(new T.TorusGeometry(0.22, 0.05, 12, 40, Math.PI * 1.6), phys({ color: 0xf2c418, roughness: 0.4 }));
    peel.position.set(0.95, 1.95, 0.1); peel.rotation.set(0.4, 0.3, 0.2);
    g.add(liquid, glass, peel);
    g.children.forEach(m => m.position.y -= 1);
    return g;
  }
  function macaron(shellCol, fillCol) {
    const g = new T.Group();
    const shellMat = new T.MeshStandardMaterial({ color: shellCol, roughness: 0.62, bumpMap: noiseTex(1, 128, 50), bumpScale: 0.006 });
    const footMat = new T.MeshStandardMaterial({ color: new T.Color(shellCol).multiplyScalar(0.92), roughness: 0.95, bumpMap: noiseTex(1, 128, 200), bumpScale: 0.05 });
    const shell = new T.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const top = new T.Mesh(shell, shellMat); top.scale.set(1, 0.42, 1); top.position.y = 0.2;
    const bot = new T.Mesh(shell, shellMat); bot.scale.set(1, 0.3, 1); bot.rotation.x = Math.PI; bot.position.y = -0.2;
    const foot = new T.TorusGeometry(0.96, 0.09, 12, 64);
    const f1 = new T.Mesh(foot, footMat); f1.rotation.x = Math.PI / 2; f1.scale.z = 0.8; f1.position.y = 0.16;
    const f2 = f1.clone(); f2.position.y = -0.16;
    const fill = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.26, 48), new T.MeshStandardMaterial({ color: fillCol, roughness: 0.5 }));
    g.add(top, bot, f1, f2, fill);
    return g;
  }
  function croissant() {
    // one continuous crescent tube; radius swells in the middle and pinches into rolled layers
    const pts = [];
    for (let i = 0; i <= 20; i++) { const a = -1.15 + 2.3 * (i / 20); pts.push(new T.Vector3(Math.sin(a) * 1.3, Math.cos(a) * 1.3 - 1.0, 0)); }
    const curve = new T.CatmullRomCurve3(pts);
    const TS = 160, RS = 48, geo = new T.TubeGeometry(curve, TS, 1, RS, false);
    const p = geo.attributes.position, v = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i <= TS; i++) {
      const u = i / TS;
      curve.getPointAt(u, c);
      const body = 0.07 + 0.58 * Math.pow(Math.sin(Math.PI * u), 1.3);
      const ridge = 1 - 0.13 * Math.pow(Math.abs(Math.cos(u * Math.PI * 6.5)), 6); // grooves between layers
      for (let j = 0; j <= RS; j++) {
        const k = i * (RS + 1) + j;
        v.fromBufferAttribute(p, k).sub(c).multiplyScalar(body * ridge);
        v.y *= v.y < 0 ? 0.7 : 1;   // slightly flat underside
        v.z *= 0.9;
        p.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
      }
    }
    // close the pointy ends
    geo.computeVertexNormals();
    const mat = phys({ map: pastryTex, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.25, bumpMap: flakeTex, bumpScale: 0.025 });
    const g = new T.Group(); g.add(new T.Mesh(geo, mat)); g.children[0].position.y = 0.2;
    return g;
  }

  // strawberry: lathed berry with seed bumps and a little green calyx
  const seedTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 16) for (let x = (y / 16 % 2) * 8; x < w; x += 16) { g.fillStyle = '#3a3a3a'; g.beginPath(); g.ellipse(x, y, 2.5, 4, 0, 0, 6.28); g.fill(); }
  }, false);
  const berryGeo = lathe([[0, 0], [0.2, 0.06], [0.4, 0.26], [0.5, 0.55], [0.47, 0.82], [0.3, 1.0], [0, 1.04]], 48);
  const berryMat = phys({ color: 0xc81d33, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15, bumpMap: seedTex, bumpScale: 0.02 });
  const leafMat = new T.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 0.6, side: T.DoubleSide });
  function strawberry() {
    const g = new T.Group();
    g.add(new T.Mesh(berryGeo, berryMat));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, leaf = new T.Mesh(new T.ConeGeometry(0.1, 0.42, 6), leafMat);
      leaf.scale.z = 0.3; leaf.position.set(Math.cos(a) * 0.18, 1.02, Math.sin(a) * 0.18);
      leaf.rotation.set(Math.sin(a) * 1.2, -a, -Math.cos(a) * 1.2); g.add(leaf);
    }
    const stem = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, 0.22, 8), leafMat); stem.position.y = 1.12; g.add(stem);
    g.children.forEach(m => m.position.y -= 0.55);
    return g;
  }
  // slice of layer cake: vanilla sponge, cream and strawberry cream, chocolate glaze, rosette + strawberry on top
  // sponge crumb: warm base with pores (colour + bump), shared by every cake slice
  const pores = Array.from({ length: 5200 }, () => [rnd(0, 512), rnd(0, 512), rnd(0.8, 3.2), rnd(0.55, 1), rnd(0, 3), Math.random()]);
  const crumb = (base, dark, light, srgb = true) => {
    const t = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      pores.forEach(([x, y, r, s, a, k]) => { g.fillStyle = k < 0.72 ? dark(k) : light(k); g.beginPath(); g.ellipse(x, y, r, r * s, a, 0, 6.28); g.fill(); });
    }, srgb);
    t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  };
  const crumbTex = crumb('#efc987', k => `rgba(176,112,48,${0.2 + k * 0.45})`, k => `rgba(255,240,205,${k * 0.45})`);
  const crumbBump = crumb('#9a9a9a', k => `rgba(30,30,30,${0.4 + k * 0.5})`, k => `rgba(230,230,230,${k * 0.5})`, false);
  const crustTex = crumb('#cf9350', k => `rgba(120,66,22,${0.25 + k * 0.45})`, k => `rgba(246,205,150,${k * 0.4})`);
  crumbTex.repeat.set(0.7, 0.7); crumbBump.repeat.set(0.7, 0.7); crustTex.repeat.set(1.4, 0.3);
  const SM = {
    sponge: new T.MeshStandardMaterial({ map: crumbTex, bumpMap: crumbBump, bumpScale: 0.025, roughness: 0.92 }),
    crust: new T.MeshStandardMaterial({ map: crustTex, roughness: 0.85 }),
    cream: phys({ color: 0xfbf2e4, roughness: 0.48, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
    pink: phys({ color: 0xf1a3b2, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
    glaze: phys({ color: 0x2b1309, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 }),
    gold: new T.MeshStandardMaterial({ color: 0xf3cb7c, metalness: 1, roughness: 0.3, side: T.DoubleSide }),
  };
  const rosetteGeo = (() => {
    const pts = [];
    for (let i = 0; i <= 26; i++) { const t = i / 26; pts.push([0.25 * Math.pow(1 - t, 0.7) * (t < 0.14 ? 0.86 + t : 1), 0.38 * t]); }
    const geo = lathe(pts, 72), p = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const th = Math.atan2(v.z, v.x), k = 1 + 0.17 * Math.cos(8 * (th + v.y * 4.2)); p.setXYZ(i, v.x * k, v.y, v.z * k); }
    geo.computeVertexNormals(); return geo;
  })();
  // slice of layer cake: vanilla sponge, cream and strawberry cream, chocolate glaze, piped rosette + strawberry + gold leaf
  function cakeSlice() {
    const g = new T.Group();
    const R = 1.6, A = Math.PI / 4.6;
    const shape = new T.Shape();
    shape.moveTo(0, 0); shape.absarc(0, 0, R, -A / 2, A / 2, false); shape.lineTo(0, 0);
    let y = 0;
    [[0.34, 's'], [0.1, SM.cream], [0.3, 's'], [0.1, SM.pink], [0.3, 's'], [0.09, SM.glaze]].forEach(([h, mat]) => {
      const sp = mat === 's', bev = sp ? 0.006 : 0.03;
      const geo = new T.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 36 });
      const m = new T.Mesh(geo, sp ? SM.sponge : mat); m.rotation.x = -Math.PI / 2; m.position.y = y + bev; g.add(m);
      if (sp) { // baked outer wall along the arc
        const w = new T.Mesh(new T.CylinderGeometry(R + 0.004, R + 0.004, h - 0.01, 36, 1, true, Math.PI / 2 - A / 2, A), SM.crust);
        w.position.y = y + h / 2; g.add(w);
      }
      y += h + 0.004;
    });
    const rosette = new T.Mesh(rosetteGeo, SM.cream); rosette.scale.setScalar(1.1); rosette.position.set(R * 0.78, y, 0); g.add(rosette);
    const berry = strawberry(); berry.scale.setScalar(0.4); berry.position.set(R * 0.78, y + 0.4, 0); berry.rotation.z = 0.3; g.add(berry);
    const choc = new T.Mesh(roundedBox(0.34, 0.2, 0.03, 0.01, 2), SM.glaze); choc.position.set(R * 0.48, y + 0.1, 0.04); choc.rotation.set(0.2, 0.4, 0.3); g.add(choc);
    const leafGeo = new T.PlaneGeometry(0.16, 0.13, 4, 4), lp = leafGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) lp.setZ(i, rnd(-0.015, 0.015));
    leafGeo.computeVertexNormals();
    [[R * 0.62, 0.02, 0.15], [R * 0.34, 0.01, -0.08], [R * 0.9, 0.62, 0.08]].forEach(([x, dy, z]) => { const l = new T.Mesh(leafGeo, SM.gold); l.position.set(x, y + dy + 0.01, z); l.rotation.set(-1.35, 0, rnd(0, 6)); g.add(l); });
    g.children.forEach(m => { m.position.x -= R * 0.55; m.position.y -= y / 2; });
    return g;
  }

  /* ---------- scenes per category ----------
     [builder, x, y (stage units, stage width = 4 units, y up), z, scale, spin] */
  const sets = which === 'hero' ? {
    hero: [
      [cakeSlice, 0.05, -0.15, 0, 1.45, 0], [strawberry, -1.75, 1.35, 1.2, 0.5, 0.5], [strawberry, 1.65, -1.35, 1.0, 0.4, 0.5], [strawberry, 1.1, 1.95, -1.6, 0.28, 0.5],
      [bean, 1.8, 1.0, -0.6, 0.26, 1], [bean, -1.7, -1.35, 0.8, 0.28, 1], [bean, 2.1, 0.1, -2.2, 0.2, 1], [bean, -2.1, 0.3, -2.2, 0.18, 1],
      [() => macaron(0xe9a3ae, 0xfbe3e6), -1.95, -0.2, -1.2, 0.36, 0.5], [chocolate, -0.7, 1.95, -1.8, 0.3, 0.5]
    ]
  } : {
    kafa: [
      [coffeeCup, 0, 0.1, 0, 1.0, 0], [bean, -1.7, 1.7, 1, 0.3, 1], [bean, 1.7, 1.9, -1, 0.34, 1], [bean, 1.9, -1.4, 1.5, 0.27, 1],
      [bean, -1.6, -1.7, 0.5, 0.33, 1], [bean, 2.6, 0.4, -3, 0.24, 1], [bean, -2.3, 0.1, -2, 0.22, 1], [sugar, -2.1, -0.4, 0.8, 0.34, 0.5], [sugar, 1.2, 2.5, -2, 0.26, 0.5]
    ],
    topli: [
      [hotMug, 0, 0, 0, 1.05, 0], [cinnamon, -1.8, 1.6, 0.8, 0.8, 0.4], [cinnamon, 1.9, -1.5, 0.4, 0.7, 0.4], [starAnise, 1.7, 1.8, 0.6, 0.6, 0.6],
      [starAnise, -1.9, -1.6, -0.5, 0.5, 0.6], [chocolate, 2.4, 0.2, -1.5, 0.55, 0.5], [chocolate, -2.4, 0.2, -1.2, 0.45, 0.5]
    ],
    torte: [
      [cakeSlice, 0, 0, 0, 1.15, 0], [strawberry, -1.8, 1.6, 0.8, 0.6, 0.5], [strawberry, 2.0, -1.4, 1.0, 0.5, 0.5], [strawberry, -2.4, 0.1, -1.8, 0.4, 0.5],
      [() => macaron(0xe9a3ae, 0xfbe3e6), 1.8, 1.7, -0.4, 0.45, 0.5], [chocolate, -1.7, -1.7, 0.4, 0.45, 0.5], [chocolate, 2.6, 0.3, -1.8, 0.4, 0.5]
    ],
    osvezenja: [
      [coupeGlass, 0, -0.1, 0, 1.15, 0], [lemonSlice, -1.8, 1.5, 0.8, 0.6, 0.5], [lemonSlice, 2.0, -1.3, 1.0, 0.5, 0.5],
      [ice, 1.8, 1.7, 0.2, 0.55, 0.5], [ice, -1.8, -1.5, 0.4, 0.6, 0.5], [ice, 2.5, 0.3, -2, 0.4, 0.5], [ice, -2.4, 0.2, -2.5, 0.35, 0.5]
    ],
    kolaci: [
      [croissant, 0, 0.3, 0, 1.2, 0], [() => macaron(0xe9a3ae, 0xfbe3e6), -1.7, 1.6, 0.6, 0.5, 0.5], [() => macaron(0xb8d08a, 0xf1f6e2), 1.8, 1.6, -0.4, 0.45, 0.5],
      [() => macaron(0xf0dfbd, 0xfff7e8), 1.7, -1.6, 0.8, 0.5, 0.5], [() => macaron(0x6e3d28, 0x3a1d10), -1.8, -1.6, 0.3, 0.44, 0.5], [chocolate, 2.6, 0.1, -1.6, 0.45, 0.5]
    ]
  };

  const objects = [];
  Object.entries(sets).forEach(([cat, list]) => list.forEach(([build, x, y, z, s, spin], i) => {
    const mesh = build();
    const pivot = new T.Group(); pivot.add(mesh); pivot.visible = false; scene.add(pivot);
    const hero = i === 0;
    mesh.rotation.set(hero ? 0.35 : rnd(0, 6), hero ? rnd(-0.4, 0.4) : rnd(0, 6), hero ? 0 : rnd(0, 6));
    objects.push({
      cat, pivot, mesh, x, y, z, s, hero, i,
      spin: new T.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(0.25 * spin),
      phase: rnd(0, 6.28), bobSpeed: rnd(0.5, 0.9), bobAmp: hero ? 0.12 : rnd(0.12, 0.25),
      depth: hero ? 0.35 : 0.5 + z * 0.12 + s * 0.4,
      a: 0, target: 0, start: 0, leaving: false, spinBoost: 0, base: mesh.rotation.clone()
    });
  }));

  /* ---------- layout: map stage (DOM) to world ---------- */
  let W = 1, H = 1, wpp = 1, cx = 0, cy = 0, U = 1;
  function layout() {
    const sr = section.getBoundingClientRect(), st = stage.getBoundingClientRect();
    const w = Math.round(sr.width), h = Math.round(sr.height);
    if (w !== W || h !== H) { W = w; H = h; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
    wpp = (2 * camera.position.z * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) / H;
    cx = (st.left - sr.left + st.width / 2 - W / 2) * wpp;
    cy = -(st.top - sr.top + st.height / 2 - H / 2) * wpp;
    U = (Math.min(st.width, st.height * 0.9) * wpp) / 4;
  }

  /* ---------- interaction ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (fine) section.addEventListener('mousemove', e => {
    const st = stage.getBoundingClientRect();
    mouse.tx = T.MathUtils.clamp((e.clientX - (st.left + st.width / 2)) / st.width, -1.5, 1.5);
    mouse.ty = T.MathUtils.clamp((e.clientY - (st.top + st.height / 2)) / st.height, -1.5, 1.5);
  });

  let current = null;
  function show(cat) {
    if (cat === current) return;
    const now = performance.now();
    objects.forEach(o => {
      if (o.cat === current) { o.target = 0; o.leaving = true; o.start = now + o.i * 35; }
      if (o.cat === cat) { o.target = 1; o.leaving = false; o.a = 0; o.start = now + (current ? 380 : 0) + o.i * 80; o.pivot.visible = true; o.spinBoost = 2.5; }
    });
    current = cat;
  }

  /* ---------- loop (only while the section is on screen) ---------- */
  let visible = false, first = true, last = performance.now();
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && first && autoShow) { first = false; show(document.querySelector('.tab.active')?.dataset.tab || 'kafa'); }
  }, { rootMargin: '100px' }).observe(section);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    draw(now);
  }
  function draw(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const t = now / 1000;
    layout();
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    objects.forEach(o => {
      if (now >= o.start) o.a += (o.target - o.a) * (o.leaving ? 0.09 : 0.06) * (dt * 60);
      if (o.leaving && o.a < 0.01) { o.a = 0; o.pivot.visible = false; }
      if (!o.pivot.visible) return;
      const e = 1 - o.a; // 0 = settled
      const bob = reduce ? 0 : Math.sin(t * o.bobSpeed + o.phase) * o.bobAmp;
      const px = cx + (o.x * U) - mouse.x * o.depth * U * 0.35;
      const py = cy + (o.y + bob) * U + mouse.y * o.depth * U * 0.35 + (o.leaving ? e * 7 * U : -e * 6 * U);
      o.pivot.position.set(px, py, o.z * U * 0.6);
      o.pivot.scale.setScalar(o.s * U * (0.35 + 0.65 * o.a));
      o.spinBoost *= 0.97;
      if (o.hero) {
        o.mesh.rotation.x = o.base.x + Math.sin(t * 0.6 + o.phase) * 0.08 + mouse.y * 0.25 + e * 1.2;
        o.mesh.rotation.y = o.base.y + t * (reduce ? 0 : 0.25) + mouse.x * 0.4 + e * 2;
        o.mesh.rotation.z = Math.sin(t * 0.5) * 0.05;
      } else if (!reduce) {
        o.mesh.rotation.x += o.spin.x * dt * (1 + o.spinBoost);
        o.mesh.rotation.y += o.spin.y * dt * (1 + o.spinBoost);
        o.mesh.rotation.z += o.spin.z * dt * (1 + o.spinBoost);
      }
    });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // renderAt: draws one frame at a given time (used for testing/snapshots)
  return {
    show,
    renderAt(now, bg) {
      if (first) { first = false; show(Object.keys(sets)[0]); }
      if (bg !== undefined) renderer.setClearColor(bg, 1);
      draw(now);
      renderer.setClearColor(0x000000, 0);
      return canvas;
    }
  };
};

// Back-compat name used by the menu
window.initMenu3D = opts => window.initFloat3D(Object.assign({ scene: 'menu' }, opts));
