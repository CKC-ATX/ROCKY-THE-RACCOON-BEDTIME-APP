const DEFAULT_MINUTES = 20;
const MAX_MINUTES = 45;
const MAX_EXTRA_TASKS = 5;
const TASK_STORAGE_VERSION = "routine-v1";
const VOICE_STORAGE_VERSION = "recorded-voice-v2";
const NAME_STORAGE_VERSION = "routine-name-v1";
const DEFAULT_CHILD_NAME = "Insert Child's Name Here";

const minutesEl = document.querySelector("#minutes");
const secondsEl = document.querySelector("#seconds");
const progressFill = document.querySelector("#progressFill");
const runner = document.querySelector("#runner");
const startPause = document.querySelector("#startPause");
const pauseResume = document.querySelector("#pauseResume");
const reset = document.querySelector("#reset");
const quiet = document.querySelector("#quiet");
const voiceToggle = document.querySelector("#voiceToggle");
const addTask = document.querySelector("#addTask");
const parentClose = document.querySelector("#parentClose");
const statusText = document.querySelector("#statusText");
const childName = document.querySelector("#childName");
const heroImages = [...document.querySelectorAll(".hero-image")];
const parentControls = document.querySelector(".parent-controls");
const parentToggle = document.querySelector("#parentToggle");
const parentMenu = document.querySelector("#parentMenu");
const durationInput = document.querySelector("#durationInput");
const timerLabel = document.querySelector("#timerLabel");
const taskStrip = document.querySelector("#taskStrip");
const goodnightText = document.querySelector("#goodnightText");
const stickerChart = document.querySelector("#stickerChart");
const sceneMessage = document.querySelector("#sceneMessage");
const sceneAudio = new Audio();
sceneAudio.preload = "auto";

const sceneMessages = {
  start: "Let's Get Ready for Bedtime!",
  "brush-teeth": "It's Time to Brush Our Teeth!",
  pjs: "Let's Get Our\nPJ's On!",
  storybook: "Time For a Storybook!",
  prayer: "Our hearts are grateful...\nLet's Pray!",
  "head-pillow": "Time to Lay Down Your Sleepy Head!"
};

const sceneAudioFiles = {
  start: "assets/lets-start.m4a",
  dash: "assets/lets-start.m4a",
  brush: "assets/teeth.m4a",
  "brush-teeth": "assets/teeth.m4a",
  pjs: "assets/pj.m4a",
  storybook: "assets/storybook.m4a",
  prayer: "assets/prayer.m4a",
  pillow: "assets/pillow.m4a",
  "head-pillow": "assets/pillow.m4a",
  "custom-task": "assets/added-task.m4a",
  goodnight: "assets/pillow.m4a"
};

const defaultTasks = [
  { id: "dash", label: "Let's Start!", scene: "brush-teeth", custom: false },
  { id: "brush", label: "Brush Teeth", scene: "pjs", custom: false },
  { id: "pjs", label: "PJ's", scene: "storybook", custom: false },
  { id: "storybook", label: "Storybook", scene: "prayer", custom: false },
  { id: "prayer", label: "Prayer", scene: "head-pillow", custom: false },
  { id: "pillow", label: "Head On Pillow", scene: "goodnight", custom: false }
];

let tasks = loadTasks();
let totalSeconds = DEFAULT_MINUTES * 60;
let remainingSeconds = totalSeconds;
let timerId = null;
let audioEnabled = true;
let voiceEnabled = true;
let zoomInterval = null;
let audioContext = null;
let parentMode = false;
let parentDrag = null;
let stickerCount = Math.max(0, Number(localStorage.getItem("bedtimeRoutineStickerCount")) || 0);

if (localStorage.getItem("bedtimeRoutineNameVersion") !== NAME_STORAGE_VERSION) {
  localStorage.setItem("bedtimeRoutineNameVersion", NAME_STORAGE_VERSION);
  localStorage.removeItem("bedtimeDashName");
}

const savedName = localStorage.getItem("bedtimeDashName");
const savedMinutes = Number(localStorage.getItem("bedtimeDashMinutes"));

if (localStorage.getItem("bedtimeDashVoiceVersion") !== VOICE_STORAGE_VERSION) {
  localStorage.setItem("bedtimeDashVoiceVersion", VOICE_STORAGE_VERSION);
  localStorage.removeItem("bedtimeDashVoice");
}

const savedVoice = localStorage.getItem("bedtimeDashVoice");

if (savedName) {
  childName.textContent = savedName;
}

if (savedVoice === "off") {
  voiceEnabled = false;
  voiceToggle.textContent = "Voice off";
  voiceToggle.setAttribute("aria-pressed", "false");
}

if (savedMinutes >= 1 && savedMinutes <= MAX_MINUTES) {
  totalSeconds = savedMinutes * 60;
  remainingSeconds = totalSeconds;
  durationInput.value = String(savedMinutes);
}

function loadTasks() {
  if (localStorage.getItem("bedtimeDashTaskVersion") !== TASK_STORAGE_VERSION) {
    localStorage.setItem("bedtimeDashTaskVersion", TASK_STORAGE_VERSION);
    localStorage.removeItem("bedtimeDashTasks");
  }

  try {
    const saved = JSON.parse(localStorage.getItem("bedtimeDashTasks"));
    if (Array.isArray(saved) && saved.length > 0) {
      return saved.map((task, index) => ({
        id: task.id || `task-${index}`,
        label: task.label || "Bedtime Task",
        scene: task.scene || "custom-task",
        custom: Boolean(task.custom),
        done: false
      }));
    }
  } catch {
    return defaultTasks.map((task) => ({ ...task, done: false }));
  }

  return defaultTasks.map((task) => ({ ...task, done: false }));
}

function saveTasks() {
  localStorage.setItem("bedtimeDashTaskVersion", TASK_STORAGE_VERSION);
  localStorage.setItem("bedtimeDashTasks", JSON.stringify(tasks));
}

function selectedMinutes() {
  return Math.max(1, Math.min(MAX_MINUTES, Number(durationInput.value) || DEFAULT_MINUTES));
}

function formatTime() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  minutesEl.textContent = String(minutes).padStart(2, "0");
  secondsEl.textContent = String(seconds).padStart(2, "0");
}

function updateProgress() {
  const elapsed = totalSeconds - remainingSeconds;
  const percent = Math.min(100, Math.max(0, (elapsed / totalSeconds) * 100));
  progressFill.style.width = `${percent}%`;
  runner.style.left = `${percent}%`;
  progressFill.style.background = progressColor(percent);
}

function mixColor(start, end, amount) {
  const mixed = start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function progressColor(percent) {
  if (percent <= 33.333) {
    return mixColor([99, 212, 113], [11, 125, 75], percent / 33.333);
  }

  if (percent <= 66.666) {
    return mixColor([245, 213, 71], [243, 155, 47], (percent - 33.333) / 33.333);
  }

  return mixColor([226, 59, 59], [143, 20, 20], (percent - 66.666) / 33.334);
}

function updateTimerLabel() {
  const minutes = Math.round(totalSeconds / 60);
  timerLabel.textContent = `${minutes} minute bedtime timer`;
}

function ensureAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playZoomSound() {
  if (!audioEnabled) return;

  const context = ensureAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const masterGain = context.createGain();
  masterGain.connect(context.destination);
  masterGain.gain.setValueAtTime(0.001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.22, now + 0.08);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

  const sweep = context.createOscillator();
  sweep.type = "sawtooth";
  sweep.frequency.setValueAtTime(190, now);
  sweep.frequency.exponentialRampToValueAtTime(980, now + 0.7);
  sweep.frequency.exponentialRampToValueAtTime(520, now + 1.35);
  sweep.connect(masterGain);
  sweep.start(now);
  sweep.stop(now + 1.5);

  const sparkle = context.createOscillator();
  sparkle.type = "sine";
  sparkle.frequency.setValueAtTime(1240, now + 0.22);
  sparkle.frequency.exponentialRampToValueAtTime(1760, now + 0.72);
  sparkle.connect(masterGain);
  sparkle.start(now + 0.2);
  sparkle.stop(now + 1.05);
}

function stopZoomSound() {
  clearInterval(zoomInterval);
  zoomInterval = null;
}

function stopVoice() {
  sceneAudio.pause();
  sceneAudio.currentTime = 0;
}

function playSceneAudio(scene) {
  if (!voiceEnabled) return;

  const audioFile = sceneAudioFiles[scene] || sceneAudioFiles["custom-task"];
  if (!audioFile) return;

  stopVoice();
  sceneAudio.src = audioFile;
  sceneAudio.currentTime = 0;
  sceneAudio.play().catch(() => {
    // Browsers may block audio before the first child/parent tap.
  });
}

function renderStickerChart() {
  stickerChart.innerHTML = "";
  const count = Math.min(stickerCount, 30);
  stickerChart.dataset.count = `${stickerCount} Stars`;

  for (let index = 0; index < count; index += 1) {
    const sticker = document.createElement("span");
    sticker.className = "sticker";
    sticker.textContent = "★";
    sticker.setAttribute("aria-hidden", "true");
    stickerChart.append(sticker);
  }

  stickerChart.classList.toggle("show", goodnightText.classList.contains("show"));
  stickerChart.setAttribute("aria-label", `${stickerCount} bedtime stickers earned`);
}

function awardBedtimeSticker() {
  stickerCount += 1;
  localStorage.setItem("bedtimeRoutineStickerCount", String(stickerCount));
  renderStickerChart();
}

function startFinishSound() {
  stopZoomSound();
  playZoomSound();
  if (audioEnabled) {
    zoomInterval = setInterval(playZoomSound, 2400);
    quiet.textContent = "Silence sound";
  }
}

function showScene(scene) {
  const actualScene = scene === "goodnight" ? "head-pillow" : scene;
  heroImages.forEach((image) => {
    image.classList.toggle("active", image.dataset.scene === actualScene);
  });
  goodnightText.classList.toggle("show", scene === "goodnight");
  stickerChart.classList.toggle("show", scene === "goodnight");
  sceneMessage.textContent = scene === "goodnight" ? "" : sceneMessages[actualScene] || "";
  sceneMessage.classList.toggle("prayer-message", actualScene === "prayer");
  renderStickerChart();
}

function currentTaskScene() {
  const latestDone = [...tasks].reverse().find((task) => task.done);
  return latestDone ? latestDone.scene : "start";
}

function reorderTask(draggedId, targetId, placeAfter) {
  if (!draggedId || draggedId === targetId) return;

  const draggedIndex = tasks.findIndex((task) => task.id === draggedId);
  const targetIndex = tasks.findIndex((task) => task.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return;

  const [draggedTask] = tasks.splice(draggedIndex, 1);
  const adjustedTargetIndex = tasks.findIndex((task) => task.id === targetId);
  tasks.splice(adjustedTargetIndex + (placeAfter ? 1 : 0), 0, draggedTask);
  saveTasks();
  renderTasks();
}

function moveTask(taskId, direction) {
  const index = tasks.findIndex((task) => task.id === taskId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= tasks.length) return;

  [tasks[index], tasks[targetIndex]] = [tasks[targetIndex], tasks[index]];
  saveTasks();
  renderTasks();
}

function renderTasks() {
  taskStrip.innerHTML = "";

  tasks.forEach((task) => {
    const item = document.createElement("div");
    item.className = "task-item";
    item.dataset.id = task.id;

    const button = document.createElement("button");
    button.className = "step-card";
    button.type = "button";
    button.setAttribute("aria-pressed", String(Boolean(task.done)));
    button.dataset.id = task.id;

    const orb = document.createElement("span");
    orb.className = "step-orb";
    orb.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "step-label";
    label.textContent = task.label;
    label.spellcheck = false;
    label.contentEditable = parentMode ? "true" : "false";

    label.addEventListener("click", (event) => {
      if (parentMode) {
        event.stopPropagation();
      }
    });

    label.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        label.blur();
      }
    });

    label.addEventListener("blur", () => {
      task.label = label.textContent.trim() || "Bedtime Task";
      label.textContent = task.label;
      saveTasks();
      button.setAttribute("aria-label", task.label);
    });

    const moveControls = document.createElement("div");
    moveControls.className = "move-controls";

    const moveLeft = document.createElement("button");
    moveLeft.className = "move-task";
    moveLeft.type = "button";
    moveLeft.textContent = "←";
    moveLeft.disabled = tasks.indexOf(task) === 0;
    moveLeft.setAttribute("aria-label", `Move ${task.label} left`);
    moveLeft.addEventListener("click", (event) => {
      event.stopPropagation();
      moveTask(task.id, -1);
    });

    const moveRight = document.createElement("button");
    moveRight.className = "move-task";
    moveRight.type = "button";
    moveRight.textContent = "→";
    moveRight.disabled = tasks.indexOf(task) === tasks.length - 1;
    moveRight.setAttribute("aria-label", `Move ${task.label} right`);
    moveRight.addEventListener("click", (event) => {
      event.stopPropagation();
      moveTask(task.id, 1);
    });

    moveControls.append(moveLeft, moveRight);
    button.append(orb, label);
    button.setAttribute("aria-label", task.label);
    button.addEventListener("click", () => {
      if (parentMode) return;
      task.done = !task.done;
      showScene(task.done ? task.scene : currentTaskScene());
      if (task.done) {
        playSceneAudio(task.custom ? "custom-task" : task.id);
        if (task.scene === "goodnight") {
          awardBedtimeSticker();
        }
      }
      updateChecklistStatus();
      saveTasks();
      renderTasks();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-task";
    deleteButton.type = "button";
    deleteButton.textContent = "x";
    deleteButton.setAttribute("aria-label", `Delete ${task.label}`);
    deleteButton.addEventListener("click", () => {
      tasks = tasks.filter((candidate) => candidate.id !== task.id);
      saveTasks();
      updateChecklistStatus();
      renderTasks();
    });

    item.append(moveControls, button, deleteButton);
    taskStrip.append(item);
  });

  addTask.disabled = tasks.filter((task) => task.custom).length >= MAX_EXTRA_TASKS;
}

function updateChecklistStatus() {
  statusText.textContent = "";
}

function renderTimer() {
  formatTime();
  updateProgress();
  updateTimerLabel();
}

function finish() {
  clearInterval(timerId);
  timerId = null;
  remainingSeconds = 0;
  startPause.textContent = "START";
  pauseResume.textContent = "Resume";
  statusText.textContent = "";
  renderTimer();
  startFinishSound();
}

function tick() {
  remainingSeconds -= 1;
  if (remainingSeconds <= 0) {
    finish();
    return;
  }
  renderTimer();
}

function startTimer() {
  ensureAudioContext();

  if (remainingSeconds <= 0) {
    stopZoomSound();
    remainingSeconds = totalSeconds;
  }

  startPause.textContent = "START";
  pauseResume.textContent = "Pause";
  statusText.textContent = "";
  clearInterval(timerId);
  timerId = setInterval(tick, 1000);
}

function pauseTimer() {
  clearInterval(timerId);
  timerId = null;
  pauseResume.textContent = "Resume";
  statusText.textContent = "Paused.";
}

function resetTimer() {
  clearInterval(timerId);
  stopZoomSound();
  stopVoice();
  timerId = null;
  totalSeconds = selectedMinutes() * 60;
  remainingSeconds = totalSeconds;
  startPause.textContent = "START";
  pauseResume.textContent = "Pause";
  statusText.textContent = "";
  tasks = tasks.map((task) => ({ ...task, done: false }));
  showScene("start");
  localStorage.setItem("bedtimeDashMinutes", String(selectedMinutes()));
  saveTasks();
  renderTimer();
  renderTasks();
}

function clampParentControls(left, top) {
  const controlsRect = parentControls.getBoundingClientRect();
  const maxLeft = window.innerWidth - controlsRect.width - 8;
  const maxTop = window.innerHeight - controlsRect.height - 8;

  return {
    left: Math.max(8, Math.min(left, maxLeft)),
    top: Math.max(8, Math.min(top, maxTop))
  };
}

function moveParentControls(left, top) {
  const position = clampParentControls(left, top);
  parentControls.style.left = `${position.left}px`;
  parentControls.style.top = `${position.top}px`;
  parentControls.style.right = "auto";
  parentControls.style.bottom = "auto";
  localStorage.setItem("bedtimeDashParentControls", JSON.stringify(position));
}

function restoreParentControlsPosition() {
  try {
    const savedPosition = JSON.parse(localStorage.getItem("bedtimeDashParentControls"));
    if (savedPosition && Number.isFinite(savedPosition.left) && Number.isFinite(savedPosition.top)) {
      moveParentControls(savedPosition.left, savedPosition.top);
    }
  } catch {
    localStorage.removeItem("bedtimeDashParentControls");
  }
}

function startParentDrag(event) {
  if (event.target.closest("button, input")) return;

  const menuRect = parentMenu.getBoundingClientRect();
  if (event.clientY > menuRect.top + 34) return;

  const controlsRect = parentControls.getBoundingClientRect();
  parentDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - controlsRect.left,
    offsetY: event.clientY - controlsRect.top
  };
  parentMenu.classList.add("dragging");
  parentMenu.setPointerCapture(event.pointerId);
}

function dragParentControls(event) {
  if (!parentDrag || event.pointerId !== parentDrag.pointerId) return;
  event.preventDefault();
  moveParentControls(event.clientX - parentDrag.offsetX, event.clientY - parentDrag.offsetY);
}

function stopParentDrag(event) {
  if (!parentDrag || event.pointerId !== parentDrag.pointerId) return;
  parentDrag = null;
  parentMenu.classList.remove("dragging");
}

startPause.addEventListener("click", startTimer);

pauseResume.addEventListener("click", () => {
  if (timerId) {
    pauseTimer();
  } else {
    startTimer();
  }
});

reset.addEventListener("click", resetTimer);

quiet.addEventListener("click", () => {
  if (zoomInterval) {
    stopZoomSound();
    quiet.textContent = audioEnabled ? "Sound on" : "Sound off";
    return;
  }

  audioEnabled = !audioEnabled;
  quiet.textContent = audioEnabled ? "Sound on" : "Sound off";
  quiet.setAttribute("aria-pressed", String(audioEnabled));
});

voiceToggle.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  voiceToggle.textContent = voiceEnabled ? "Voice on" : "Voice off";
  voiceToggle.setAttribute("aria-pressed", String(voiceEnabled));
  localStorage.setItem("bedtimeDashVoice", voiceEnabled ? "on" : "off");

  if (!voiceEnabled) {
    stopVoice();
  } else {
    const activeScene = goodnightText.classList.contains("show")
      ? "goodnight"
      : document.querySelector(".hero-image.active")?.dataset.scene || "start";
    playSceneAudio(activeScene);
  }
});

addTask.addEventListener("click", () => {
  const extraCount = tasks.filter((task) => task.custom).length;
  if (extraCount >= MAX_EXTRA_TASKS) return;

  const task = {
    id: `custom-${Date.now()}`,
    label: "New Task",
    scene: "custom-task",
    custom: true,
    done: false
  };

  const finalIndex = tasks.findIndex((candidate) => candidate.scene === "goodnight");
  if (finalIndex >= 0) {
    tasks.splice(finalIndex, 0, task);
  } else {
    tasks.push(task);
  }

  saveTasks();
  renderTasks();
});

durationInput.addEventListener("change", resetTimer);
durationInput.addEventListener("input", () => {
  durationInput.value = String(selectedMinutes());
});

parentToggle.addEventListener("click", () => {
  parentMode = parentMenu.hidden;
  parentMenu.hidden = !parentMode;
  parentToggle.setAttribute("aria-expanded", String(parentMode));
  document.body.classList.toggle("parent-mode", parentMode);
  renderTasks();
});

parentClose.addEventListener("click", () => {
  parentMode = false;
  parentMenu.hidden = true;
  parentToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("parent-mode");
  renderTasks();
});

parentMenu.addEventListener("pointerdown", startParentDrag);
parentMenu.addEventListener("pointermove", dragParentControls);
parentMenu.addEventListener("pointerup", stopParentDrag);
parentMenu.addEventListener("pointercancel", stopParentDrag);

window.addEventListener("resize", () => {
  if (parentControls.style.left && parentControls.style.top) {
    moveParentControls(parseFloat(parentControls.style.left), parseFloat(parentControls.style.top));
  }
});

childName.addEventListener("blur", () => {
  const name = childName.textContent.trim() || DEFAULT_CHILD_NAME;
  childName.textContent = name;
  localStorage.setItem("bedtimeDashName", name);
});

childName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    childName.blur();
  }
});

renderTimer();
renderTasks();
showScene("start");
updateChecklistStatus();
renderStickerChart();
restoreParentControlsPosition();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Bedtime Routine could not enable offline mode.", error);
    });
  });
}
