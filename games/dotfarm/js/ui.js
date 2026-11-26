/* =========================================================
   WINDOWS (open, close, drag by title bar)
   ========================================================= */
// Keep a window fully inside the screen.
function placeWindow(win, x, y) {
  const maxX = window.innerWidth - win.offsetWidth;
  const maxY = window.innerHeight - win.offsetHeight;
  win.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
  win.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
}

// The most recently opened or touched window is drawn on top.
let topZ = 10;
function bringToFront(win) {
  win.style.zIndex = ++topZ;
}

// side: 'right' or 'left', y: top position — where the window first appears.
function openWindow(win, side = 'right', y = 80) {
  const firstTime = !win.style.left;
  win.classList.add('open');
  bringToFront(win);
  if (firstTime) {
    const x = side === 'left' ? 16 : window.innerWidth - win.offsetWidth - 16;
    placeWindow(win, x, y);
  } else {
    placeWindow(win, win.offsetLeft, win.offsetTop);
  }
}

function closeWindow(win) {
  win.classList.remove('open');
}

function makeWindowDraggable(win) {
  win.addEventListener('pointerdown', () => bringToFront(win));
  const handle = win.querySelector('.window-title');
  handle.addEventListener('pointerdown', e => {
    if (e.target.closest('.window-close')) return;   // let the close button work
    e.preventDefault();
    const offsetX = e.clientX - win.offsetLeft;
    const offsetY = e.clientY - win.offsetTop;
    handle.setPointerCapture(e.pointerId);

    const onMove = ev => placeWindow(win, ev.clientX - offsetX, ev.clientY - offsetY);
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
}

/* =========================================================
   DRAG HELPER — an icon follows the pointer; if the drop
   fails it snaps back to where it came from.
   ========================================================= */
// sourceEl: element the drag started on (gets the pointer capture)
// icon:     emoji to show while dragging
// handlers: { over(x, y), end(), drop(x, y) -> true if the drop worked }
function startIconDrag(e, sourceEl, icon, handlers) {
  e.preventDefault();
  const r = sourceEl.getBoundingClientRect();
  const homeX = r.left + r.width / 2;    // where to snap back to
  const homeY = r.top + r.height / 2;

  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = icon;
  document.body.appendChild(ghost);
  const moveGhost = (x, y) => { ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; };
  moveGhost(e.clientX, e.clientY);

  sourceEl.setPointerCapture(e.pointerId);

  let lastX = e.clientX, lastY = e.clientY;
  const onMove = ev => {
    lastX = ev.clientX; lastY = ev.clientY;
    moveGhost(ev.clientX, ev.clientY);
    if (handlers.over) handlers.over(ev.clientX, ev.clientY);
  };
  // Holding the item near the left/right edge of the field area scrolls the
  // field (on phones it is wider than the screen).
  let scrolling = true;
  const autoScroll = () => {
    if (!scrolling) return;
    const main = document.querySelector('main');
    const r = main.getBoundingClientRect(), edge = 48;
    let dx = 0;
    if (lastY > r.top && lastY < r.bottom) {
      if (lastX < r.left + edge) dx = -Math.ceil((r.left + edge - lastX) / 4);
      else if (lastX > r.right - edge) dx = Math.ceil((lastX - (r.right - edge)) / 4);
    }
    if (dx && main.scrollWidth > main.clientWidth) {
      const before = main.scrollLeft;
      main.scrollLeft += dx;
      if (main.scrollLeft !== before && handlers.over) handlers.over(lastX, lastY);
    }
    requestAnimationFrame(autoScroll);
  };
  requestAnimationFrame(autoScroll);
  const finish = (ev, cancelled) => {
    scrolling = false;
    sourceEl.removeEventListener('pointermove', onMove);
    sourceEl.removeEventListener('pointerup', onUp);
    sourceEl.removeEventListener('pointercancel', onCancel);
    if (handlers.end) handlers.end();
    if (!cancelled && handlers.drop(ev.clientX, ev.clientY)) {
      ghost.remove();
    } else {
      ghost.classList.add('snap-back');
      moveGhost(homeX, homeY);
      setTimeout(() => ghost.remove(), 260);
    }
  };
  const onUp = ev => finish(ev, false);
  const onCancel = ev => finish(ev, true);

  sourceEl.addEventListener('pointermove', onMove);
  sourceEl.addEventListener('pointerup', onUp);
  sourceEl.addEventListener('pointercancel', onCancel);
}

// Find the field tile under a screen point, or -1.
function tileIndexAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const tileEl = el && el.closest('#field .tile');
  return tileEl ? Number(tileEl.dataset.index) : -1;
}

// Is a screen point over an open window? (e.g. isOverWindow('market-window', x, y))
function isOverWindow(id, x, y) {
  const el = document.elementFromPoint(x, y);
  return !!(el && el.closest(`#${id}.open`));
}
const isOverMarket  = (x, y) => isOverWindow('market-window', x, y);
const isOverStorage = (x, y) => isOverWindow('storage-window', x, y);

function clearDropHighlight() {
  document.querySelectorAll('.tile.drop-ok, .tile.drop-bad')
    .forEach(el => el.classList.remove('drop-ok', 'drop-bad'));
}

/* ---------- Seed: Shop → field ---------- */
function startSeedDrag(item, e) {
  const cropId = item.dataset.crop;
  startIconDrag(e, item, CONFIG.crops[cropId].icon, {
    over(x, y) {
      clearDropHighlight();
      const i = tileIndexAt(x, y);
      if (i >= 0) $('field').children[i].classList.add(canPlantOn(i) ? 'drop-ok' : 'drop-bad');
    },
    end: clearDropHighlight,
    drop(x, y) {
      const i = tileIndexAt(x, y);
      return i >= 0 && plantSeed(cropId, i);
    },
  });
}

/* ---------- Shop item used on one tile (Fertilizer, New Land) ---------- */
// canUse(index) -> may it be dropped there?  use(index) -> true if it worked.
function startTileItemDrag(item, e, icon, canUse, use) {
  startIconDrag(e, item, icon, {
    over(x, y) {
      clearDropHighlight();
      const i = tileIndexAt(x, y);
      if (i >= 0) $('field').children[i].classList.add(canUse(i) ? 'drop-ok' : 'drop-bad');
    },
    end: clearDropHighlight,
    drop(x, y) {
      const i = tileIndexAt(x, y);
      return i >= 0 && use(i);
    },
  });
}

/* ---------- Building: Build window → empty tile(s) ---------- */
function startBuildDrag(item, e) {
  const type = item.dataset.building;
  startIconDrag(e, item, CONFIG.buildings[type].icon, {
    over(x, y) {
      clearDropHighlight();
      const i = tileIndexAt(x, y);
      if (i < 0) return;
      const spot = findBuildSpot(type, i);
      if (spot) spot.forEach(t => $('field').children[t].classList.add('drop-ok'));
      else $('field').children[i].classList.add('drop-bad');
    },
    end: clearDropHighlight,
    drop(x, y) {
      const i = tileIndexAt(x, y);
      return i >= 0 && placeBuilding(type, i);
    },
  });
}

/* ---------- Ripe crop: field → Market (sell) or Storage (keep) ---------- */
function startHarvestDrag(tileEl, e) {
  const index = Number(tileEl.dataset.index);
  const tile = state.tiles[index];
  if (!isRipe(tile)) return;
  const storage = $('storage-window');
  const cropId = tile.crop.type;
  tileEl.style.opacity = '0.35';       // show the crop is "lifted"
  startIconDrag(e, tileEl, CONFIG.crops[cropId].ripeIcon, {
    over(x, y) {
      setMarketHover(cropId, isOverMarket(x, y));
      storage.classList.toggle('drop-target', isOverStorage(x, y));
      highlightFeedTarget(cropId, x, y);
    },
    end() {
      tileEl.style.opacity = '';
      setMarketHover(null, false);
      storage.classList.remove('drop-target');
      clearDropHighlight();
    },
    drop(x, y) {
      if (isOverMarket(x, y)) return sellCrop(index);
      if (isOverStorage(x, y)) return storeCrop(index);
      const i = tileIndexAt(x, y);
      if (i >= 0 && canAddFood(i, cropId)) return addFoodFromField(index, i);   // feed a pet
      return i >= 0 && feedFromField(index, i);   // feed a growing animal
    },
  });
}

/* ---------- Big animal: pen → Market (sell) or Storage (keep) ---------- */
function startAnimalDrag(tileEl, e) {
  const index = Number(tileEl.dataset.index);
  const tile = state.tiles[index];
  if (!isGrown(tile)) return;
  const storage = $('storage-window');
  tileEl.style.opacity = '0.35';
  const goodsId = CONFIG.animals[tile.animal.type].grownGoods;
  startIconDrag(e, tileEl, CONFIG.animals[tile.animal.type].grownIcon, {
    over(x, y) {
      setMarketHover(goodsId, isOverMarket(x, y));
      storage.classList.toggle('drop-target', isOverStorage(x, y));
      highlightFeedTarget(goodsId, x, y);   // a Butcher lights up
    },
    end() {
      tileEl.style.opacity = '';
      setMarketHover(null, false);
      storage.classList.remove('drop-target');
      clearDropHighlight();
    },
    drop(x, y) {
      if (isOverMarket(x, y)) return sellAnimal(index);
      if (isOverStorage(x, y)) return storeAnimal(index);
      const i = tileIndexAt(x, y);
      return i >= 0 && butcherFromField(index, i);
    },
  });
}

/* ---------- Pen product: pen → Storage, Market (Wool), or straight onto a tile ---------- */
// Fertilizer → a growing crop.  Baby Pig / Baby Sheep → an empty pen of its kind.
function startProductDrag(tileEl, e) {
  const index = Number(tileEl.dataset.index);
  const id = state.tiles[index].product;
  if (!id) return;
  const storage = $('storage-window');
  const sellable = !!goodsInfo(id);
  tileEl.style.opacity = '0.35';
  startIconDrag(e, tileEl, itemInfo(id).icon, {
    over(x, y) {
      clearDropHighlight();
      if (sellable) setMarketHover(id, isOverMarket(x, y));
      const onStorage = isOverStorage(x, y);
      storage.classList.toggle('drop-target', onStorage);
      const i = tileIndexAt(x, y);
      if (sellable) highlightFeedTarget(id, x, y);   // Wool → a Pet House
      else if (!onStorage && i >= 0 && i !== index) {
        $('field').children[i].classList.add(canUseItemOn(id, i) ? 'drop-ok' : 'drop-bad');
      }
    },
    end() {
      tileEl.style.opacity = '';
      clearDropHighlight();
      if (sellable) setMarketHover(null, false);
      storage.classList.remove('drop-target');
    },
    drop(x, y) {
      if (sellable && isOverMarket(x, y)) return sellProduct(index);
      if (isOverStorage(x, y)) return storeProduct(index);
      const i = tileIndexAt(x, y);
      if (i >= 0 && id === CONFIG.petHouse.fuel && canAddWool(i)) return addWoolFromPen(index, i);
      return i >= 0 && useProductOn(index, i);
    },
  });
}

/* ---------- Butcher output: → Market (sell all) or Storage (keep all) ---------- */
function startOutputDrag(tileEl, e) {
  const index = Number(tileEl.dataset.index);
  const out = state.tiles[index].output;
  if (!out) return;
  const storage = $('storage-window');
  tileEl.style.opacity = '0.35';
  startIconDrag(e, tileEl, goodsInfo(out.id).icon, {
    over(x, y) {
      setMarketHover(out.id, isOverMarket(x, y));
      storage.classList.toggle('drop-target', isOverStorage(x, y));
    },
    end() {
      tileEl.style.opacity = '';
      setMarketHover(null, false);
      storage.classList.remove('drop-target');
    },
    drop(x, y) {
      if (isOverMarket(x, y)) return sellOutput(index);
      if (isOverStorage(x, y)) return storeOutput(index);
      return false;
    },
  });
}

/* ---------- Stored things: Storage → Market (goods) or → a tile (Fertilizer, Baby Pig) ---------- */
function startStorageDrag(row, e) {
  const id = row.dataset.goods;
  if (goodsInfo(id)) {
    startIconDrag(e, row, goodsInfo(id).icon, {
      over(x, y) {
        setMarketHover(id, isOverMarket(x, y));
        highlightFeedTarget(id, x, y);
      },
      end() {
        setMarketHover(null, false);
        clearDropHighlight();
      },
      drop(x, y) {
        if (isOverMarket(x, y)) return sellFromStorage(id);
        const i = tileIndexAt(x, y);
        if (i < 0) return false;
        if (id === CONFIG.butcher.input && canButcher(i)) return butcherFromStorage(i);
        if (id === CONFIG.petHouse.fuel && canAddWool(i)) return addWoolFromStorage(i);
        if (canAddFood(i, id)) return addFoodFromStorage(i, id);
        return feedFromStorage(id, i);   // feed a growing animal
      },
    });
  } else {
    startTileItemDrag(row, e, itemInfo(id).icon,
      i => canUseItemOn(id, i), i => useFromStorage(id, i));
  }
}

/* ---------- Slot grids: touch swipe up/down scrolls, sideways drags ---------- */
// Mouse: drag starts at once (the wheel / scrollbar scrolls).
// Touch, when the grid has more than 20 slots: a mostly-vertical swipe scrolls
// the grid; any other move starts the drag.
function onSlotPointerDown(grid, item, e, startDrag) {
  if (e.pointerType === 'mouse' || grid.scrollHeight <= grid.clientHeight) {
    startDrag(item, e);
    return;
  }
  e.preventDefault();
  const x0 = e.clientX, y0 = e.clientY, scroll0 = grid.scrollTop;
  let mode = null;   // null (undecided) | 'scroll'
  item.setPointerCapture(e.pointerId);
  const cleanup = () => {
    item.removeEventListener('pointermove', onMove);
    item.removeEventListener('pointerup', cleanup);
    item.removeEventListener('pointercancel', cleanup);
  };
  const onMove = ev => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (mode === 'scroll') { grid.scrollTop = scroll0 - dy; return; }
    if (Math.hypot(dx, dy) < 8) return;
    if (Math.abs(dy) > Math.abs(dx) * 1.5) { mode = 'scroll'; grid.scrollTop = scroll0 - dy; return; }
    cleanup();
    startDrag(item, ev);
  };
  item.addEventListener('pointermove', onMove);
  item.addEventListener('pointerup', cleanup);
  item.addEventListener('pointercancel', cleanup);
}

/* =========================================================
   TILE MENU — click a crop, animal or building:
   Collect (to Storage) / Sell / Remove
   ========================================================= */
let menuTile = -1;     // tile the menu is open for, or -1
let menuKind = '';     // what it was opened for: 'crop' | 'animal' | 'product' | 'building'

// What the menu shows for a tile: { kind, icon, name, actions: [{ label, icon, why, run, remove }] }
// `why` is '' when the action can be used, otherwise the reason it is disabled.
function tileMenuSpec(i) {
  const tile = state.tiles[i];
  if (!tile || !tile.unlocked) return null;
  const noWarehouse = storageCapacity() === 0
    ? `Build a Warehouse first! ${CONFIG.buildings.warehouse.icon}` : '';

  if (tile.animal) {
    const a = CONFIG.animals[tile.animal.type];
    const grown = isGrown(tile);
    const notYet = grown ? '' : `Not grown up yet! ${a.icon}`;
    return {
      kind: 'animal', icon: grown ? a.grownIcon : a.icon,
      name: grown ? goodsInfo(a.grownGoods).name : a.name,
      actions: [
        { icon: '📦', label: 'Collect', why: notYet || noWarehouse, run: () => storeAnimal(i) },
        { icon: '🪙', label: 'Sell', why: notYet, run: () => sellAnimal(i) },
        { icon: '🗑️', label: 'Remove', why: '', remove: true, run: () => removeAnimal(i) },
      ],
    };
  }
  if (tile.product) {
    const p = itemInfo(tile.product);
    return {
      kind: 'product', icon: p.icon, name: p.name,
      actions: [
        { icon: '📦', label: 'Collect', why: noWarehouse, run: () => storeProduct(i) },
        { icon: '🪙', label: 'Sell', why: goodsInfo(tile.product) ? '' : `The Market doesn't buy ${p.name}`,
          run: () => sellProduct(i) },
        { icon: '🗑️', label: 'Remove', why: '', remove: true, run: () => { takeProduct(i); saveGame(); return true; } },
      ],
    };
  }
  if (tile.building && tile.building.type === 'petHouse') return petHouseMenuSpec(i);
  if (tile.building && tile.building.type === 'butcher') {
    const b = CONFIG.buildings.butcher, bc = CONFIG.butcher;
    const input = goodsInfo(bc.input), out = goodsInfo(bc.output);
    const remove = { icon: '🗑️', label: 'Remove', why: removeBuildingBlocker(i), remove: true, run: () => removeBuilding(i) };
    if (tile.output) {
      return {
        kind: 'butcher-done', icon: out.icon, name: `${out.name} ×${tile.output.count}`,
        actions: [
          { icon: '📦', label: 'Collect', why: noWarehouse, run: () => storeOutput(i) },
          { icon: '🪙', label: 'Sell all', why: '', run: () => sellOutput(i) },
          remove,
        ],
      };
    }
    if (tile.job) {
      const wait = `Ready in ${formatTime(tile.job.doneAt - gameNow())} ⏱️`;
      return {
        kind: 'butcher-busy', icon: b.icon, name: `${b.name} · working`,
        actions: [
          { icon: '📦', label: 'Collect', why: wait, run: () => false },
          { icon: '🪙', label: 'Sell', why: wait, run: () => false },
          remove,
        ],
      };
    }
    const have = state.storage[bc.input] || 0;
    return {
      kind: 'butcher', icon: b.icon, name: b.name,
      actions: [
        { icon: input.icon, label: `Use ${input.name} (${have})`,
          why: have ? '' : `No ${input.name} in Storage — drag one here from a pen`,
          run: () => butcherFromStorage(i) },
        remove,
      ],
    };
  }
  if (tile.building) {
    const b = CONFIG.buildings[tile.building.type];
    return {
      kind: 'building', icon: b.icon, name: b.name,
      actions: [
        { icon: '🗑️', label: 'Remove', why: removeBuildingBlocker(i), remove: true, run: () => removeBuilding(i) },
      ],
    };
  }
  if (tile.crop) {
    const c = CONFIG.crops[tile.crop.type];
    const ripe = isRipe(tile);
    const notYet = ripe ? '' : `Not ripe yet! ${c.seedlingIcon}`;
    return {
      kind: 'crop', icon: ripe ? c.ripeIcon : c.seedlingIcon, name: c.name,
      actions: [
        { icon: '📦', label: 'Collect', why: notYet || noWarehouse, run: () => storeCrop(i) },
        { icon: '🪙', label: 'Sell', why: notYet, run: () => sellCrop(i) },
        { icon: '🗑️', label: 'Remove', why: '', remove: true, run: () => removeCrop(i) },
      ],
    };
  }
  return null;
}

function removeCrop(i) {
  state.tiles[i].crop = null;
  renderTile(i);
  saveGame();
  return true;
}

function removeAnimal(i) {
  state.tiles[i].animal = null;   // the pen stops making things (updatePens)
  renderTile(i);
  saveGame();
  return true;
}

function closeTileMenu() {
  if (menuTile >= 0) $('field').children[menuTile].classList.remove('selected');
  menuTile = -1;
  menuKind = '';
  $('tile-menu').classList.remove('open');
}

function openTileMenu(i) {
  closeTileMenu();
  const spec = tileMenuSpec(i);
  if (!spec) return;
  menuTile = i;
  menuKind = spec.kind;
  $('field').children[i].classList.add('selected');
  drawTileMenu(spec);
  const menu = $('tile-menu');
  menu.classList.add('open');
  // Next to the tile: on its right, or on its left if there is no room.
  const r = $('field').children[i].getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  let x = r.right + 8;
  if (x + w > window.innerWidth - 8) x = r.left - w - 8;
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  const y = Math.max(8, Math.min(r.top, window.innerHeight - h - 8));
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

const menuSig = spec => JSON.stringify([spec.icon, spec.name, spec.actions.map(a => a.why)]);

function drawTileMenu(spec) {
  const menu = $('tile-menu');
  menu.dataset.sig = menuSig(spec);
  menu.innerHTML = `<div class="menu-title"><span class="icon">${spec.icon}</span><span>${spec.name}</span></div>`;
  spec.actions.forEach((act, n) => {
    const btn = document.createElement('button');
    btn.dataset.action = n;
    btn.className = (act.remove ? 'remove' : '') + (act.why ? ' off' : '');
    btn.setAttribute('aria-disabled', act.why ? 'true' : 'false');
    if (act.why) btn.title = act.why;
    btn.innerHTML = `<span>${act.icon}</span><span>${act.label}</span>`;
    menu.appendChild(btn);
  });
}

// Keep the menu up to date (a crop may ripen while it is open).
function refreshTileMenu() {
  if (menuTile < 0) return;
  const spec = tileMenuSpec(menuTile);
  if (!spec || spec.kind !== menuKind) { closeTileMenu(); return; }
  if ($('tile-menu').dataset.sig !== menuSig(spec)) drawTileMenu(spec);
}

function onTileMenuClick(e) {
  const btn = e.target.closest('button');
  if (!btn || menuTile < 0) return;
  const spec = tileMenuSpec(menuTile);
  const act = spec && spec.actions[Number(btn.dataset.action)];
  if (!act) return;
  if (act.why) { showToast(act.why); return; }   // disabled: say why
  // keepOpen: buttons you may tap several times in a row (e.g. Add Corn).
  if (act.run() && !act.keepOpen) closeTileMenu();
  else refreshTileMenu();
}

// Field press: a small move starts dragging (as before); a tap opens the menu.
function onFieldPointerDown(e) {
  const tileEl = e.target.closest('.tile');
  if (!tileEl) return;
  e.preventDefault();
  const index = Number(tileEl.dataset.index);
  const x0 = e.clientX, y0 = e.clientY;
  tileEl.setPointerCapture(e.pointerId);
  const cleanup = () => {
    tileEl.removeEventListener('pointermove', onMove);
    tileEl.removeEventListener('pointerup', onUp);
    tileEl.removeEventListener('pointercancel', cleanup);
  };
  const onMove = ev => {
    if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
    cleanup();
    closeTileMenu();
    const tile = state.tiles[index];
    if (tile.animal) startAnimalDrag(tileEl, ev);
    else if (tile.product) startProductDrag(tileEl, ev);
    else if (tile.output) startOutputDrag(tileEl, ev);
    else startHarvestDrag(tileEl, ev);
  };
  const onUp = () => {
    cleanup();
    if (menuTile === index) closeTileMenu();
    else openTileMenu(index);
  };
  tileEl.addEventListener('pointermove', onMove);
  tileEl.addEventListener('pointerup', onUp);
  tileEl.addEventListener('pointercancel', cleanup);
}

