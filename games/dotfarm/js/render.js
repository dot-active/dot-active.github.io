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
  } else if (tile.building && tile.building.type === 'butcher') {
    if (tile.output) {
      // Finished: the meat waits here, "×5" in the label.
      icon = itemInfo(tile.output.id).icon;
      timer = `×${tile.output.count}`;
    } else {
      icon = CONFIG.buildings.butcher.icon;
      if (tile.job) timer = formatTime(tile.job.doneAt - gameNow());
    }
    el.classList.toggle('working', !!tile.job);
  } else if (tile.building) {
    if (isPen(tile.building.type) && tile.building.anchor === i) {
      // Empty animal tile: a faded animal shows "one can go here".
      icon = CONFIG.buildings[tile.building.type].icon;
      penEmpty = true;
    } else if (isPen(tile.building.type)) {
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
  if (!tile.building || tile.building.type !== 'butcher') el.classList.remove('working');
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
    const price = state.market.prices[id];
    // Compare with the usual price, so players can tell a good moment to sell.
    const tag = price >= g.basePrice * 1.1 ? '<span class="tag high">HIGH</span>'
              : price <= g.basePrice * 0.9 ? '<span class="tag low">LOW</span>' : '';
    const row = document.createElement('div');
    row.className = 'market-row';
    row.dataset.goods = id;
    row.innerHTML = `
      <span class="icon">${g.icon}</span>
      <div class="info">
        <div class="name">${g.name}${tag}</div>
        <div class="avg">Usually 🪙 ${g.basePrice}</div>
      </div>
      <span class="price">🪙 ${price}</span>
      ${arrow}`;
    list.appendChild(row);
  });
  renderMarketTimer();
}

// "New prices in 0:21"
function renderMarketTimer() {
  const left = state.market.lastUpdate + CONFIG.market.priceUpdateMs - gameNow();
  const text = formatTime(left);
  if ($('market-timer').textContent !== text) $('market-timer').textContent = text;
}

/* ---------- Market drop zone feedback ---------- */
// While a sellable thing (goodsId) is dragged: the Market invites the drop;
// over the Market it says what you'll get. goodsId = null ends it.
function setMarketHover(goodsId, over) {
  const win = $('market-window');
  win.classList.toggle('armed', !!goodsId);
  win.classList.toggle('drop-target', !!goodsId && over);
  document.querySelectorAll('#market-items .market-row').forEach(r =>
    r.classList.toggle('active', !!goodsId && r.dataset.goods === goodsId));
  if (win.classList.contains('sold')) return;   // let the "Sold!" message show
  const g = goodsId && goodsInfo(goodsId);
  $('sell-zone-icon').textContent = g ? g.icon : '🧺';
  $('sell-zone-main').textContent = !g ? 'Drag goods here to sell'
    : over ? `Let go to sell for 🪙 ${state.market.prices[goodsId]}` : `Drop ${g.name} here to sell`;
  $('sell-zone-sub').textContent = g ? `Today's price: 🪙 ${state.market.prices[goodsId]}` : 'From your field or Storage';
}

// Brief "Sold!" message in the drop zone.
let soldTimer = null;
function flashMarketSale(goodsId, price, count = 1) {
  const win = $('market-window');
  win.classList.add('sold');
  $('sell-zone-icon').textContent = '🪙';
  $('sell-zone-main').textContent = `Sold ${count > 1 ? count + ' ' : ''}${goodsInfo(goodsId).name} for 🪙 ${price}!`;
  $('sell-zone-sub').textContent = 'Drag more goods here to sell';
  clearTimeout(soldTimer);
  soldTimer = setTimeout(() => { win.classList.remove('sold'); setMarketHover(null, false); }, 1200);
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
  ['fertilizer', 'newLand', 'petEgg'].forEach(key => {
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
  renderPets();
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

