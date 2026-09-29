/* Liona — hero image rendered through a WebGL "coffee surface" shader.
   A small wave simulation (ping-pong render targets) is disturbed by the pointer and by
   occasional idle drops; the photo is refracted through it with a slight chromatic split,
   a warm liquid highlight, a slow light sweep and film grain. Warm motes rise through the frame.
   The real <img> stays underneath as the accessible fallback; the canvas fades in only when ready. */
window.initHeroGL = function ({ host, img, reduce }) {
  if (!window.THREE || reduce || !host || !img) return null;
  const T = THREE;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-gl';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }
  img.after(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new T.PlaneGeometry(2, 2);
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

  /* ---------- wave simulation ---------- */
  const rtOpts = { type: T.HalfFloatType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false };
  let rtA = new T.WebGLRenderTarget(4, 4, rtOpts), rtB = rtA.clone();
  const simMat = new T.ShaderMaterial({
    vertexShader: VERT,
    uniforms: {
      uPrev: { value: null }, uTexel: { value: new T.Vector2() }, uAspect: { value: 1 },
      uA: { value: new T.Vector2(-1, -1) }, uB: { value: new T.Vector2(-1, -1) }, uForce: { value: 0 },
      uDrop: { value: new T.Vector3(-1, -1, 0) }, uRadius: { value: 0.028 }
    },
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uPrev; uniform vec2 uTexel; uniform float uAspect;
      uniform vec2 uA, uB; uniform float uForce, uRadius; uniform vec3 uDrop;
      void main(){
        vec4 c = texture2D(uPrev, vUv);
        float n = (texture2D(uPrev, vUv + vec2(uTexel.x, 0.)).r + texture2D(uPrev, vUv - vec2(uTexel.x, 0.)).r +
                   texture2D(uPrev, vUv + vec2(0., uTexel.y)).r + texture2D(uPrev, vUv - vec2(0., uTexel.y)).r) * .5 - c.g;
        n *= .984;
        vec2 k = vec2(uAspect, 1.);
        vec2 p = vUv * k, a = uA * k, b = uB * k, ab = b - a;
        float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0., 1.);
        n += uForce * (1. - smoothstep(0., uRadius, length(p - (a + ab * t))));
        n += uDrop.z * (1. - smoothstep(0., uRadius * 1.6, length(p - uDrop.xy * k)));
        gl_FragColor = vec4(n, c.r, 0., 1.);
      }`
  });
  const simScene = new T.Scene(); simScene.add(new T.Mesh(quad, simMat));

  /* ---------- image pass ---------- */
  // Use a detached copy: for an <img> in the DOM, .width is the laid-out size, which breaks the upload.
  const srcImg = new Image();
  srcImg.src = img.currentSrc || img.src;
  const tex = new T.Texture(srcImg);
  tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
  const state = { zoom: 1.15, scroll: 0 };
  const mat = new T.ShaderMaterial({
    vertexShader: VERT,
    uniforms: {
      uImg: { value: tex }, uHeight: { value: null }, uTexel: { value: new T.Vector2() },
      uCover: { value: new T.Vector2(1, 1) }, uZoom: { value: 1.15 }, uTime: { value: 0 },
      uAspect: { value: 1 }, uRes: { value: new T.Vector2() }, uScroll: { value: 0 }
    },
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uImg, uHeight; uniform vec2 uTexel, uCover, uRes;
      uniform float uZoom, uTime, uAspect, uScroll;
      float h(vec2 o){ return texture2D(uHeight, vUv + o).r; }
      void main(){
        vec2 g = vec2(h(vec2(uTexel.x, 0.)) - h(vec2(-uTexel.x, 0.)), h(vec2(0., uTexel.y)) - h(vec2(0., -uTexel.y)));
        vec2 off = g * .04;
        vec2 uv = (vUv - .5) * uCover / uZoom + .5;
        vec3 col;
        col.r = texture2D(uImg, uv + off * 1.12).r;
        col.g = texture2D(uImg, uv + off).g;
        col.b = texture2D(uImg, uv + off * .88).b;
        float l = dot(col, vec3(.299, .587, .114));
        col = mix(vec3(l), col, .85) * (.5 - uScroll * .18);
        // liquid highlight where the surface is disturbed
        vec3 N = normalize(vec3(-g * 9., 1.));
        float spec = pow(max(dot(reflect(-normalize(vec3(-.45, .55, .7)), N), vec3(0., 0., 1.)), 0.), 36.);
        col += vec3(1., .8, .52) * spec * .55 * smoothstep(0., .02, length(g));
        // slow warm light sweep
        vec2 q = (vUv - vec2(.68 + .12 * sin(uTime * .17), .42 + .08 * cos(uTime * .23))) * vec2(uAspect, 1.);
        col += vec3(.42, .24, .09) * .22 * exp(-dot(q, q) * 2.6);
        // vignette + grain
        vec2 v = vUv - .5; col *= 1. - dot(v, v) * .55;
        float n = fract(sin(dot(floor(vUv * uRes) + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
        col += (n - .5) * .03;
        gl_FragColor = vec4(col, 1.);
      }`
  });
  const scene = new T.Scene(); scene.add(new T.Mesh(quad, mat));

  /* ---------- rising motes ---------- */
  const COUNT = 110, seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const pg = new T.BufferGeometry();
  pg.setAttribute('position', new T.BufferAttribute(new Float32Array(COUNT * 3), 3));
  pg.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));
  const motes = new T.Points(pg, new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `
      attribute vec4 aSeed; uniform float uTime, uPx; varying float vA;
      void main(){
        float speed = .018 + aSeed.y * .035;
        float life = fract(aSeed.x + uTime * speed);
        float x = aSeed.z * 2. - 1. + sin(uTime * (.3 + aSeed.w * .4) + aSeed.x * 20.) * .04;
        float y = -1.1 + life * 2.3;
        vA = sin(3.14159 * life) * (.25 + aSeed.w * .75);
        gl_Position = vec4(x, y, 0., 1.);
        gl_PointSize = (1.5 + aSeed.w * aSeed.w * 5.) * uPx;
      }`,
    fragmentShader: `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA; gl_FragColor = vec4(vec3(1., .78, .45) * a * .55, a); }`
  }));
  motes.frustumCulled = false;
  scene.add(motes);

  /* ---------- sizing ---------- */
  let W = 0, H = 0, SW = 0, SH = 0;
  function resize() {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === W && h === H) return;
    W = w; H = h;
    renderer.setSize(W, H, false);
    SW = Math.max(64, Math.round(W / 4)); SH = Math.max(64, Math.round(H / 4));
    rtA.setSize(SW, SH); rtB.setSize(SW, SH);
    [rtA, rtB].forEach(rt => { renderer.setRenderTarget(rt); renderer.clear(); });
    renderer.setRenderTarget(null);
    const tx = new T.Vector2(1 / SW, 1 / SH);
    simMat.uniforms.uTexel.value.copy(tx); mat.uniforms.uTexel.value.copy(tx);
    simMat.uniforms.uAspect.value = mat.uniforms.uAspect.value = W / H;
    mat.uniforms.uRes.value.set(W, H);
    motes.material.uniforms.uPx.value = renderer.getPixelRatio();
    const ia = (srcImg.naturalWidth || 16) / (srcImg.naturalHeight || 9), ca = W / H;
    mat.uniforms.uCover.value.set(ca > ia ? 1 : ca / ia, ca > ia ? ia / ca : 1);
  }

  /* ---------- pointer ---------- */
  const ptr = { x: -1, y: -1, px: -1, py: -1, has: false };
  window.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) { ptr.has = false; return; }
    if (!ptr.has) { ptr.px = x; ptr.py = y; }
    ptr.x = x; ptr.y = y; ptr.has = true;
  }, { passive: true });

  /* ---------- loop ---------- */
  let visible = true, ready = false, nextDrop = 0, pending = null;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  const start = performance.now();

  function step() {
    // pointer trail segment for this frame
    const dx = ptr.x - ptr.px, dy = ptr.y - ptr.py, speed = Math.hypot(dx, dy);
    simMat.uniforms.uA.value.set(ptr.px, ptr.py);
    simMat.uniforms.uB.value.set(ptr.x, ptr.y);
    simMat.uniforms.uForce.value = ptr.has ? Math.min(speed * 14, 0.9) : 0;
    ptr.px = ptr.x; ptr.py = ptr.y;
    // idle drop, like a drip on a coffee surface
    const now = performance.now();
    if (pending) { simMat.uniforms.uDrop.value.copy(pending); pending = null; }
    else if (now > nextDrop) {
      simMat.uniforms.uDrop.value.set(0.25 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, 0.4);
      nextDrop = now + 1600 + Math.random() * 1800;
    } else simMat.uniforms.uDrop.value.z = 0;
    simMat.uniforms.uPrev.value = rtA.texture;
    renderer.setRenderTarget(rtB); renderer.render(simScene, cam);
    [rtA, rtB] = [rtB, rtA];
  }

  function draw() {
    resize();
    step();
    renderer.setRenderTarget(null);
    const t = (performance.now() - start) / 1000;
    mat.uniforms.uHeight.value = rtA.texture;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uZoom.value = state.zoom;
    mat.uniforms.uScroll.value = state.scroll;
    motes.material.uniforms.uTime.value = t;
    renderer.render(scene, cam);
    if (!ready) { ready = true; canvas.classList.add('ready'); }
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    draw();
  }

  const go = () => { tex.needsUpdate = true; requestAnimationFrame(frame); };
  if (srcImg.complete && srcImg.naturalWidth) go(); else srcImg.addEventListener('load', go, { once: true });

  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); canvas.remove(); });

  return { state, canvas, draw, drop: (x, y, s = 0.8) => { pending = new T.Vector3(x, y, s); } };
};
