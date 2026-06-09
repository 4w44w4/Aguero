/* ═══════════════════════════════════════════════
   AGUERO BANKS — VAULT PLAYER SCRIPT
   Three.js vinyl · Vault mechanism · Audio engine
═══════════════════════════════════════════════ */

'use strict';

/* ── TRACKLIST DATA ─────────────────────────────
   Replace audio paths with real file URLs.
   duration is display-only (no audio file needed for UI).
──────────────────────────────────────────────── */
const tracks = [
  { title: "Akwa Ego",        feat: null,                          audio: null, duration: "3:12" },
  { title: "Obara",           feat: null,                          audio: null, duration: "3:41" },
  { title: "Tene",            feat: null,                          audio: null, duration: "2:58" },
  { title: "Push 2 Start",    feat: "feat. Chike",                 audio: null, duration: "3:55" },
  { title: "Oku",             feat: "feat. Wizard Chan & Odumodublavk", audio: null, duration: "4:08" },
  { title: "Nta na Imo",      feat: null,                          audio: null, duration: "3:27" },
  { title: "Anointing",       feat: null,                          audio: null, duration: "3:34" },
  { title: "Born Sinner",     feat: "feat. PsycoYP",               audio: null, duration: "3:49" },
  { title: "ỌGWỤ EGO",        feat: null,                          audio: null, duration: "3:16" },
  { title: "MGBE OLE",        feat: null,                          audio: null, duration: "3:52" },
  { title: "Jump & Pass",     feat: "feat. Ajebo Hustlers",        audio: null, duration: "4:01" },
  { title: "Godsent",         feat: null,                          audio: null, duration: "3:38" },
  { title: "My Story",        feat: null,                          audio: null, duration: "4:22" },
];

/* ── STATE ────────────────────────────────────── */
let state = {
  currentIndex: 0,
  isPlaying: false,
  isShuffled: false,
  vaultOpened: false,
  progress: 0,
  audioCtx: null,
  analyser: null,
  audioElement: null,
  animationId: null,
};

/* ── DOM REFS ──────────────────────────────────── */
const $ = id => document.getElementById(id);
const q = sel => document.querySelector(sel);
const qa = sel => document.querySelectorAll(sel);

/* ── THREE.JS VINYL ─────────────────────────────
   Creates a spinning vinyl record with gold grooves
   and a center label inside the vault inner circle.
──────────────────────────────────────────────── */
let threeScene, threeCamera, threeRenderer, vinylMesh, labelMesh, shineMesh;
let vinylRotationSpeed = 0;
let targetRotationSpeed = 0;

function initThree() {
  const canvas = $('vinyl-canvas');
  const container = canvas.parentElement;
  const size = container.offsetWidth;

  threeRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeRenderer.setSize(size, size);
  threeRenderer.shadowMap.enabled = true;
  threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

  threeScene = new THREE.Scene();

  // Camera — slight perspective tilt for depth
  threeCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  threeCamera.position.set(0, 0.3, 3.2);
  threeCamera.lookAt(0, 0, 0);

  // Ambient
  const ambient = new THREE.AmbientLight(0x1a1408, 2.5);
  threeScene.add(ambient);

  // Main gold key light
  const keyLight = new THREE.DirectionalLight(0xd4b86a, 3.5);
  keyLight.position.set(2, 3, 2);
  keyLight.castShadow = true;
  threeScene.add(keyLight);

  // Rim light — cold
  const rimLight = new THREE.DirectionalLight(0x4a3820, 1.2);
  rimLight.position.set(-2, -1, 1);
  threeScene.add(rimLight);

  // Gold fill from below
  const fillLight = new THREE.PointLight(0xc4a24a, 0.8, 8);
  fillLight.position.set(0, -1.5, 1);
  threeScene.add(fillLight);

  buildVinyl();
  buildFloatShadow();
  threeLoop();

  canvas.classList.add('visible');

  // Resize
  window.addEventListener('resize', () => {
    const s = container.offsetWidth;
    threeRenderer.setSize(s, s);
    threeCamera.updateProjectionMatrix();
  });
}

function buildVinyl() {
  const group = new THREE.Group();
  threeScene.add(group);
  vinylMesh = group;

  // ── Main disc ──
  const discGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.04, 128, 1);
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x0d0c0a,
    roughness: 0.18,
    metalness: 0.7,
    envMapIntensity: 1.2,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.castShadow = true;
  disc.receiveShadow = true;
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  // ── Grooves — concentric rings on vinyl surface ──
  for (let i = 0; i < 28; i++) {
    const r = 0.22 + i * 0.028;
    const grooveGeo = new THREE.TorusGeometry(r, 0.003, 6, 128);
    const alpha = 0.08 + (i % 3 === 0 ? 0.12 : 0);
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0xc4a24a,
      roughness: 0.6,
      metalness: 0.9,
      transparent: true,
      opacity: alpha,
    });
    const groove = new THREE.Mesh(grooveGeo, grooveMat);
    groove.rotation.x = Math.PI / 2;
    groove.position.y = 0.021;
    group.add(groove);
  }

  // ── Shiny gold band near edge ──
  const bandGeo = new THREE.TorusGeometry(0.96, 0.025, 12, 128);
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xc4a24a,
    roughness: 0.1,
    metalness: 1.0,
    emissive: 0x7a6228,
    emissiveIntensity: 0.3,
  });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.022;
  group.add(band);

  // ── Center label ──
  const labelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.044, 64, 1);
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 512;
  const lctx = labelCanvas.getContext('2d');

  // Draw label background
  const grad = lctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, '#2a1f08');
  grad.addColorStop(0.5, '#1a1408');
  grad.addColorStop(1, '#0d0a04');
  lctx.fillStyle = grad;
  lctx.beginPath();
  lctx.arc(256, 256, 256, 0, Math.PI * 2);
  lctx.fill();

  // Gold ring
  lctx.strokeStyle = 'rgba(196,162,74,0.6)';
  lctx.lineWidth = 8;
  lctx.beginPath();
  lctx.arc(256, 256, 240, 0, Math.PI * 2);
  lctx.stroke();

  // Text
  lctx.fillStyle = 'rgba(196,162,74,0.85)';
  lctx.font = 'bold 42px serif';
  lctx.textAlign = 'center';
  lctx.textBaseline = 'middle';
  lctx.fillText('AGUERO', 256, 220);
  lctx.font = '28px serif';
  lctx.fillStyle = 'rgba(196,162,74,0.5)';
  lctx.fillText('BANKS', 256, 265);
  lctx.font = '20px sans-serif';
  lctx.fillStyle = 'rgba(196,162,74,0.3)';
  lctx.fillText('THE RETURN', 256, 306);

  // Center hole
  lctx.fillStyle = '#050504';
  lctx.beginPath();
  lctx.arc(256, 256, 18, 0, Math.PI * 2);
  lctx.fill();

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    roughness: 0.3,
    metalness: 0.4,
  });
  labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.rotation.x = Math.PI / 2;
  labelMesh.position.y = 0.001;
  group.add(labelMesh);

  // Center spindle hole
  const holeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.06, 32);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x050504, roughness: 1, metalness: 0 });
  const hole = new THREE.Mesh(holeGeo, holeMat);
  hole.rotation.x = Math.PI / 2;
  group.add(hole);

  // Slight initial tilt for depth feel
  group.rotation.x = 0.18;
  group.position.y = -0.05;
}

function buildFloatShadow() {
  // Soft shadow disc below vinyl
  const shadowGeo = new THREE.CircleGeometry(1.1, 64);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -0.65, 0);
  threeScene.add(shadow);
}

function threeLoop() {
  state.animationId = requestAnimationFrame(threeLoop);

  // Smooth rotation speed transition
  vinylRotationSpeed += (targetRotationSpeed - vinylRotationSpeed) * 0.04;
  if (vinylMesh) {
    vinylMesh.rotation.z += vinylRotationSpeed;
    // Gentle float
    vinylMesh.position.y = -0.05 + Math.sin(Date.now() * 0.0012) * 0.04;
  }

  threeRenderer.render(threeScene, threeCamera);
}

/* ── VAULT MECHANISM ────────────────────────────── */
function openVault() {
  if (state.vaultOpened) return;
  state.vaultOpened = true;

  const door = q('.vault-door');
  const prompt = q('.vault-prompt');
  const flash = q('.vault-flash');

  // Spin vault wheel
  door.classList.add('unlocking');

  setTimeout(() => {
    flash.classList.add('on');
    setTimeout(() => flash.classList.remove('on'), 900);
  }, 1800);

  // Hide prompt
  setTimeout(() => {
    prompt.classList.add('hidden');
  }, 400);

  // Init Three.js after brief delay
  setTimeout(() => {
    initThree();
    updateTrackUI(0, false);
  }, 600);
}

/* ── AUDIO ENGINE ────────────────────────────────
   Uses Web Audio API for waveform analysis.
   Gracefully handles missing audio files.
──────────────────────────────────────────────── */
function initAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 64;
    state.analyser.smoothingTimeConstant = 0.8;
    state.analyser.connect(state.audioCtx.destination);
  }
}

function loadTrack(index) {
  const track = tracks[index];
  state.currentIndex = index;

  if (state.audioElement) {
    state.audioElement.pause();
    state.audioElement.src = '';
  }

  updateTrackUI(index, state.isPlaying);
  updateTrackList(index);

  if (track.audio) {
    if (!state.audioElement) {
      state.audioElement = new Audio();
      state.audioElement.crossOrigin = 'anonymous';
    }
    state.audioElement.src = track.audio;

    initAudio();
    if (!state.sourceNode) {
      state.sourceNode = state.audioCtx.createMediaElementSource(state.audioElement);
      state.sourceNode.connect(state.analyser);
    }

    state.audioElement.addEventListener('timeupdate', onTimeUpdate);
    state.audioElement.addEventListener('ended', onTrackEnd);

    if (state.isPlaying) {
      state.audioCtx.resume().then(() => state.audioElement.play());
    }
  }
}

function onTimeUpdate() {
  if (!state.audioElement || !state.audioElement.duration) return;
  const pct = (state.audioElement.currentTime / state.audioElement.duration) * 100;
  setProgress(pct);
  updateProgressTimes(state.audioElement.currentTime, state.audioElement.duration);
}

function onTrackEnd() {
  nextTrack();
}

function setProgress(pct) {
  q('.progress-fill').style.width = pct + '%';
}

function updateProgressTimes(current, total) {
  q('.time-current').textContent = formatTime(current);
  q('.time-total').textContent = formatTime(total);
}

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ── PLAYBACK CONTROLS ───────────────────────────── */
function play() {
  state.isPlaying = true;
  targetRotationSpeed = 0.004;

  // Update play/pause icon
  updatePlayIcon(true);
  updateTrackList(state.currentIndex);
  updateNeedle(true);

  if (state.audioElement && tracks[state.currentIndex].audio) {
    if (state.audioCtx) state.audioCtx.resume();
    state.audioElement.play();
  }

  // Start simulated waveform if no real audio
  if (!tracks[state.currentIndex].audio) {
    startSimulatedWaveform();
  }
}

function pause() {
  state.isPlaying = false;
  targetRotationSpeed = 0;

  updatePlayIcon(false);
  updateTrackList(state.currentIndex);
  updateNeedle(false);

  if (state.audioElement) state.audioElement.pause();
  stopSimulatedWaveform();
}

function togglePlay() {
  if (!state.vaultOpened) { openVault(); return; }
  state.isPlaying ? pause() : play();
}

function nextTrack() {
  let next;
  if (state.isShuffled) {
    do { next = Math.floor(Math.random() * tracks.length); }
    while (next === state.currentIndex && tracks.length > 1);
  } else {
    next = (state.currentIndex + 1) % tracks.length;
  }
  loadTrack(next);
  if (state.isPlaying) play();
}

function prevTrack() {
  const prev = (state.currentIndex - 1 + tracks.length) % tracks.length;
  loadTrack(prev);
  if (state.isPlaying) play();
}

function toggleShuffle() {
  state.isShuffled = !state.isShuffled;
  $('btn-shuffle').classList.toggle('active', state.isShuffled);
}

/* ── UI UPDATES ──────────────────────────────────── */
function updateTrackUI(index, playing) {
  const track = tracks[index];

  // Animate title change
  const titleEl = q('.now-playing-title');
  titleEl.classList.add('fade-out');
  setTimeout(() => {
    titleEl.textContent = track.title;
    titleEl.classList.remove('fade-out');
    titleEl.classList.add('fade-in');
    setTimeout(() => titleEl.classList.remove('fade-in'), 600);
  }, 260);

  q('.now-playing-meta').innerHTML =
    `<span>${index + 1 < 10 ? '0' : ''}${index + 1} of ${tracks.length}</span>
     <span class="now-playing-duration">${track.duration}</span>`;

  // Reset progress
  setProgress(0);
  q('.time-current').textContent = '0:00';
  q('.time-total').textContent = track.duration;
}

function updateTrackList(activeIndex) {
  qa('.track-item').forEach((el, i) => {
    el.classList.toggle('active', i === activeIndex);
    el.classList.toggle('paused', i === activeIndex && !state.isPlaying);
  });
}

function updatePlayIcon(playing) {
  const btn = $('btn-play');
  btn.classList.toggle('playing', playing);
  btn.innerHTML = playing
    ? `<svg width="22" height="22" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
    : `<svg width="22" height="22" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg>`;
}

/* ── NEEDLE ARM ──────────────────────────────────── */
function updateNeedle(playing) {
  const needle = q('.needle-arm');
  if (!needle) return;
  needle.classList.toggle('down', playing);
}

/* ── SIMULATED WAVEFORM ──────────────────────────── */
let waveInterval;
function startSimulatedWaveform() {
  const bars = qa('.waveform-bar');
  const barCount = bars.length;
  stopSimulatedWaveform();

  waveInterval = setInterval(() => {
    if (!state.isPlaying) return;
    bars.forEach((bar, i) => {
      // Generate organic-looking wave heights
      const t = Date.now() * 0.003;
      const wave = Math.abs(Math.sin(t + i * 0.4) * Math.sin(t * 0.7 + i * 0.2));
      const h = 6 + wave * 42;
      bar.style.height = h + 'px';
      bar.classList.add('active');
    });

    // Simulate progress for demo
    if (!tracks[state.currentIndex].audio) {
      state.progress = (state.progress + 0.03) % 100;
      setProgress(state.progress);
    }
  }, 80);
}

function stopSimulatedWaveform() {
  clearInterval(waveInterval);
  const bars = qa('.waveform-bar');
  bars.forEach(bar => {
    bar.style.height = '';
    bar.classList.remove('active');
  });
  if (!tracks[state.currentIndex].audio) {
    state.progress = 0;
    setProgress(0);
  }
}

/* ── PROGRESS SCRUB ──────────────────────────────── */
function scrubProgress(e) {
  const rail = q('.progress-rail');
  const rect = rail.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
  setProgress(pct);
  if (state.audioElement && state.audioElement.duration) {
    state.audioElement.currentTime = (pct / 100) * state.audioElement.duration;
  }
}

/* ── PARTICLES ───────────────────────────────────── */
function spawnParticles() {
  const field = q('.particle-field');
  const fieldRect = field.parentElement.getBoundingClientRect();

  setInterval(() => {
    if (!state.isPlaying) return;
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1;
    const x = 30 + Math.random() * 40; // cluster near center
    const duration = 3 + Math.random() * 4;
    const delay = Math.random() * 2;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${x}%; bottom:20%;
      animation-duration:${duration}s;
      animation-delay:${delay}s;
      opacity:0;
    `;
    field.appendChild(p);
    setTimeout(() => p.remove(), (duration + delay) * 1000 + 200);
  }, 400);
}

/* ── BUILD TRACKLIST DOM ─────────────────────────── */
function buildTrackList() {
  const ul = $('track-list');
  tracks.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'track-item';
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `Play ${track.title}`);
    li.dataset.index = i;
    li.innerHTML = `
      <span class="track-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="track-playing-indicator" aria-hidden="true">
        <span class="bar-ani"></span>
        <span class="bar-ani"></span>
        <span class="bar-ani"></span>
      </div>
      <span class="track-name">
        ${track.title}
        ${track.feat ? `<span class="track-feat">${track.feat}</span>` : ''}
      </span>
      <span class="track-dur">${track.duration}</span>
    `;
    li.addEventListener('click', () => {
      if (!state.vaultOpened) openVault();
      state.isPlaying = true;
      loadTrack(i);
      play();
    });
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
    });
    ul.appendChild(li);
  });
}

/* ── BUILD WAVEFORM BARS ─────────────────────────── */
function buildWaveform() {
  const wrap = q('.waveform-wrap');
  for (let i = 0; i < 48; i++) {
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    // Preset heights for visual interest when static
    const h = 4 + Math.abs(Math.sin(i * 0.35 + 0.4)) * 28;
    bar.style.height = h + 'px';
    wrap.appendChild(bar);
  }
}

/* ── BUILD VAULT SPOKES ──────────────────────────── */
function buildVaultSpokes() {
  const door = q('.vault-door');
  const spokeCount = 12;
  for (let i = 0; i < spokeCount; i++) {
    const spoke = document.createElement('div');
    spoke.className = 'vault-spoke';
    spoke.style.transform = `translateX(-50%) translateY(-100%) rotate(${i * (360 / spokeCount)}deg)`;
    door.appendChild(spoke);
  }

  // Bolts at cardinal positions
  const boltPositions = [
    { top: '6%',  left: '50%', transform: 'translate(-50%,0)' },
    { top: '50%', left: '94%', transform: 'translate(0,-50%)' },
    { top: '94%', left: '50%', transform: 'translate(-50%,-100%)' },
    { top: '50%', left: '6%',  transform: 'translate(-100%,-50%)' },
  ];
  boltPositions.forEach(pos => {
    const bolt = document.createElement('div');
    bolt.className = 'vault-bolt';
    Object.assign(bolt.style, pos);
    door.appendChild(bolt);
  });
}

/* ── SCROLL REVEAL ───────────────────────────────── */
function initScrollReveal() {
  const els = qa('.shrine-reveal');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  els.forEach(el => obs.observe(el));
}

/* ── INIT ────────────────────────────────────────── */
function init() {
  buildTrackList();
  buildWaveform();
  buildVaultSpokes();
  spawnParticles();
  initScrollReveal();

  // Controls
  $('btn-play').addEventListener('click', togglePlay);
  $('btn-next').addEventListener('click', () => { if (state.vaultOpened) nextTrack(); });
  $('btn-prev').addEventListener('click', () => { if (state.vaultOpened) prevTrack(); });
  $('btn-shuffle').addEventListener('click', toggleShuffle);

  // Vault door click / tap
  q('.vault-prompt').addEventListener('click', openVault);
  q('.vault-inner').addEventListener('click', () => {
    if (!state.vaultOpened) { openVault(); return; }
    togglePlay();
  });

  // Progress scrub
  const rail = q('.progress-rail');
  let scrubbing = false;
  rail.addEventListener('mousedown', e => { scrubbing = true; scrubProgress(e); });
  window.addEventListener('mousemove', e => { if (scrubbing) scrubProgress(e); });
  window.addEventListener('mouseup', () => { scrubbing = false; });
  rail.addEventListener('touchstart', e => scrubProgress(e), { passive: true });
  rail.addEventListener('touchmove', e => scrubProgress(e), { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
