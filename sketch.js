// sketch.js
// Requires p5.js and p5.sound

let NUM_POINTS = 35;
let BASE_CONNECT_DIST = 70;
let points = [];
let song;
let fft, amp;
let isPlaying = false;
let audioLoaded = false;

// UI elements from HTML
let fileInput, playPauseBtn, progressSlider, currentTimeEl, durationEl, songTitleEl, volumeSlider;

function setup() {
  let cnv = createCanvas(800, 800);
  cnv.parent("sketch-holder");
  background(25);

  fft = new p5.FFT(0.9, 128);
  amp = new p5.Amplitude();

  for (let i = 0; i < NUM_POINTS; i++) {
    points.push({
      pos: createVector(random(width), random(height)),
      vel: p5.Vector.random2D().mult(random(0.4, 1.2)),
      size: random(5, 16),
      filled: random() < 0.45,
      targetSize: 0 // for smooth pulsing
    });
  }

  // Link to HTML controls
  fileInput = document.getElementById("fileInput");
  playPauseBtn = document.getElementById("playPause");
  progressSlider = document.getElementById("progress");
  currentTimeEl = document.getElementById("currentTime");
  durationEl = document.getElementById("duration");
  songTitleEl = document.getElementById("songTitle");
  volumeSlider = document.getElementById("volumeSlider");

  fileInput.addEventListener("change", handleFile);
  playPauseBtn.addEventListener("click", togglePlay);
  progressSlider.addEventListener("input", scrubAudio);
  volumeSlider.addEventListener("input", changeVolume);

  frameRate(60); // smooth animation
}

function draw() {
  background(25);

  let level = 0;
  if (audioLoaded && isPlaying && song) {
    fft.analyze();
    level = amp.getLevel();

    // Smooth progress bar update
    let current = song.currentTime();
    let total = song.duration();
    if (!isNaN(total)) {
      progressSlider.value = lerp(progressSlider.value, (current / total) * 100, 0.1);
      currentTimeEl.textContent = formatTime(current);
      durationEl.textContent = formatTime(total);
    }
  }

  let CONNECT_DIST = BASE_CONNECT_DIST + level * 200;

  // update and draw points
  for (let p of points) {
    // Smooth movement using velocity
    let speedBoost = 1 + level * 50; 
    let targetVel = p.vel.copy().mult(speedBoost);
    p.pos.add(p5.Vector.lerp(p.vel, targetVel, 0.05));

    if (p.pos.x < 0 || p.pos.x > width) p.vel.x *= -1;
    if (p.pos.y < 0 || p.pos.y > height) p.vel.y *= -1;

    // Smooth pulsing size
    p.targetSize = p.size * (1 + level * 2);
    let pulse = lerp((p.pulse || p.size), p.targetSize, 0.1);
    p.pulse = pulse;

    stroke(220, 220, 220, 180);
    if (p.filled) fill(220, 220, 220, 180);
    else noFill();
    ellipse(p.pos.x, p.pos.y, pulse, pulse);
  }

  // connections with smooth alpha and thickness
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

  // mouse interaction smoothing
  if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
    let targetMouseSize = 16 + level * 40;
    if (!window.mousePulse) window.mousePulse = 16;
    window.mousePulse = lerp(window.mousePulse, targetMouseSize, 0.2);

    stroke(0, 255, 255, 180);
    fill(0, 255, 255, 80);
    ellipse(mouseX, mouseY, window.mousePulse, window.mousePulse);

    for (let p of points) {
      let d = dist(mouseX, mouseY, p.pos.x, p.pos.y);
      if (d < CONNECT_DIST) {
        let alpha = map(d, 0, CONNECT_DIST, 220, 0);
        let smoothAlpha = lerp((p.mouseLineAlpha || 0), alpha, 0.2);
        p.mouseLineAlpha = smoothAlpha;

        strokeWeight(1.5);
        stroke(0, 255, 255, smoothAlpha);
        line(mouseX, mouseY, p.pos.x, p.pos.y);
      }
    }
  }
}

// --- Helpers ---

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
      playPauseBtn.textContent = "⏸️";
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
    playPauseBtn.textContent = "▶️";
  } else {
    song.play();
    isPlaying = true;
    playPauseBtn.textContent = "⏸️";
  }
}

function scrubAudio() {
  if (!audioLoaded || !song) return;
  let total = song.duration();
  let seekTime = (progressSlider.value / 100) * total;
  song.jump(seekTime);
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
  let oldWidth = width;
  let oldHeight = height;
  let newSize = min(window.innerWidth * 0.9, window.innerHeight * 0.9);
  resizeCanvas(newSize, newSize);

  for (let p of points) {
    p.pos.x = (p.pos.x / oldWidth) * width;
    p.pos.y = (p.pos.y / oldHeight) * height;
  }
}
