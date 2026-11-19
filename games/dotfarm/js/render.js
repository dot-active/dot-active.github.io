/* =========================================================
   RENDERING
   ========================================================= */
const $ = id => document.getElementById(id);

function renderCoins() {
  $('coin-count').textContent = state.coins;
}

function renderField() {
  const field = $('field');
  field.style.gridTemplateColumns = `repeat(${CONFIG.fieldColumns}, 1fr)`;
  field.style.gridTemplateRows = `repeat(${CONFIG.fieldRows}, 1fr)`;
  field.style.setProperty('--field-ratio', `${CONFIG.fieldColumns} / ${CONFIG.fieldRows}`);
  field.style.setProperty('--cols', CONFIG.fieldColumns);
  field.innerHTML = '';
  state.tiles.forEach((tile, i) => {
    const el = document.createElement('div');
    el.dataset.index = i;
    el.innerHTML = '<span class="tile-icon"></span><span class="tile-timer"></span>';
    field.appendChild(el);
    renderTile(i);
  });
}

function renderTile(i) {
  const tile = state.tiles[i];
  const el = $('field').children[i];
  // classList.toggle keeps other classes (like drag highlights) intact.
  el.classList.add('tile');
  el.classList.toggle('open', tile.unlocked);
  el.classList.toggle('locked', !tile.unlocked);
  Object.keys(CONFIG.buildings).forEach(type => {
    el.classList.toggle('bld-' + type, !!tile.building && tile.building.type === type);
  });
  let icon = '', timer = '', baby = false, penEmpty = false;
  if (tile.animal) {
    const a = CONFIG.animals[tile.animal.type];
    const now = gameNow();
    if (isGrown(tile, now)) {
      icon = a.grownIcon;
    } else {
      icon = a.icon;
      baby = true;
      timer = formatTime(a.growTimeMs - (now - tile.animal.bornAt));
    }
  } else if (tile.product) {
    // Something the pigpen made, waiting to be collected.
    icon = itemInfo(tile.product).icon;
    baby = !!CONFIG.animals[tile.product];
  } else if (tile.building) {
    if (tile.building.type === 'pigpen' && tile.building.anchor === i) {
      // Empty pig tile: a faded pig shows "a pig can go here".
      icon = CONFIG.buildings.pigpen.icon;
      penEmpty = true;
    } else if (tile.building.type === 'pigpen') {
      // Production tile: stays empty until something appears (at a random time).
    } else if (tile.building.anchor === i) {
      icon = CONFIG.buildings[tile.building.type].icon;
    }
  } else if (tile.crop) {
    const crop = CONFIG.crops[tile.crop.type];
    const now = gameNow();
    if (isRipe(tile, now)) {
      icon = crop.ripeIcon;
    } else {
      icon = crop.seedlingIcon;
      timer = formatTime(crop.growTimeMs - (now - tile.crop.plantedAt));
    }
  }
  el.classList.toggle('baby', baby);
  el.classList.toggle('pen-empty', penEmpty);
  // Only touch the DOM when something changed.
  const iconEl = el.children[0], timerEl = el.children[1];
  if (iconEl.textContent !== icon) iconEl.textContent = icon;
  if (timerEl.textContent !== timer) timerEl.textContent = timer;
}

// Milliseconds → "9:05" or "1:02:03" (rounded up, so it never shows 0:00 early).
function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function renderMarket() {
  const list = $('market-items');
  list.innerHTML = '';
  goodsList().forEach(([id, g]) => {
    const dir = state.market.change[id];
    const arrow = dir > 0 ? '<span class="arrow up">↑</span>'
                : dir < 0 ? '<span class="arrow down">↓</span>'
                : '<span class="arrow">–</span>';
    const row = document.createElement('div');
    row.className = 'market-row';
    row.innerHTML = `
      <span class="icon">${g.icon}</span>
      <span class="name">${g.name}</span>
      <span class="price">🪙 ${state.market.prices[id]}</span>
      ${arrow}`;
    list.appendChild(row);
  });
}

function renderShop() {
  const list = $('shop-items');
  list.innerHTML = '';
  Object.entries(CONFIG.crops).forEach(([id, crop]) => {
    list.appendChild(makeSlot(crop.icon, crop.seedName, `🪙 ${crop.seedPrice}`, { crop: id }));
  });

  Object.entries(CONFIG.animals).forEach(([id, a]) => {
    list.appendChild(makeSlot(a.icon, a.name, `🪙 ${a.price}`, { animal: id }));
  });

  // Non-seed items: data-item is the CONFIG key.
  ['fertilizer', 'newLand'].forEach(key => {
    const f = CONFIG[key];
    list.appendChild(makeSlot(f.icon, f.name, `🪙 ${f.price}`, { item: key }));
  });
  fillEmptySlots(list);
}

function renderBuild() {
  const list = $('build-items');
  list.innerHTML = '';
  Object.entries(CONFIG.buildings).forEach(([id, b]) => {
    const item = makeSlot(b.icon, b.name, `🪙 ${b.cost}`, { building: id });
    item.title = `${b.name} · ${b.size} tile${b.size > 1 ? 's' : ''}`;
    if (b.size > 1) item.insertAdjacentHTML('afterbegin', `<span class="count">${b.size}▦</span>`);
    list.appendChild(item);
  });
  fillEmptySlots(list);
}

function renderStorage() {
  const list = $('storage-items');
  list.innerHTML = '';
  // One slot per stack: 23 corn with stackSize 10 → slots of 10, 10, 3.
  storageStacks().forEach(([id, count]) => {
    const g = itemInfo(id);
    const row = document.createElement('div');
    row.className = 'shop-item storage-row';
    row.dataset.goods = id;
    row.title = g.name;
    row.innerHTML = `
      <span class="count">${count}</span>
      <span class="icon">${g.icon}</span>
      <span class="name">${g.name}</span>`;
    list.appendChild(row);
  });
  // Usable empty slots, then locked (grey) ones up to a full row of 4.
  const cap = storageCapacity();
  for (let n = list.children.length; n < cap; n++) {
    const slot = document.createElement('div');
    slot.className = 'slot-empty';
    list.appendChild(slot);
  }
  const shown = Math.max(CONFIG.storage.minShownSlots, Math.ceil(list.children.length / 4) * 4);
  for (let n = list.children.length; n < shown; n++) {
    const slot = document.createElement('div');
    slot.className = 'slot-locked';
    slot.textContent = '🔒';
    slot.title = `Build a Warehouse to unlock ${CONFIG.storage.slotsPerWarehouse} more slots`;
    list.appendChild(slot);
  }
  const used = storageSlotsUsed();
  $('storage-hint').innerHTML = cap === 0
    ? `Build a ${CONFIG.buildings.warehouse.icon} Warehouse to use Storage!`
    : `${used} / ${cap} slots used · each Warehouse adds ${CONFIG.storage.slotsPerWarehouse}<br>Drag things out to sell or use them!`;
}

// Pad a slot grid with empty slots so it always shows at least 4 x 5 = 20.
const MIN_SLOTS = 20;
function fillEmptySlots(list) {
  for (let n = list.children.length; n < MIN_SLOTS; n++) {
    const slot = document.createElement('div');
    slot.className = 'slot-empty';
    list.appendChild(slot);
  }
}

// One slot in the Shop / Build grid.
function makeSlot(icon, name, price, data) {
  const item = document.createElement('div');
  item.className = 'shop-item';
  Object.assign(item.dataset, data);
  item.title = name;
  item.innerHTML = `
    <span class="icon">${icon}</span>
    <span class="name">${name}</span>
    <span class="price">${price}</span>`;
  return item;
}

function renderToolbar() {
  const bar = $('toolbar');
  bar.innerHTML = '';
  CONFIG.tools.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.dataset.tool = t.id;
    btn.disabled = !state.tools[t.id];
    btn.innerHTML = `<span class="icon">${t.icon}</span><span>${t.label}</span>`;
    bar.appendChild(btn);
  });
}

function renderAll() {
  renderCoins();
  renderField();
  renderToolbar();
  renderShop();
  renderMarket();
  renderBuild();
  renderStorage();
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
}

