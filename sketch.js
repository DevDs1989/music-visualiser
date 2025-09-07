// sketch.js
// Requires p5.js and p5.sound

let NUM_POINTS = 80;
let BASE_CONNECT_DIST = 75;
let points = [];
let song;
let fft, amp;
let isPlaying = false;
let audioLoaded = false;
let currentVisualizer = 'network';

// Grid visualizer variables
let gridSize = 10;
let gridBoxes = [];
let bassHistory = [];
let midHistory = [];
let trebleHistory = [];

// UI elements from HTML
let fileInput, playPauseBtn, progressSlider, currentTimeEl, durationEl, songTitleEl, volumeSlider;

function setup() {
  let cnv = createCanvas(800, 800);
  cnv.parent("sketch-holder");
  background(25);

  fft = new p5.FFT(0.8, 512);
  amp = new p5.Amplitude();

  initializeVisualizers();

  // Link to HTML controls
  fileInput = document.getElementById("fileInput");
  playPauseBtn = document.getElementById("playPause");
  progressSlider = document.getElementById("progress");
  currentTimeEl = document.getElementById("currentTime");
  durationEl = document.getElementById("duration");
  songTitleEl = document.getElementById("songTitle");
  volumeSlider = document.getElementById("volumeSlider");

  // Navigation buttons
  document.getElementById("networkBtn").addEventListener("click", () => setVisualizer('network'));
  document.getElementById("gridBtn").addEventListener("click", () => setVisualizer('grid'));
  document.getElementById("circleBtn").addEventListener("click", () => setVisualizer('circle'));

  fileInput.addEventListener("change", handleFile);
  playPauseBtn.addEventListener("click", togglePlay);
  // Track if user is dragging the slider
  window.isSeeking = false;
  progressSlider.addEventListener("input", (e) => {
    window.isSeeking = true;
    scrubAudio(e);
  });
  progressSlider.addEventListener("change", (e) => {
    window.isSeeking = false;
    scrubAudio(e);
  });
  volumeSlider.addEventListener("input", changeVolume);

  frameRate(60);
}

function initializeVisualizers() {
  // Initialize network points (unchanged from original)
  points = [];
  for (let i = 0; i < NUM_POINTS; i++) {
    points.push({
      pos: createVector(random(width), random(height)),
      vel: p5.Vector.random2D().mult(random(0.4, 1.2)),
      size: random(5, 16),
      filled: random() < 0.45,
      targetSize: 0
    });
  }

  // Initialize grid boxes with minimal properties
  gridBoxes = [];
  let boxSize = width / gridSize;
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      gridBoxes.push({
        x: x * boxSize,
        y: y * boxSize,
        size: boxSize,
        centerX: x * boxSize + boxSize / 2,
        centerY: y * boxSize + boxSize / 2,
        
        // Grid position ratios
        xRatio: x / (gridSize - 1),
        yRatio: y / (gridSize - 1),
        
        // Audio reactivity
        bassIntensity: 0,
        midIntensity: 0,
        trebleIntensity: 0,
        targetBass: 0,
        targetMid: 0,
        targetTreble: 0,
        
        // Visual properties
        scale: 1,
        targetScale: 1,
        
        // Simple feature: some boxes have inner squares
        hasInnerBox: random() < 0.4 // About 40% will have inner squares like the reference
      });
    }
  }
  
  // Initialize frequency history arrays
  bassHistory = new Array(30).fill(0);
  midHistory = new Array(30).fill(0);
  trebleHistory = new Array(30).fill(0);
}

function draw() {
  background(25);

  let level = 0;
  let spectrum = [];
  let bass = 0, mid = 0, treble = 0;
  
  if (audioLoaded && isPlaying && song) {
    spectrum = fft.analyze();
    level = amp.getLevel();

    // Extract frequency ranges
    bass = fft.getEnergy("bass") / 255;
    mid = fft.getEnergy("mid") / 255;
    treble = fft.getEnergy("treble") / 255;
    
    // Update frequency history for smoother animations
    bassHistory.push(bass);
    midHistory.push(mid);
    trebleHistory.push(treble);
    if (bassHistory.length > 30) bassHistory.shift();
    if (midHistory.length > 30) midHistory.shift();
    if (trebleHistory.length > 30) trebleHistory.shift();

    // Update progress bar
    let current = song.currentTime();
    let total = song.duration();
    if (!isNaN(total)) {
      // Only update slider if not seeking
      if (!window.isSeeking) {
        progressSlider.value = (current / total) * 100;
      }
      currentTimeEl.textContent = formatTime(current);
      durationEl.textContent = formatTime(total);
    }
  }

  // Render based on current visualizer
  if (currentVisualizer === 'network') {
    drawNetworkVisualizer(level);
  } else if (currentVisualizer === 'grid') {
    drawGridVisualizer(level, spectrum, bass, mid, treble);
  }else if (currentVisualizer === 'circle') {
    drawCircleVisualizer(level, spectrum, bass, mid, treble);
  }
}

function drawNetworkVisualizer(level) {
  let CONNECT_DIST = BASE_CONNECT_DIST + level * 100;

  // Update and draw points (unchanged from original)
  for (let p of points) {
    let speedBoost = 1 + level * 90; 
    let targetVel = p.vel.copy().mult(speedBoost);
    p.pos.add(p5.Vector.lerp(p.vel, targetVel, 0.05));

    if (p.pos.x < 0 || p.pos.x > width) p.vel.x *= -1;
    if (p.pos.y < 0 || p.pos.y > height) p.vel.y *= -1;

    p.targetSize = p.size * (1 + level * 2);
    let pulse = lerp((p.pulse || p.size), p.targetSize, 0.1);
    p.pulse = pulse;

    stroke(220, 220, 220, 180);
    if (p.filled) fill(220, 220, 220, 180);
    else noFill();
    ellipse(p.pos.x, p.pos.y, pulse, pulse);
  }

  // Connections
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      let a = points[i], b = points[j];
      let d = dist(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
      if (d < CONNECT_DIST) {
        let alpha = map(d, 0, CONNECT_DIST, 220, 8);
        let smoothAlpha = lerp((a.lineAlpha || 0), alpha, 0.2);
        a.lineAlpha = smoothAlpha;

        strokeWeight(1.5);
        stroke(220, 220, 220, smoothAlpha);
        line(a.pos.x, a.pos.y, b.pos.x, b.pos.y);
      }
    }
  }

  // Mouse interaction
  // if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
  //   let targetMouseSize = 16 + level * 40;
  //   if (!window.mousePulse) window.mousePulse = 16;
  //   window.mousePulse = lerp(window.mousePulse, targetMouseSize, 0.2);

  //   stroke(0, 255, 255, 180);
  //   fill(0, 255, 255, 80);
  //   ellipse(mouseX, mouseY, window.mousePulse, window.mousePulse);

  //   for (let p of points) {
  //     let d = dist(mouseX, mouseY, p.pos.x, p.pos.y);
  //     if (d < CONNECT_DIST) {
  //       let alpha = map(d, 0, CONNECT_DIST, 220, 0);
  //       let smoothAlpha = lerp((p.mouseLineAlpha || 0), alpha, 0.2);
  //       p.mouseLineAlpha = smoothAlpha;

  //       strokeWeight(1.5);
  //       stroke(0, 255, 255, smoothAlpha);
  //       line(mouseX, mouseY, p.pos.x, p.pos.y);
  //     }
  //   }
  // }
}
function drawGridVisualizer(level, spectrum, bass, mid, treble) {
  noFill();

  // Center coordinates
  let centerX = (gridSize - 1) / 2;
  let centerY = (gridSize - 1) / 2;
  let maxDist = dist(0, 0, centerX, centerY);

  for (let i = 0; i < gridBoxes.length; i++) {
    let box = gridBoxes[i];

    let x = i % gridSize;
    let y = Math.floor(i / gridSize);

    // Distance factor from center (1 at center, 0 at edges)
    let d = dist(x, y, centerX, centerY);
    let centerFactor = 1.01 - (d / maxDist);

    // Target intensities with center-weighted bass
    box.targetBass = bass * centerFactor;
    box.targetMid = mid;   // mid can stay uniform or adjust if you like
    box.targetTreble = treble; // same for treble

    // Smooth interpolation
    box.bassIntensity = lerp(box.bassIntensity || 0, box.targetBass, 0.1);
    box.midIntensity = lerp(box.midIntensity || 0, box.targetMid, 0.1);
    box.trebleIntensity = lerp(box.trebleIntensity || 0, box.targetTreble, 0.1);

    let totalIntensity = (box.bassIntensity + box.midIntensity + box.trebleIntensity) / 3 * level * 2;

    push();
    translate(box.centerX, box.centerY);
    rectMode(CENTER);

    // Outer box
    stroke(255, 255, 255, 255);
    strokeWeight(1 + totalIntensity * 2);
    rect(0, 0, box.size * 0.7, box.size * 0.7, box.size * 0.03);

    // Inner box (bass pulse strongest at center)
    let innerSize = box.size * 0.3 * (0.5 + totalIntensity);
    let innerOpacity = box.bassIntensity * 2000  ;
    stroke(255, 255, 255, innerOpacity /5);
    strokeWeight(1 + totalIntensity * 2);
    rect(0, 0, innerSize, innerSize, innerSize * 0.03);

    pop();
  }
}

// circle visualiser with multiple circles inside it that have completetion depending on the intencity of the bass, mid and treble
function drawCircleVisualizer(level, spectrum, bass, mid, treble) {
  // Multi-circle visualizer: 10 concentric circles, each pulsing in size and opacity
  let centerX = width / 2;
  let centerY = height / 2;
  let maxRadius = min(width, height) / 2 * 0.9;
  let numCircles = 10;
  let minRadius = maxRadius * 0.20;
  let step = (maxRadius - minRadius) / (numCircles - 1);
  // Use persistent arrays for lerp
  if (!drawCircleVisualizer.pulseRadii || drawCircleVisualizer.pulseRadii.length !== numCircles) {
    drawCircleVisualizer.pulseRadii = Array(numCircles).fill(0);
    drawCircleVisualizer.pulseAlpha = Array(numCircles).fill(0);
  }
  for (let i = 0; i < numCircles; i++) {
    // Each circle responds to a different blend of audio
    let blend =
      i < 3 ? bass :
      i < 6 ? mid :
      i < 8 ? treble :
      (bass + mid + treble) / 3;
    let amp = level * (0.7 + 0.3 * Math.sin(i));
    let targetRadius = minRadius + i * step + blend * 30 + amp * 40;
    let prevRadius = drawCircleVisualizer.pulseRadii[i] || minRadius + i * step;
    let lerpedRadius = lerp(prevRadius, targetRadius, 0.18);
    drawCircleVisualizer.pulseRadii[i] = lerpedRadius;

    // Opacity is zero when intensity is low
    let rawAlpha = (blend + amp) * 120; // scale as needed
    let targetAlpha = constrain(rawAlpha, 0, 180); // max 180, min 0
    let prevAlpha = drawCircleVisualizer.pulseAlpha[i] || 0;
    let lerpedAlpha = lerp(prevAlpha, targetAlpha, 0.18);
    drawCircleVisualizer.pulseAlpha[i] = lerpedAlpha;

    stroke(255, lerpedAlpha);
    strokeWeight(2 + (i === 0 ? 2 : 0));
    noFill();
    if (lerpedAlpha > 1) {
      ellipse(centerX, centerY, lerpedRadius * 2, lerpedRadius * 2);
    }
  }

  // Center pulse
  let pulse = 30 + level * 120;
  noStroke();
  fill(255, 255, 255, 60 + level * 120);
  ellipse(centerX, centerY, pulse, pulse);
}

function setVisualizer(type) {
  currentVisualizer = type;
  
  // Update active button
  document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(type + 'Btn').classList.add('active');

}

// --- Audio Controls (unchanged) ---

function handleFile(e) {
  let file = e.target.files[0];
  if (!file) return;

  if (file.type.startsWith("audio")) {
    if (song) {
      try { song.stop(); } catch (e) {}
      try { song.disconnect(); } catch (e) {}
    }

    songTitleEl.textContent = file.name;

    song = loadSound(URL.createObjectURL(file), () => {
      audioLoaded = true;
      fft.setInput(song);
      amp.setInput(song);
      song.play();
      isPlaying = true;
      updatePlayButton(true);
      song.setVolume(volumeSlider.value);
    });
  } else {
    console.log("Not an audio file");
  }
}

function togglePlay() {
  if (!audioLoaded || !song) return;
  if (song.isPlaying()) {
    song.pause();
    isPlaying = false;
    updatePlayButton(false);
  } else {
    song.play();
    isPlaying = true;
    updatePlayButton(true);
  }
}

function updatePlayButton(playing) {
  const playIcon = playPauseBtn.querySelector('.play-icon');
  if (playing) {
    playIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>`;
  } else {
    playIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1M7 7h10v10H7V7z M10 9l5 3-5 3V9z"></path>`;
  }
}

function scrubAudio() {
  if (!audioLoaded || !song) return;
  let total = song.duration();
  let seekTime = (progressSlider.value / 100) * total;
  if (!isNaN(seekTime) && isFinite(seekTime)) {
    song.jump(seekTime);
  }
}

function changeVolume(e) {
  if (!song) return;  
  song.setVolume(e.target.value);
}

function formatTime(seconds) {
  let m = Math.floor(seconds / 60);
  let s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// --- Responsive canvas ---
function windowResized() {
  let container = document.getElementById("sketch-holder");
  let containerSize = Math.min(container.clientWidth, container.clientHeight);
  resizeCanvas(containerSize, containerSize);

  // Reinitialize visualizers for new canvas size
  initializeVisualizers();
}