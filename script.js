"use strict";

// Turn this on while developing to show targets, drop zones and state controls.
const DEBUG_MODE = false;

const IMAGE_PATH = "assets/images/";

const fruits = [
  { id: "apple", name: "Apple", wholeImage: `${IMAGE_PATH}apple.png`, cutImage: `${IMAGE_PATH}apple-cut.png`, pieceImage: `${IMAGE_PATH}apple-piece.png` },
  { id: "banana", name: "Banana", wholeImage: `${IMAGE_PATH}banana.png`, cutImage: `${IMAGE_PATH}banana-cut.png`, pieceImage: `${IMAGE_PATH}banana-piece.png` },
  { id: "grapes", name: "Grapes", wholeImage: `${IMAGE_PATH}grapes.png`, cutImage: `${IMAGE_PATH}grapes-cut.png`, pieceImage: `${IMAGE_PATH}grapes-piece.png` },
  { id: "mango", name: "Mango", wholeImage: `${IMAGE_PATH}mango.png`, cutImage: `${IMAGE_PATH}mango-cut.png`, pieceImage: `${IMAGE_PATH}mango-piece.png` },
  { id: "kiwi", name: "Kiwi", wholeImage: `${IMAGE_PATH}kiwi.png`, cutImage: `${IMAGE_PATH}kiwi-piece.png`, pieceImage: `${IMAGE_PATH}kiwi-cut.png` },
  { id: "strawberry", name: "Strawberry", wholeImage: `${IMAGE_PATH}strawberry.png`, cutImage: `${IMAGE_PATH}strawberry-cut.png`, pieceImage: `${IMAGE_PATH}strawberry-piece.png` },
  { id: "blueberry", name: "Blueberry", wholeImage: `${IMAGE_PATH}blueberry.png`, cutImage: `${IMAGE_PATH}blueberry-cut.png`, pieceImage: `${IMAGE_PATH}blueberry-piece.png` }
];

const fruitById = Object.fromEntries(fruits.map((fruit) => [fruit.id, fruit]));

const plantConfigs = {
  apple: {
    image: `${IMAGE_PATH}apple-tree.png`, left: 1, top: 15, width: 25, height: 48, fruitSize: 15,
    spots: [[18,18],[38,10],[58,20],[72,34],[28,38],[51,43]]
  },
  banana: {
    image: `${IMAGE_PATH}banana-tree.png`, left: 3, top: 48, width: 22, height: 43, fruitSize: 19,
    spots: [[36,45],[48,49],[29,55],[43,59],[56,56]]
  },
  grapes: {
    image: `${IMAGE_PATH}grape-vine.png`, left: 26, top: 27, width: 25, height: 34, fruitSize: 16,
    spots: [[18,37],[35,44],[51,34],[65,47],[76,35]]
  },
  mango: {
    image: `${IMAGE_PATH}mango-tree.png`, left: 54, top: 15, width: 24, height: 49, fruitSize: 14,
    spots: [[27,22],[47,14],[65,25],[37,38],[58,42],[73,36]]
  },
  kiwi: {
    image: `${IMAGE_PATH}kiwi-vine.png`, left: 76, top: 29, width: 23, height: 34, fruitSize: 15,
    spots: [[16,40],[31,48],[47,37],[61,49],[76,39]]
  },
  strawberry: {
    image: `${IMAGE_PATH}strawberry-bush.png`, left: 25, top: 68, width: 25, height: 21, fruitSize: 15,
    spots: [[13,42],[29,31],[45,48],[61,27],[76,43],[52,62]]
  },
  blueberry: {
    image: `${IMAGE_PATH}blueberry-bush.png`, left: 56, top: 67, width: 24, height: 22, fruitSize: 14,
    spots: [[15,42],[30,27],[42,50],[55,31],[67,51],[78,35]]
  }
};

const plateSlots = [
  [18,25],[38,17],[58,26],[28,45],[49,42],[67,48],[43,60]
];

const completedPlateSlots = [
  [18,27],[38,18],[58,28],[27,48],[49,44],[66,51],[43,64]
];

const yogurtPlateSlots = [
  [18,23],[39,16],[59,24],[27,43],[49,39],[67,47],[43,59]
];

// Safe center positions inside the supplied layered basket artwork.
// Values are percentages of the basket container, not the browser window.
const basketFruitSlots = [
  { left: 35, top: 48, rotation: -8 },
  { left: 43, top: 43, rotation: 5 },
  { left: 51, top: 48, rotation: -3 },
  { left: 59, top: 43, rotation: 7 },
  { left: 67, top: 48, rotation: -6 },
  { left: 46, top: 56, rotation: 4 },
  { left: 57, top: 56, rotation: -4 }
];

const gameState = {
  currentRound: 0,
  mode: "story",
  soundEnabled: true,
  hasStarted: false,
  interactionLocked: false,
  garden: {
    fruitOrder: [],
    currentTargetIndex: 0,
    collected: []
  },
  cutting: {
    order: [],
    currentFruitIndex: 0,
    currentStep: "drag-fruit",
    completed: []
  },
  yogurt: {
    yogurtAdded: false,
    addedFruits: [],
    isMixing: false,
    completed: false
  }
};

const elements = {};
let toastTimer = 0;
let activeKnifeDragContext = null;
let yogurtMixToken = 0;

class AudioManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicPlaying = false;
    this.musicDucked = false;
  }

  ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.effectsGain = this.context.createGain();
      this.musicGain.gain.value = 0.12;
      this.effectsGain.gain.value = 0.35;
      this.masterGain.gain.value = gameState.soundEnabled ? 1 : 0;
      this.musicGain.connect(this.masterGain);
      this.effectsGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return true;
  }

  setEnabled(enabled) {
    gameState.soundEnabled = enabled;
    if (this.ensureContext()) {
      this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
      this.masterGain.gain.setTargetAtTime(enabled ? 1 : 0, this.context.currentTime, 0.03);
    }
    if (!enabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  startMusic() {
    if (!this.ensureContext() || this.musicPlaying) return;
    this.musicPlaying = true;
    this.musicStep = 0;
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 698.46, 523.25, 659.25, 880, 783.99, 659.25, 587.33, 523.25, 0];
    const playStep = () => {
      if (!this.musicPlaying || !this.context) return;
      const frequency = melody[this.musicStep % melody.length];
      this.musicStep += 1;
      if (frequency) this.playNote(frequency, 0.24, "triangle", this.musicGain, 0.055);
    };
    playStep();
    this.musicTimer = window.setInterval(playStep, 360);
  }

  playNote(frequency, duration, type = "sine", destination = this.effectsGain, volume = 0.14, delay = 0) {
    if (!this.ensureContext() || !destination) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.04);
  }

  effect(name) {
    if (!gameState.soundEnabled || !this.ensureContext()) return;
    const sequences = {
      click: [[620,.08,"sine",0],[800,.08,"sine",.06]],
      correct: [[660,.12,"triangle",0],[880,.14,"triangle",.1],[1046,.2,"triangle",.2]],
      wrong: [[310,.13,"sine",0],[250,.18,"sine",.12]],
      drop: [[480,.09,"triangle",0],[620,.13,"triangle",.07]],
      cut: [[800,.06,"sawtooth",0],[540,.07,"triangle",.1],[820,.06,"sawtooth",.2]],
      mix: [[440,.15,"triangle",0],[554,.15,"triangle",.15],[659,.18,"triangle",.3]],
      roundComplete: [[523,.13,"triangle",0],[659,.13,"triangle",.12],[784,.13,"triangle",.24],[1046,.35,"triangle",.36]],
      gameComplete: [[523,.13,"triangle",0],[659,.13,"triangle",.1],[784,.13,"triangle",.2],[988,.16,"triangle",.3],[1174,.4,"triangle",.44]]
    };
    (sequences[name] || sequences.click).forEach(([freq,duration,type,delay]) => {
      this.playNote(freq, duration, type, this.effectsGain, 0.12, delay);
    });
  }

  duckMusic(ducked) {
    if (!this.context || !this.musicGain) return;
    this.musicDucked = ducked;
    this.musicGain.gain.setTargetAtTime(ducked ? 0.025 : 0.12, this.context.currentTime, 0.05);
  }

  speakFruit(fruit) {
    if (!gameState.soundEnabled) return;
    if (!("speechSynthesis" in window)) {
      this.effect("click");
      return;
    }
    window.speechSynthesis.cancel();
    this.duckMusic(true);
    const utterance = new SpeechSynthesisUtterance(fruit.name);
    utterance.lang = "en-US";
    utterance.rate = 0.76;
    utterance.pitch = 1.08;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) => /^en-(US|GB)/i.test(voice.lang)) || voices.find((voice) => /^en/i.test(voice.lang));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => this.duckMusic(false);
    utterance.onerror = () => this.duckMusic(false);
    window.speechSynthesis.speak(utterance);
  }
}

class PointerDragManager {
  constructor(stage) {
    this.stage = stage;
    this.boundElements = new WeakSet();
  }

  register(element, config) {
    if (!element || this.boundElements.has(element)) return;
    this.boundElements.add(element);
    element.addEventListener("pointerdown", (event) => this.startDrag(event, element, config));
  }

  startDrag(event, element, config) {
    if (event.button !== undefined && event.button !== 0) return;
    if (config.canDrag && !config.canDrag(element)) {
      if (config.onBlocked) config.onBlocked(element);
      return;
    }

    event.preventDefault();
    audio.effect("click");

    const stageRect = this.stage.getBoundingClientRect();
    const startRect = element.getBoundingClientRect();
    const originalParent = element.parentNode;
    const originalNextSibling = element.nextSibling;
    const originalStyle = element.getAttribute("style") || "";
    const originalClass = element.className;
    const grabOffsetX = event.clientX - startRect.left;
    const grabOffsetY = event.clientY - startRect.top;

    this.stage.appendChild(element);
    Object.assign(element.style, {
      position: "absolute",
      left: `${startRect.left - stageRect.left}px`,
      top: `${startRect.top - stageRect.top}px`,
      width: `${startRect.width}px`,
      height: `${startRect.height}px`,
      transform: "none"
    });
    element.classList.add("dragging");
    element.setPointerCapture?.(event.pointerId);

    let finished = false;

    const restore = (animate = true) => {
      if (finished) return;
      finished = true;
      const finishRestore = () => {
        element.className = originalClass;
        if (originalStyle) element.setAttribute("style", originalStyle);
        else element.removeAttribute("style");
        if (originalNextSibling && originalNextSibling.parentNode === originalParent) originalParent.insertBefore(element, originalNextSibling);
        else originalParent.appendChild(element);
      };
      if (!animate) {
        finishRestore();
        return;
      }
      element.classList.remove("dragging");
      element.classList.add("returning");
      element.style.left = `${startRect.left - stageRect.left}px`;
      element.style.top = `${startRect.top - stageRect.top}px`;
      window.setTimeout(finishRestore, 250);
    };

    const complete = () => {
      if (finished) return;
      finished = true;
      element.classList.remove("dragging", "returning");
    };

    const dragContext = { restore, complete, startRect, stageRect, originalParent, originalStyle, originalClass };

    const move = (moveEvent) => {
      if (finished) return;
      moveEvent.preventDefault();
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const x = Math.max(0, Math.min(stageRect.width - width, moveEvent.clientX - stageRect.left - grabOffsetX));
      const y = Math.max(0, Math.min(stageRect.height - height, moveEvent.clientY - stageRect.top - grabOffsetY));
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      if (config.onMove) config.onMove(element, moveEvent, dragContext);
    };

    const end = (endEvent) => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", cancel);
      try { element.releasePointerCapture?.(event.pointerId); } catch (_) {}
      if (finished) return;

      const target = config.getDropTarget ? config.getDropTarget(element) : null;
      const valid = target && isDroppedOn(element, target);
      if (valid && config.onValidDrop) {
        const accepted = config.onValidDrop(element, target, dragContext, endEvent);
        if (accepted !== false) return;
      }
      if (config.onInvalidDrop) config.onInvalidDrop(element, dragContext);
      audio.effect("wrong");
      restore(true);
    };

    const cancel = () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", cancel);
      restore(true);
    };

    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", cancel);
  }
}

const audio = new AudioManager();
let dragManager;

function cacheElements() {
  [
    "game-stage", "round-title", "global-progress", "sound-toggle", "sound-icon",
    "start-scene", "garden-scene", "cutting-scene", "yogurt-scene", "start-button",
    "floating-fruits", "garden-plants", "garden-instruction", "replay-audio", "garden-done-button", "basket-zone", "basket-items",
    "cutting-instruction", "cutting-done-button", "whole-fruits-layer", "cutting-board-zone", "board-fruit-layer", "cut-plate-zone", "cut-fruits-layer", "knife", "cut-sparkles",
    "yogurt-instruction", "yogurt-container-zone", "yogurt-container", "mixing-bowl-zone", "bowl-base", "bowl-content-clip", "bowl-yogurt-surface", "bowl-inner", "bowl-front-rim", "mixing-spoon",
    "yogurt-fruit-plate-zone", "yogurt-fruits-layer", "yogurt-controls", "mix-button", "clear-bowl-button",
    "completion-controls", "reset-game-button", "free-play-button", "mix-again-button", "clear-final-button", "play-full-game-button",
    "celebration-layer", "toast", "debug-panel", "debug-state", "debug-next"
  ].forEach((id) => { elements[toCamelCase(id)] = document.getElementById(id); });
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function initializeGame() {
  cacheElements();
  dragManager = new PointerDragManager(elements.gameStage);
  bindGlobalEvents();
  installImageFallbacks();
  preloadAssets();
  renderFloatingFruits();
  resetState();
  switchScene("start");

  dragManager.register(elements.knife, {
    canDrag: () => gameState.currentRound === 2 && gameState.cutting.currentStep === "drag-knife" && !gameState.interactionLocked,
    onBlocked: () => friendlyBlockedFeedback("Put the fruit on the board first."),
    getDropTarget: () => elements.cuttingBoardZone,
    onValidDrop: handleKnifeDrop
  });

  dragManager.register(elements.yogurtContainer, {
    canDrag: () => gameState.currentRound === 3 && !gameState.yogurt.yogurtAdded && !gameState.yogurt.isMixing,
    getDropTarget: () => elements.mixingBowlZone,
    onValidDrop: handleYogurtDrop
  });

  if (DEBUG_MODE) enableDebugMode();
}

function bindGlobalEvents() {
  elements.startButton.addEventListener("click", () => {
    gameState.hasStarted = true;
    audio.ensureContext();
    audio.startMusic();
    audio.effect("click");
    startGardenRound();
  });

  elements.soundToggle.addEventListener("click", () => {
    const enabled = !gameState.soundEnabled;
    audio.setEnabled(enabled);
    elements.soundIcon.textContent = enabled ? "🔊" : "🔇";
    elements.soundToggle.setAttribute("aria-label", enabled ? "Turn sound off" : "Turn sound on");
    elements.soundToggle.setAttribute("aria-pressed", String(!enabled));
    if (enabled && gameState.hasStarted) audio.startMusic();
  });

  elements.replayAudio.addEventListener("click", playCurrentFruitAudio);
  elements.gardenDoneButton.addEventListener("click", () => { audio.effect("click"); startCuttingRound(); });
  elements.cuttingDoneButton.addEventListener("click", () => { audio.effect("click"); startYogurtRound("story"); });
  elements.mixButton.addEventListener("click", startMixingAnimation);
  elements.clearBowlButton.addEventListener("click", () => startYogurtRound("free"));
  elements.resetGameButton.addEventListener("click", resetGame);
  elements.freePlayButton.addEventListener("click", () => startYogurtRound("free"));
  elements.mixAgainButton.addEventListener("click", remixCurrentBowl);
  elements.clearFinalButton.addEventListener("click", () => startYogurtRound("free"));
  elements.playFullGameButton.addEventListener("click", resetGame);

  document.addEventListener("contextmenu", (event) => {
    if (elements.gameStage.contains(event.target)) event.preventDefault();
  });
}

function resetState() {
  gameState.currentRound = 0;
  gameState.mode = "story";
  gameState.interactionLocked = false;
  gameState.garden = { fruitOrder: [], currentTargetIndex: 0, collected: [] };
  gameState.cutting = { order: [], currentFruitIndex: 0, currentStep: "drag-fruit", completed: [] };
  gameState.yogurt = { yogurtAdded: false, addedFruits: [], isMixing: false, completed: false, piecePositions: [] };
  clearCelebration();
  updateHeader("Fruit Yogurt Cooking Game", "Ready to play!");
  updateDebug();
}

function switchScene(sceneName) {
  const map = {
    start: elements.startScene,
    garden: elements.gardenScene,
    cutting: elements.cuttingScene,
    yogurt: elements.yogurtScene
  };
  Object.values(map).forEach((scene) => scene.classList.remove("active"));
  map[sceneName]?.classList.add("active");
}

function startGardenRound() {
  clearCelebration();
  gameState.currentRound = 1;
  gameState.mode = "story";
  gameState.interactionLocked = false;
  gameState.garden.fruitOrder = shuffle(fruits.map((fruit) => fruit.id));
  gameState.garden.currentTargetIndex = 0;
  gameState.garden.collected = [];
  elements.basketItems.innerHTML = "";
  elements.replayAudio.classList.remove("hidden");
  elements.gardenDoneButton.classList.add("hidden");
  renderGardenPlants();
  switchScene("garden");
  updateHeader("Round 1 • Pick Fruits", "Fruits collected: 0 / 7");
  updateGardenInstruction();
  updateDebug();
  window.setTimeout(playCurrentFruitAudio, 650);
}

function renderGardenPlants() {
  elements.gardenPlants.innerHTML = "";
  fruits.forEach((fruit, fruitIndex) => {
    const config = plantConfigs[fruit.id];
    const plant = document.createElement("div");
    plant.className = `plant plant-${fruit.id}`;
    Object.assign(plant.style, {
      left: `${config.left}%`, top: `${config.top}%`, width: `${config.width}%`, height: `${config.height}%`
    });

    const plantImage = createGameImage(config.image, `${fruit.name} plant`, fruit.name);
    plantImage.className = "plant-base";
    plant.appendChild(plantImage);

    config.spots.forEach(([left, top], index) => {
      const fruitImage = createGameImage(fruit.wholeImage, `${fruit.name} on the plant`, fruit.name);
      fruitImage.className = "garden-fruit";
      fruitImage.dataset.fruitId = fruit.id;
      fruitImage.dataset.instance = String(index);
      fruitImage.setAttribute("role", "button");
      fruitImage.setAttribute("tabindex", "0");
      fruitImage.style.setProperty("--fruit-size", `${config.fruitSize}%`);
      fruitImage.style.left = `${left}%`;
      fruitImage.style.top = `${top}%`;
      fruitImage.style.animationDelay = `${(fruitIndex * .17 + index * .12).toFixed(2)}s`;
      fruitImage.addEventListener("click", () => handleGardenFruitClick(fruitImage));
      fruitImage.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleGardenFruitClick(fruitImage);
        }
      });
      plant.appendChild(fruitImage);
    });
    elements.gardenPlants.appendChild(plant);
  });
}

function updateGardenInstruction() {
  if (DEBUG_MODE) {
    const target = getCurrentGardenFruit();
    elements.gardenInstruction.textContent = target ? `Listen and pick the correct fruit! [Target: ${target.name}]` : "All fruits collected!";
  } else {
    elements.gardenInstruction.textContent = "Listen and pick the correct fruit!";
  }
}

function getCurrentGardenFruit() {
  const id = gameState.garden.fruitOrder[gameState.garden.currentTargetIndex];
  return fruitById[id] || null;
}

function playCurrentFruitAudio() {
  if (gameState.currentRound !== 1 || gameState.interactionLocked) return;
  const currentFruit = getCurrentGardenFruit();
  if (currentFruit) {
    audio.effect("click");
    audio.speakFruit(currentFruit);
  }
}

async function handleGardenFruitClick(fruitElement) {
  if (gameState.currentRound !== 1 || gameState.interactionLocked) return;
  const selectedId = fruitElement.dataset.fruitId;
  const targetFruit = getCurrentGardenFruit();
  if (!targetFruit) return;

  if (selectedId !== targetFruit.id) {
    audio.effect("wrong");
    fruitElement.classList.remove("shake");
    void fruitElement.offsetWidth;
    fruitElement.classList.add("shake");
    showToast("Nice try! Listen and try again.");
    return;
  }

  gameState.interactionLocked = true;
  audio.effect("correct");
  fruitElement.classList.add("picked-fruit");

  const basketFruit = addFruitToBasket(targetFruit, gameState.garden.collected.length, true);
  await animateFruitToBasket(fruitElement, targetFruit, basketFruit);
  basketFruit.classList.remove("pending");
  basketFruit.classList.add("arrived");

  gameState.garden.collected.push(targetFruit.id);
  document.querySelectorAll(`.garden-fruit[data-fruit-id="${targetFruit.id}"]`).forEach((item) => item.classList.add("type-complete"));
  audio.effect("drop");
  updateHeader("Round 1 • Pick Fruits", `Fruits collected: ${gameState.garden.collected.length} / 7`);
  gameState.garden.currentTargetIndex += 1;
  updateDebug();

  if (gameState.garden.collected.length === fruits.length) {
    window.setTimeout(completeGardenRound, 500);
    return;
  }

  window.setTimeout(() => {
    gameState.interactionLocked = false;
    updateGardenInstruction();
    playCurrentFruitAudio();
  }, 700);
}

function animateFruitToBasket(sourceElement, fruit, destinationElement) {
  return new Promise((resolve) => {
    const stageRect = elements.gameStage.getBoundingClientRect();
    const sourceRect = sourceElement.getBoundingClientRect();
    const destinationRect = destinationElement.getBoundingClientRect();

    const clone = createGameImage(fruit.wholeImage, "", fruit.name);
    clone.className = "flying-fruit";
    Object.assign(clone.style, {
      left: `${sourceRect.left - stageRect.left}px`,
      top: `${sourceRect.top - stageRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`
    });
    elements.gameStage.appendChild(clone);
    sourceElement.style.visibility = "hidden";

    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;
    const destinationCenterX = destinationRect.left + destinationRect.width / 2;
    const destinationCenterY = destinationRect.top + destinationRect.height / 2;
    const dx = destinationCenterX - sourceCenterX;
    const dy = destinationCenterY - sourceCenterY;
    const finalScale = Math.max(.18, Math.min(1,
      Math.min(destinationRect.width / Math.max(sourceRect.width, 1), destinationRect.height / Math.max(sourceRect.height, 1))
    ));

    const animation = clone.animate([
      { transform: "translate(0,0) rotate(0deg) scale(1)", offset: 0 },
      { transform: `translate(${dx * .48}px, ${dy * .30 - 64}px) rotate(150deg) scale(1.08)`, offset: .48 },
      { transform: `translate(${dx}px, ${dy}px) rotate(330deg) scale(${finalScale})`, offset: 1 }
    ], { duration: 820, easing: "cubic-bezier(.25,.75,.28,1)", fill: "forwards" });

    animation.onfinish = () => { clone.remove(); resolve(); };
    animation.oncancel = () => { clone.remove(); resolve(); };
  });
}

function addFruitToBasket(fruit, index, pending = false) {
  const mini = createGameImage(fruit.wholeImage, "", fruit.name);
  mini.className = `basket-mini-fruit${pending ? " pending" : ""}`;
  mini.dataset.fruitId = fruit.id;
  const slot = basketFruitSlots[index] || basketFruitSlots[0];
  mini.style.left = `${slot.left}%`;
  mini.style.top = `${slot.top}%`;
  mini.style.setProperty("--basket-rotation", `${slot.rotation}deg`);
  elements.basketItems.appendChild(mini);
  return mini;
}

function completeGardenRound() {
  gameState.interactionLocked = true;
  audio.effect("roundComplete");
  elements.gardenInstruction.textContent = "Great job! You collected all the fruits!";
  elements.replayAudio.classList.add("hidden");
  elements.gardenDoneButton.classList.remove("hidden");
  elements.gardenDoneButton.focus();
  celebrate(18);
  updateDebug();
}

function startCuttingRound() {
  clearCelebration();
  gameState.currentRound = 2;
  gameState.interactionLocked = false;
  gameState.cutting.order = gameState.garden.collected.length === fruits.length
    ? [...gameState.garden.collected]
    : shuffle(fruits.map((fruit) => fruit.id));
  gameState.cutting.currentFruitIndex = 0;
  gameState.cutting.currentStep = "drag-fruit";
  gameState.cutting.completed = [];
  elements.boardFruitLayer.innerHTML = "";
  elements.cutFruitsLayer.innerHTML = "";
  elements.cutSparkles.innerHTML = "";
  elements.cuttingDoneButton.classList.add("hidden");
  resetKnifeVisual();
  renderWholeFruitPlate();
  switchScene("cutting");
  updateHeader("Round 2 • Cut Fruits", "Fruits cut: 0 / 7");
  loadNextFruitToCut();
  updateDebug();
}

function renderWholeFruitPlate() {
  elements.wholeFruitsLayer.innerHTML = "";
  gameState.cutting.order.forEach((id, index) => {
    const fruit = fruitById[id];
    const image = createGameImage(fruit.wholeImage, `Whole ${fruit.name}`, fruit.name);
    image.className = "plate-fruit draggable";
    image.dataset.fruitId = id;
    const [slotLeft, slotTop] = plateSlots[index];
    image.style.left = `${id === "kiwi" ? slotLeft - 5 : slotLeft}%`;
    image.style.top = `${id === "kiwi" ? slotTop - 5.5 : slotTop}%`;
    elements.wholeFruitsLayer.appendChild(image);

    dragManager.register(image, {
      canDrag: (element) => {
        const currentId = gameState.cutting.order[gameState.cutting.currentFruitIndex];
        if (gameState.currentRound !== 2 || gameState.interactionLocked || element.dataset.fruitId !== currentId) return false;
        return gameState.cutting.currentStep === "drag-fruit" || gameState.cutting.currentStep === "drag-cut-fruit";
      },
      onBlocked: () => friendlyBlockedFeedback("Follow the instruction at the top."),
      getDropTarget: () => gameState.cutting.currentStep === "drag-fruit" ? elements.cuttingBoardZone : elements.cutPlateZone,
      onValidDrop: (element, target, context) => {
        if (gameState.cutting.currentStep === "drag-fruit") return handleWholeFruitDrop(element, target, context);
        if (gameState.cutting.currentStep === "drag-cut-fruit") return handleCutFruitDrop(element, target, context);
        return false;
      }
    });
  });
}

function loadNextFruitToCut() {
  const id = gameState.cutting.order[gameState.cutting.currentFruitIndex];
  elements.wholeFruitsLayer.querySelectorAll(".plate-fruit").forEach((item) => {
    item.classList.toggle("current-fruit", item.dataset.fruitId === id);
  });
  elements.cuttingInstruction.textContent = "Drag the fruit to the cutting board.";
  elements.knife.classList.add("disabled");
  updateDebug();
}

function handleWholeFruitDrop(element, _target, dragContext) {
  if (gameState.cutting.currentStep !== "drag-fruit") return false;
  dragContext.complete();
  element.className = "board-fruit draggable";
  element.removeAttribute("style");
  elements.boardFruitLayer.appendChild(element);
  gameState.cutting.currentStep = "drag-knife";
  elements.knife.classList.remove("disabled");
  elements.cuttingInstruction.textContent = "Drag the knife to cut the fruit.";
  audio.effect("drop");
  updateDebug();
  return true;
}

function handleKnifeDrop(knife, _target, dragContext) {
  if (gameState.cutting.currentStep !== "drag-knife") return false;
  dragContext.complete();
  activeKnifeDragContext = dragContext;
  gameState.cutting.currentStep = "cutting-animation";
  gameState.interactionLocked = true;
  elements.cuttingInstruction.textContent = "Cutting… snip, snip!";

  const stageRect = elements.gameStage.getBoundingClientRect();
  const boardRect = elements.cuttingBoardZone.getBoundingClientRect();
  const knifeWidth = dragContext.startRect.width;
  const knifeHeight = dragContext.startRect.height;
  Object.assign(knife.style, {
    position: "absolute",
    left: `${boardRect.left - stageRect.left + boardRect.width * .56 - knifeWidth / 2}px`,
    top: `${boardRect.top - stageRect.top + boardRect.height * .10}px`,
    width: `${knifeWidth}px`,
    height: `${knifeHeight}px`
  });
  knife.classList.remove("dragging", "disabled");
  knife.classList.add("knife-cutting");
  createCutSparkles();
  audio.effect("cut");

  window.setTimeout(playCuttingAnimation, 1550);
  updateDebug();
  return true;
}

function playCuttingAnimation() {
  const id = gameState.cutting.order[gameState.cutting.currentFruitIndex];
  const fruit = fruitById[id];
  const boardFruit = elements.boardFruitLayer.querySelector(`[data-fruit-id="${id}"]`);
  if (!boardFruit || gameState.currentRound !== 2) return;

  boardFruit.src = fruit.cutImage;
  boardFruit.alt = `Cut ${fruit.name}`;
  boardFruit.classList.add("cut-ready", "is-cut");
  gameState.cutting.currentStep = "drag-cut-fruit";
  gameState.interactionLocked = false;
  elements.cuttingInstruction.textContent = "Drag the cut fruit to the plate.";
  resetKnifeVisual();
  audio.effect("correct");
  updateDebug();
}

function handleCutFruitDrop(element, _target, dragContext) {
  if (gameState.cutting.currentStep !== "drag-cut-fruit") return false;
  dragContext.complete();
  const id = element.dataset.fruitId;
  const slotIndex = gameState.cutting.completed.length;
  element.className = "plate-fruit is-cut";
  element.removeAttribute("style");
  const [slotLeft, slotTop] = completedPlateSlots[slotIndex];
  element.style.left = `${id === "kiwi" ? slotLeft - 5 : slotLeft}%`;
  element.style.top = `${id === "kiwi" ? slotTop - 5.5 : slotTop}%`;
  elements.cutFruitsLayer.appendChild(element);

  gameState.cutting.completed.push(id);
  gameState.cutting.currentFruitIndex += 1;
  audio.effect("correct");
  updateHeader("Round 2 • Cut Fruits", `Fruits cut: ${gameState.cutting.completed.length} / 7`);
  updateDebug();

  if (gameState.cutting.completed.length === fruits.length) {
    gameState.cutting.currentStep = "completed";
    window.setTimeout(completeCuttingRound, 500);
    return true;
  }

  gameState.cutting.currentStep = "drag-fruit";
  window.setTimeout(loadNextFruitToCut, 350);
  return true;
}

function createCutSparkles() {
  elements.cutSparkles.innerHTML = "";
  const effects = [[10,40,-45,-35],[35,15,-20,-55],[60,22,35,-50],[75,48,48,-20],[48,64,10,45],[20,65,-35,35]];
  effects.forEach(([left, top, dx, dy], index) => {
    const sparkle = document.createElement("span");
    sparkle.className = "cut-sparkle";
    sparkle.textContent = index % 2 ? "✦" : "★";
    sparkle.style.left = `${left}%`;
    sparkle.style.top = `${top}%`;
    sparkle.style.setProperty("--dx", `${dx}px`);
    sparkle.style.setProperty("--dy", `${dy}px`);
    sparkle.style.animationDelay = `${index * .08}s`;
    elements.cutSparkles.appendChild(sparkle);
  });
  window.setTimeout(() => { elements.cutSparkles.innerHTML = ""; }, 1250);
}

function resetKnifeVisual() {
  if (activeKnifeDragContext) {
    // The stored context has already been completed, so restore manually using original values.
    const context = activeKnifeDragContext;
    elements.knife.className = context.originalClass;
    if (context.originalStyle) elements.knife.setAttribute("style", context.originalStyle);
    else elements.knife.removeAttribute("style");
    context.originalParent.appendChild(elements.knife);
    activeKnifeDragContext = null;
  } else {
    elements.knife.className = "knife draggable disabled";
    elements.knife.removeAttribute("style");
  }
  elements.knife.classList.add("disabled");
}

function completeCuttingRound() {
  gameState.interactionLocked = true;
  audio.effect("roundComplete");
  elements.cuttingInstruction.textContent = "Wonderful! All the fruits are ready!";
  elements.cuttingDoneButton.classList.remove("hidden");
  elements.cuttingDoneButton.focus();
  celebrate(18);
  updateDebug();
}

function startYogurtRound(mode = "story") {
  yogurtMixToken += 1;
  clearCelebration();
  gameState.currentRound = 3;
  gameState.mode = mode;
  gameState.interactionLocked = false;
  gameState.yogurt = { yogurtAdded: false, addedFruits: [], isMixing: false, completed: false, piecePositions: [] };

  setBowlImage(`${IMAGE_PATH}bowl-empty.png`, "Empty mixing bowl");
  elements.bowlInner.innerHTML = "";
  elements.bowlYogurtSurface.classList.add("hidden");
  elements.bowlContentClip.classList.remove("hidden");
  elements.bowlInner.classList.remove("hidden");
  elements.mixingSpoon.classList.remove("hidden");
  elements.mixingBowlZone.classList.remove("mixing");

  elements.yogurtContainerZone.appendChild(elements.yogurtContainer);
  elements.yogurtContainer.className = "yogurt-container draggable";
  elements.yogurtContainer.removeAttribute("style");
  elements.yogurtContainer.src = `${IMAGE_PATH}yogurt-container.png`;
  elements.yogurtContainerZone.classList.remove("hidden");
  elements.yogurtFruitPlateZone.classList.remove("hidden");
  elements.yogurtControls.classList.remove("hidden");
  elements.completionControls.classList.add("hidden");

  elements.mixButton.disabled = true;
  elements.clearBowlButton.disabled = false;
  elements.clearBowlButton.classList.toggle("hidden", mode !== "free");
  configureCompletionControls(mode, false);
  renderYogurtFruitPlate();
  switchScene("yogurt");
  updateHeader(mode === "free" ? "Free Play • Fruit Yogurt" : "Round 3 • Make Yogurt", "Ingredients added: 0 / 8");
  elements.yogurtInstruction.textContent = "First, add the yogurt to the bowl.";
  updateDebug();
}

function renderYogurtFruitPlate() {
  elements.yogurtFruitsLayer.innerHTML = "";
  fruits.forEach((fruit, index) => {
    const image = createGameImage(fruit.cutImage, `Cut ${fruit.name}`, fruit.name);
    image.className = "yogurt-fruit-item draggable locked";
    image.dataset.fruitId = fruit.id;
    const [slotLeft, slotTop] = yogurtPlateSlots[index];
    image.style.left = `${fruit.id === "kiwi" ? slotLeft - 1 : slotLeft}%`;
    image.style.top = `${fruit.id === "kiwi" ? slotTop - 1 : slotTop}%`;
    elements.yogurtFruitsLayer.appendChild(image);

    dragManager.register(image, {
      canDrag: (element) => gameState.currentRound === 3
        && gameState.yogurt.yogurtAdded
        && !gameState.interactionLocked
        && !gameState.yogurt.isMixing
        && !gameState.yogurt.completed
        && !gameState.yogurt.addedFruits.includes(element.dataset.fruitId),
      onBlocked: () => friendlyBlockedFeedback(gameState.yogurt.yogurtAdded ? "This fruit is already in the bowl." : "Add the yogurt first."),
      getDropTarget: () => elements.mixingBowlZone,
      onValidDrop: handleFruitIngredientDrop
    });
  });
}

function handleYogurtDrop(container, _target, dragContext) {
  if (gameState.yogurt.yogurtAdded) return false;
  dragContext.complete();
  container.classList.add("hidden");
  gameState.yogurt.yogurtAdded = true;
  gameState.interactionLocked = true;
  elements.bowlInner.innerHTML = "";
  gameState.yogurt.piecePositions = [];
  animateYogurtPour();
  audio.effect("drop");
  updateYogurtProgress();
  updateDebug();

  window.setTimeout(() => {
    if (gameState.currentRound !== 3 || !gameState.yogurt.yogurtAdded) return;
    showYogurtOnlyBowl();
    elements.yogurtFruitsLayer.querySelectorAll(".yogurt-fruit-item").forEach((item) => item.classList.remove("locked"));
    gameState.interactionLocked = false;
    elements.yogurtInstruction.textContent = "Add all the fruits to the bowl!";
    updateMixButton();
    updateDebug();
  }, 420);
  return true;
}

function showYogurtOnlyBowl() {
  setBowlImage(`${IMAGE_PATH}bowl-fruit-unmixed.png`, "Bowl containing yogurt only");
  elements.bowlInner.innerHTML = "";
  elements.bowlYogurtSurface.classList.remove("hidden");
  elements.bowlContentClip.classList.remove("hidden");
  elements.bowlInner.classList.remove("hidden");
  elements.mixingBowlZone.classList.remove("mixing");
}

function animateYogurtPour() {
  const stream = document.createElement("div");
  stream.className = "pour-stream";
  elements.gameStage.appendChild(stream);
  window.setTimeout(() => stream.remove(), 900);
}

function handleFruitIngredientDrop(element, _target, dragContext) {
  const id = element.dataset.fruitId;
  if (!gameState.yogurt.yogurtAdded || gameState.yogurt.addedFruits.includes(id)) return false;
  dragContext.complete();
  element.remove();
  gameState.yogurt.addedFruits.push(id);
  createFruitPiecesInBowl(fruitById[id]);
  audio.effect("drop");
  updateYogurtProgress();
  updateMixButton();
  updateDebug();
  return true;
}

function createFruitPiecesInBowl(fruit) {
  const count = fruit.id === "blueberry" || fruit.id === "grapes" ? 4 : 3;
  for (let index = 0; index < count; index += 1) {
    const piece = createGameImage(fruit.pieceImage, "", fruit.name);
    piece.className = "bowl-piece";
    piece.dataset.fruitId = fruit.id;

    const position = findSafeBowlPosition();
    const rotation = -35 + Math.random() * 70;
    piece.style.left = `${position.x}%`;
    piece.style.top = `${position.y}%`;
    piece.style.setProperty("--rotation", `${rotation}deg`);
    piece.style.animationDelay = `${index * .06}s`;
    elements.bowlInner.appendChild(piece);
    gameState.yogurt.piecePositions.push(position);
  }
}

function findSafeBowlPosition() {
  const existing = gameState.yogurt.piecePositions || [];
  let fallback = { x: 50, y: 50 };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const x = 18 + Math.random() * 64;
    const y = 20 + Math.random() * 56;
    fallback = { x, y };

    const normalizedX = (x - 50) / 34;
    const normalizedY = (y - 49) / 30;
    if ((normalizedX * normalizedX) + (normalizedY * normalizedY) > .76) continue;

    const minimumDistance = attempt < 30 ? 10 : 6.5;
    const clearOfOtherPieces = existing.every((other) => Math.hypot(x - other.x, y - other.y) >= minimumDistance);
    if (clearOfOtherPieces) return { x, y };
  }

  return fallback;
}

function updateYogurtProgress() {
  const count = (gameState.yogurt.yogurtAdded ? 1 : 0) + gameState.yogurt.addedFruits.length;
  updateHeader(gameState.mode === "free" ? "Free Play • Fruit Yogurt" : "Round 3 • Make Yogurt", `Ingredients added: ${count} / 8`);
}

/**
 * Return all fruit IDs currently added to the yogurt bowl.
 * Supports:
 * - Array of IDs
 * - Array of fruit objects
 * - Set of IDs
 */
function getAddedYogurtFruitIds() {
  const addedFruits = gameState.yogurt.addedFruits;

  let items = [];

  if (addedFruits instanceof Set) {
    items = Array.from(addedFruits);
  } else if (Array.isArray(addedFruits)) {
    items = addedFruits;
  }

  return new Set(
    items
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item.id === "string") {
          return item.id;
        }

        if (item && typeof item.fruitId === "string") {
          return item.fruitId;
        }

        return null;
      })
      .filter(Boolean)
  );
}

/**
 * Check the actual game state instead of relying on DOM elements.
 * This avoids Safari state mismatches after touch/drop interactions.
 */
function canStartYogurtMixing() {
  if (!gameState || !gameState.yogurt) {
    return false;
  }

  const requiredFruitIds = fruits.map((fruit) => fruit.id);
  const addedFruitIds = getAddedYogurtFruitIds();

  const hasAllFruits = requiredFruitIds.every((fruitId) =>
    addedFruitIds.has(fruitId)
  );

  return (
    gameState.yogurt.yogurtAdded === true &&
    hasAllFruits &&
    gameState.yogurt.isMixing !== true &&
    gameState.yogurt.completed !== true
  );
}

/**
 * Safari-safe Mix button state update.
 */
function updateMixButton() {
  const mixButton = document.getElementById("mixButton");

  if (!mixButton) {
    return;
  }

  const isReady = canStartYogurtMixing();

  if (isReady) {
    /*
     * Set both the property and HTML attribute.
     * This forces Safari to refresh the native disabled state.
     */
    mixButton.disabled = false;
    mixButton.removeAttribute("disabled");
    mixButton.setAttribute("aria-disabled", "false");
    mixButton.classList.add("is-ready");
    mixButton.style.pointerEvents = "auto";
  } else {
    mixButton.disabled = true;
    mixButton.setAttribute("disabled", "");
    mixButton.setAttribute("aria-disabled", "true");
    mixButton.classList.remove("is-ready");
    mixButton.style.pointerEvents = "none";
  }
}

function startMixingAnimation() {
  if (elements.mixButton.disabled || gameState.yogurt.isMixing) return;
  gameState.yogurt.isMixing = true;
  const currentMixToken = ++yogurtMixToken;
  gameState.interactionLocked = true;
  elements.mixButton.disabled = true;
  elements.clearBowlButton.disabled = true;
  elements.yogurtInstruction.textContent = "Mixing the fruit yogurt…";
  elements.mixingBowlZone.classList.add("mixing");
  audio.effect("mix");
  updateDebug();

  window.setTimeout(() => {
    if (currentMixToken === yogurtMixToken && gameState.yogurt.isMixing) showCompletedYogurt();
  }, 2700);
}

function showCompletedYogurt() {
  if (gameState.currentRound !== 3) return;

  elements.mixingBowlZone.classList.remove("mixing");
  elements.bowlInner.innerHTML = "";
  elements.bowlYogurtSurface.classList.add("hidden");
  elements.bowlContentClip.classList.add("hidden");
  elements.mixingSpoon.classList.add("hidden");
  setBowlImage(`${IMAGE_PATH}bowl-fruit-mixed.png`, "Finished bowl of colorful fruit yogurt");

  gameState.yogurt.isMixing = false;
  gameState.yogurt.completed = true;
  gameState.interactionLocked = false;
  elements.yogurtInstruction.textContent = gameState.mode === "free"
    ? "Your free-play fruit yogurt is ready!"
    : "Your Fruit Yogurt Is Ready! Great job!";

  elements.yogurtContainerZone.classList.add("hidden");
  elements.yogurtFruitPlateZone.classList.add("hidden");
  elements.yogurtControls.classList.add("hidden");
  configureCompletionControls(gameState.mode, true);
  elements.completionControls.classList.remove("hidden");

  celebrate();
  audio.effect("gameComplete");
  updateDebug();
}

function configureCompletionControls(mode, completed) {
  const isFree = mode === "free";
  elements.resetGameButton.classList.toggle("hidden", !completed || isFree);
  elements.freePlayButton.classList.toggle("hidden", !completed || isFree);
  elements.mixAgainButton.classList.toggle("hidden", !completed || !isFree);
  elements.clearFinalButton.classList.toggle("hidden", !completed || !isFree);
  elements.playFullGameButton.classList.toggle("hidden", !completed || !isFree);
}

function remixCurrentBowl() {
  if (gameState.currentRound !== 3 || gameState.mode !== "free" || !gameState.yogurt.completed) return;
  clearCelebration();
  gameState.yogurt.completed = false;
  gameState.yogurt.piecePositions = [];
  elements.bowlInner.innerHTML = "";
  setBowlImage(`${IMAGE_PATH}bowl-fruit-unmixed.png`, "Bowl containing yogurt and fruit pieces");
  elements.bowlYogurtSurface.classList.remove("hidden");
  elements.bowlContentClip.classList.remove("hidden");
  elements.mixingSpoon.classList.remove("hidden");
  gameState.yogurt.addedFruits.forEach((id) => createFruitPiecesInBowl(fruitById[id]));
  elements.completionControls.classList.add("hidden");
  elements.yogurtControls.classList.remove("hidden");
  elements.mixButton.disabled = false;
  elements.clearBowlButton.classList.remove("hidden");
  elements.clearBowlButton.disabled = false;
  startMixingAnimation();
}

function resetGame() {
  yogurtMixToken += 1;
  clearCelebration();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  elements.gardenPlants.innerHTML = "";
  elements.basketItems.innerHTML = "";
  elements.wholeFruitsLayer.innerHTML = "";
  elements.boardFruitLayer.innerHTML = "";
  elements.cutFruitsLayer.innerHTML = "";
  elements.cutSparkles.innerHTML = "";
  resetKnifeVisual();

  elements.bowlInner.innerHTML = "";
  elements.bowlYogurtSurface.classList.add("hidden");
  elements.bowlContentClip.classList.remove("hidden");
  elements.mixingBowlZone.classList.remove("mixing");
  elements.mixingSpoon.classList.remove("hidden");
  setBowlImage(`${IMAGE_PATH}bowl-empty.png`, "Empty mixing bowl");
  elements.completionControls.classList.add("hidden");
  elements.yogurtControls.classList.remove("hidden");

  resetState();
  if (gameState.hasStarted) startGardenRound();
  else switchScene("start");
}

function setBowlImage(src, alt) {
  elements.bowlBase.src = src;
  elements.bowlBase.alt = alt;
  elements.bowlFrontRim.src = src;
}

function updateHeader(title, progress) {
  elements.roundTitle.textContent = title;
  elements.globalProgress.textContent = progress;
}

function celebrate(count = 34) {
  clearCelebration();
  const symbols = ["★", "✦", "🍓", "🫐", "🍌", "🥝", "🍎", "🥭"];
  for (let index = 0; index < count; index += 1) {
    const item = document.createElement("span");
    item.className = "confetti";
    item.textContent = symbols[index % symbols.length];
    item.style.left = `${Math.random() * 96}%`;
    item.style.setProperty("--duration", `${2.1 + Math.random() * 1.8}s`);
    item.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    item.style.animationDelay = `${Math.random() * .7}s`;
    elements.celebrationLayer.appendChild(item);
  }
}

function clearCelebration() {
  if (elements.celebrationLayer) elements.celebrationLayer.innerHTML = "";
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 1500);
}

function friendlyBlockedFeedback(message) {
  audio.effect("wrong");
  showToast(message);
}

function isDroppedOn(element, target) {
  const itemRect = element.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const centerX = itemRect.left + itemRect.width / 2;
  const centerY = itemRect.top + itemRect.height / 2;
  return centerX >= targetRect.left && centerX <= targetRect.right && centerY >= targetRect.top && centerY <= targetRect.bottom;
}

function createGameImage(src, alt, fallbackLabel = "Image") {
  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  image.draggable = false;
  image.dataset.fallbackLabel = fallbackLabel;
  return image;
}

function renderFloatingFruits() {
  elements.floatingFruits.innerHTML = "";
  const positions = [[5,16],[13,68],[76,14],[84,66],[3,42],[88,38],[66,74]];
  fruits.forEach((fruit, index) => {
    const image = createGameImage(fruit.wholeImage, "", fruit.name);
    image.className = "floating-fruit";
    image.style.left = `${positions[index][0]}%`;
    image.style.top = `${positions[index][1]}%`;
    image.style.animationDelay = `${index * .23}s`;
    elements.floatingFruits.appendChild(image);
  });
}

function installImageFallbacks() {
  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = fallbackSvg(image.dataset.fallbackLabel || image.alt || "Image");
  }, true);
}

function fallbackSvg(label) {
  const safeLabel = String(label).replace(/[<>&"']/g, "").slice(0, 18);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="260" viewBox="0 0 360 260"><rect x="8" y="8" width="344" height="244" rx="40" fill="#fff5c9" stroke="#cfae62" stroke-width="8"/><circle cx="180" cy="105" r="55" fill="#d9e9ae"/><text x="180" y="119" text-anchor="middle" font-size="54">✿</text><text x="180" y="205" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#765738">${safeLabel}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function preloadAssets() {
  const sources = new Set([
    `${IMAGE_PATH}garden-background.png`, `${IMAGE_PATH}kitchen-background.png`,
    `${IMAGE_PATH}basket.png`, `${IMAGE_PATH}basket-back.png`, `${IMAGE_PATH}basket-front.png`, `${IMAGE_PATH}cutting-board.png`, `${IMAGE_PATH}plate.png`, `${IMAGE_PATH}knife.png`,
    `${IMAGE_PATH}bowl-empty.png`, `${IMAGE_PATH}bowl-fruit-unmixed.png`, `${IMAGE_PATH}bowl-fruit-mixed.png`, `${IMAGE_PATH}yogurt-container.png`, `${IMAGE_PATH}spoon.png`,
    `${IMAGE_PATH}play.png`, `${IMAGE_PATH}pickfruit.png`, `${IMAGE_PATH}done.png`, `${IMAGE_PATH}reset.png`, `${IMAGE_PATH}mix.png`
  ]);
  fruits.forEach((fruit) => {
    sources.add(fruit.wholeImage); sources.add(fruit.cutImage); sources.add(fruit.pieceImage);
    sources.add(plantConfigs[fruit.id].image);
  });
  sources.forEach((src) => {
    const image = new Image();
    image.onload = () => {};
    image.onerror = () => {};
    image.src = src;
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function enableDebugMode() {
  elements.debugPanel.classList.remove("hidden");
  elements.gameStage.classList.add("debug-active");
  elements.debugNext.addEventListener("click", () => {
    if (gameState.currentRound === 1) {
      gameState.garden.collected = fruits.map((fruit) => fruit.id);
      startCuttingRound();
    } else if (gameState.currentRound === 2) {
      gameState.cutting.completed = fruits.map((fruit) => fruit.id);
      startYogurtRound("story");
    } else if (gameState.currentRound === 3) {
      gameState.yogurt.yogurtAdded = true;
      gameState.yogurt.addedFruits = fruits.map((fruit) => fruit.id);
      showCompletedYogurt();
    } else {
      startGardenRound();
    }
  });
  updateDebug();
}

function updateDebug() {
  if (!DEBUG_MODE || !elements.debugState) return;
  const currentTarget = getCurrentGardenFruit();
  elements.debugState.textContent = JSON.stringify({
    currentRound: gameState.currentRound,
    mode: gameState.mode,
    currentGardenTarget: currentTarget?.name || null,
    garden: gameState.garden,
    cutting: gameState.cutting,
    yogurt: gameState.yogurt
  }, null, 2);
}

document.addEventListener("DOMContentLoaded", initializeGame);

/**
 * Prevent page zoom gestures inside the fixed-screen game.
 *
 * Covers:
 * - Pinch zoom
 * - Safari gesture zoom
 * - Double-tap zoom
 * - Trackpad pinch represented as Ctrl + wheel
 */
function initializeIPadZoomLock() {
  const gameRoot =
    document.getElementById("gameContainer") ||
    document.getElementById("gameArea") ||
    document.querySelector(".game-container") ||
    document.querySelector(".game-area") ||
    document.body;

  function preventGesture(event) {
    event.preventDefault();
  }

  /*
   * Safari-specific pinch gesture events.
   */
  document.addEventListener("gesturestart", preventGesture, {
    passive: false
  });

  document.addEventListener("gesturechange", preventGesture, {
    passive: false
  });

  document.addEventListener("gestureend", preventGesture, {
    passive: false
  });

  /*
   * Prevent two-finger pinch zoom.
   * One-finger pointer dragging continues to work.
   */
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    },
    {
      passive: false
    }
  );

  /*
   * Prevent Safari double-tap zoom inside the game.
   */
  let lastTouchEndTime = 0;

  document.addEventListener(
    "touchend",
    (event) => {
      if (!gameRoot.contains(event.target)) {
        return;
      }

      const currentTime = Date.now();
      const timeSincePreviousTouch =
        currentTime - lastTouchEndTime;

      if (
        timeSincePreviousTouch > 0 &&
        timeSincePreviousTouch < 300
      ) {
        event.preventDefault();
      }

      lastTouchEndTime = currentTime;
    },
    {
      passive: false
    }
  );

  /*
   * Prevent pinch zoom from an attached trackpad.
   */
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    },
    {
      passive: false
    }
  );
}

initializeIPadZoomLock();
