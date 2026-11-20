/* =========================================================
   GAME CLOCK
   All timers must use gameNow() instead of Date.now().
   It is based on Date.now(), so time keeps passing while the
   page is closed. In debug mode it runs CONFIG.debugSpeed x faster;
   the extra time is stored in state.timeOffset so it survives reloads.
   ========================================================= */
let debugOn = false;
let lastRealTime = Date.now();

function gameNow() {
  const real = Date.now();
  if (debugOn) {
    state.timeOffset += (real - lastRealTime) * (CONFIG.debugSpeed - 1);
  }
  lastRealTime = real;
  return real + state.timeOffset;
}

function toggleDebug() {
  gameNow();               // settle time at the current speed first
  debugOn = !debugOn;
  document.body.classList.toggle('debug-on', debugOn);
  showToast(debugOn ? `Fast mode ON (x${CONFIG.debugSpeed})` : 'Fast mode OFF');
  saveGame();
}

/* =========================================================
   GOODS — everything that can be stored and sold
   (crops + products), as [id, { name, icon, basePrice }]
   ========================================================= */
function goodsList() {
  const list = Object.entries(CONFIG.crops)
    .map(([id, c]) => [id, { name: c.name, icon: c.ripeIcon, basePrice: c.basePrice }]);
  return list.concat(Object.entries(CONFIG.products));
}
function goodsInfo(id) {
  const found = goodsList().find(([gid]) => gid === id);
  return found ? found[1] : null;
}

// Anything that can sit in Storage: goods, Fertilizer, or an animal (baby).
// Returns { name, icon } or null.
function itemInfo(id) {
  const g = goodsInfo(id);
  if (g) return g;
  if (id === 'fertilizer') return { name: CONFIG.fertilizer.name, icon: CONFIG.fertilizer.icon };
  const a = CONFIG.animals[id];
  if (a) return { name: a.name, icon: a.icon };
  return null;
}

/* =========================================================
   GAME STATE
   ========================================================= */
let state = null;

function newGameState() {
  const tiles = [];
  const a = CONFIG.startArea;
  for (let row = 0; row < CONFIG.fieldRows; row++) {
    for (let col = 0; col < CONFIG.fieldColumns; col++) {
      const inStart = col >= a.col && col < a.col + a.width &&
                      row >= a.row && row < a.row + a.height;
      // crop:     null when empty, or { type: 'corn', plantedAt: <game time ms> }
      // building: null, or { type: 'pigpen', anchor: <index of its first tile> }
      // animal:   null, or { type: 'pig', bornAt: <game time ms> } (only on a pen's first tile)
      // product:  null, or 'fertilizer' / 'pig' waiting on a pen's second tile
      // produceAt: game time the pen's second tile will make its next thing, or null
      // job:      null, or { doneAt: <game time ms> } while a Butcher is working
      // output:   null, or { id: 'meat', count: 5 } waiting on a Butcher
      tiles.push({ col, row, unlocked: inStart, crop: null, building: null, animal: null,
                   product: null, produceAt: null, job: null, output: null });
    }
  }
  const tools = {};
  CONFIG.tools.forEach(t => { tools[t.id] = t.unlocked; });

  const prices = {}, change = {};
  goodsList().forEach(([id, g]) => {
    prices[id] = g.basePrice;
    change[id] = 0;
  });

  return {
    coins: CONFIG.startCoins,
    tiles,
    tools,           // which footer tools are unlocked
    storage: {},     // goods kept for later: { corn: 3, ... }
    market: {
      prices,        // current price per crop
      change,        // +1 went up, -1 went down, 0 no change (for the arrows)
      lastUpdate: Date.now(), // game time of the last price change (new game: no offset yet)
    },
    timeOffset: 0,   // extra game time gained from debug fast mode (ms)
  };
}

/* =========================================================
   SAVE / LOAD (localStorage)
   ========================================================= */
function saveGame() {
  try {
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(state));
  } catch (e) {
    // Storage may be blocked (private mode etc.) — the game still works.
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Basic sanity check: field size must match the current CONFIG.
    if (!data || !Array.isArray(data.tiles) ||
        data.tiles.length !== CONFIG.fieldColumns * CONFIG.fieldRows) return null;
    // Fill in anything missing from older saves.
    const fresh = newGameState();
    const m = data.market || {};
    // A tool is unlocked if the save says so OR CONFIG now unlocks it from the start.
    const tools = {};
    CONFIG.tools.forEach(t => { tools[t.id] = t.unlocked || !!(data.tools && data.tools[t.id]); });
    return {
      ...fresh,
      ...data,
      tools,
      storage: { ...(data.storage || {}) },
      market: {
        ...fresh.market,
        ...m,
        prices: { ...fresh.market.prices, ...(m.prices || {}) },
        change: { ...fresh.market.change, ...(m.change || {}) },
      },
    };
  } catch (e) {
    return null;
  }
}

