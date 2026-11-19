/* =========================================================
   FARMING ACTIONS
   ========================================================= */
// A seed (or a building) can go only on an unlocked tile with nothing on it.
function canPlantOn(index) {
  const tile = state.tiles[index];
  return !!tile && tile.unlocked && !tile.crop && !tile.building;
}

// Returns true if planting worked.
function plantSeed(cropId, index) {
  const price = CONFIG.crops[cropId].seedPrice;
  if (!canPlantOn(index)) return false;
  if (state.coins < price) {
    showToast('Not enough coins! 🪙');
    return false;
  }
  state.coins -= price;
  state.tiles[index].crop = { type: cropId, plantedAt: gameNow() };
  renderCoins();
  renderTile(index);
  saveGame();
  return true;
}

// Fertilizer works only on a crop that is still growing.
function canFertilize(index) {
  const tile = state.tiles[index];
  return !!tile && !!tile.crop && !isRipe(tile);
}

// Returns true if fertilizing worked (the fertilizer is used up).
// free = true for fertilizer the player already owns (made by a pigpen).
function useFertilizer(index, free = false) {
  const f = CONFIG.fertilizer;
  if (!canFertilize(index)) return false;
  if (!free && state.coins < f.price) {
    showToast('Not enough coins! 🪙');
    return false;
  }
  if (!free) state.coins -= f.price;
  // Planting "earlier" makes it ripen earlier.
  state.tiles[index].crop.plantedAt -= f.timeSavedMs;
  renderCoins();
  renderTile(index);
  saveGame();
  return true;
}

// The other tile of a 2-tile building (a pigpen's production tile), or -1.
function partnerIndex(index) {
  const b = state.tiles[index].building;
  if (!b) return -1;
  return state.tiles.findIndex((t, j) => j !== index && t.building && t.building.anchor === b.anchor);
}

// The pen tile for a dropped pig: the pen's first tile (the pig tile).
// Dropping on either tile of the pen works. Returns -1 if there is no room.
function animalSpot(type, index) {
  const tile = state.tiles[index];
  if (!tile || !tile.building || tile.building.type !== CONFIG.animals[type].home) return -1;
  const spot = tile.building.anchor;
  return state.tiles[spot].animal ? -1 : spot;   // a pen holds only 1 animal
}
function canPlaceAnimal(type, index) {
  return animalSpot(type, index) >= 0;
}

// Returns true if the animal was placed.
// free = true for a baby the player already owns (made by a pigpen).
function placeAnimal(type, index, free = false) {
  const a = CONFIG.animals[type];
  const spot = animalSpot(type, index);
  if (spot < 0) return false;
  if (!free && state.coins < a.price) {
    showToast('Not enough coins! 🪙');
    return false;
  }
  if (!free) state.coins -= a.price;
  state.tiles[spot].animal = { type, bornAt: gameNow() };
  // The pen's second tile starts making something (unless it is still holding one).
  const p = partnerIndex(spot);
  if (p >= 0 && !state.tiles[p].product) state.tiles[p].produceAt = nextProduceTime(gameNow());
  renderCoins();
  renderTile(spot);
  if (p >= 0) renderTile(p);
  saveGame();
  return true;
}

/* ---------- Items you own (from Storage or a pigpen), used on a tile ---------- */
function canUseItemOn(id, index) {
  if (id === 'fertilizer') return canFertilize(index);
  if (CONFIG.animals[id]) return canPlaceAnimal(id, index);
  return false;
}
function useItemOn(id, index) {
  if (id === 'fertilizer') return useFertilizer(index, true);
  if (CONFIG.animals[id]) return placeAnimal(id, index, true);
  return false;
}

/* ---------- Pigpen production ---------- */
// A random moment between produceMinMs and produceMaxMs from now.
function nextProduceTime(now) {
  const { produceMinMs: min, produceMaxMs: max } = CONFIG.pigpen;
  return now + min + Math.random() * (max - min);
}

// Runs every tick. Returns true if something changed (so we save).
function updatePens(now) {
  let changed = false;
  state.tiles.forEach((tile, i) => {
    if (!tile.building || tile.building.type !== 'pigpen' || tile.building.anchor === i) return;
    const pig = state.tiles[tile.building.anchor].animal;
    if (!pig || tile.product) {
      // No pig, or the last thing was not collected yet: nothing is made.
      if (tile.produceAt != null) { tile.produceAt = null; changed = true; }
      return;
    }
    if (tile.produceAt == null) { tile.produceAt = nextProduceTime(now); changed = true; return; }
    if (now >= tile.produceAt) {
      tile.product = Math.random() < CONFIG.pigpen.babyPigChance ? 'pig' : 'fertilizer';
      tile.produceAt = null;
      changed = true;
    }
  });
  return changed;
}

// Pick up what a pigpen made: it leaves the tile and production starts again.
function takeProduct(index) {
  const tile = state.tiles[index];
  tile.product = null;
  const pig = state.tiles[tile.building.anchor].animal;
  tile.produceAt = pig ? nextProduceTime(gameNow()) : null;
  renderTile(index);
}

// Put what a pigpen made into Storage.
function storeProduct(index) {
  const id = state.tiles[index].product;
  if (!id || !roomInStorage(id)) return false;
  state.storage[id] = (state.storage[id] || 0) + 1;
  takeProduct(index);
  renderStorage();
  showToast(`${itemInfo(id).icon} Stored!`);
  saveGame();
  return true;
}

// Use what a pigpen made straight away on another tile.
function useProductOn(fromIndex, toIndex) {
  const id = state.tiles[fromIndex].product;
  if (!id || fromIndex === toIndex || !canUseItemOn(id, toIndex)) return false;
  takeProduct(fromIndex);
  useItemOn(id, toIndex);
  saveGame();
  return true;
}

// Use one item from Storage on a tile.
function useFromStorage(id, index) {
  if (!(state.storage[id] > 0) || !canUseItemOn(id, index)) return false;
  state.storage[id] -= 1;
  if (state.storage[id] === 0) delete state.storage[id];
  useItemOn(id, index);
  renderStorage();
  saveGame();
  return true;
}

// Old saves let pigs stand on either pen tile; now only the first tile holds one.
// Old saves may also hold Pork (removed): every 5 pork (rounded up) becomes 1 Big Pig.
function migratePens() {
  if (state.storage.pork > 0) {
    state.storage.bigPig = (state.storage.bigPig || 0) + Math.ceil(state.storage.pork / 5);
  }
  delete state.storage.pork;
  delete state.market.prices.pork;
  delete state.market.change.pork;
  state.tiles.forEach((tile, i) => {
    if (!tile.animal || !tile.building || tile.building.anchor === i) return;
    const anchor = state.tiles[tile.building.anchor];
    if (!anchor.animal) {
      anchor.animal = tile.animal;            // move it to the pig tile
    } else {
      state.storage[tile.animal.type] = (state.storage[tile.animal.type] || 0) + 1; // keep it as a baby
    }
    tile.animal = null;
  });
}

/* ---------- Feeding ---------- */
// Can this food be fed to the animal on this tile? (It must still be growing.)
function canFeed(foodId, index) {
  const tile = state.tiles[index];
  if (!tile || !tile.animal || isGrown(tile)) return false;
  return CONFIG.animals[tile.animal.type].food === foodId;
}

// Feed the animal: it grows up earlier. The caller removes the food.
function feedAnimal(index) {
  const tile = state.tiles[index];
  tile.animal.bornAt -= CONFIG.animals[tile.animal.type].feedTimeSavedMs;
  renderTile(index);
  showToast(`${CONFIG.animals[tile.animal.type].icon} Yum!`);
}

// Feed with the ripe crop on another tile (the crop is used up).
function feedFromField(cropIndex, animalIndex) {
  const crop = state.tiles[cropIndex];
  if (!isRipe(crop) || !canFeed(crop.crop.type, animalIndex)) return false;
  crop.crop = null;
  renderTile(cropIndex);
  feedAnimal(animalIndex);
  saveGame();
  return true;
}

// Feed with one item from Storage.
function feedFromStorage(foodId, animalIndex) {
  if (!(state.storage[foodId] > 0) || !canFeed(foodId, animalIndex)) return false;
  state.storage[foodId] -= 1;
  if (state.storage[foodId] === 0) delete state.storage[foodId];
  renderStorage();
  feedAnimal(animalIndex);
  saveGame();
  return true;
}

// While dragging food: green on an animal that can eat it, red on one that can't.
function highlightFeedTarget(foodId, x, y) {
  clearDropHighlight();
  const i = tileIndexAt(x, y);
  if (i >= 0 && state.tiles[i].animal) {
    $('field').children[i].classList.add(canFeed(foodId, i) ? 'drop-ok' : 'drop-bad');
  }
}

// Like isRipe, worked out from the timestamp.
function isGrown(tile, now = gameNow()) {
  if (!tile || !tile.animal) return false;
  return now - tile.animal.bornAt >= CONFIG.animals[tile.animal.type].growTimeMs;
}

// New Land works only on a locked tile.
function canUnlockLand(index) {
  const tile = state.tiles[index];
  return !!tile && !tile.unlocked;
}

// Returns true if the tile was unlocked.
function unlockLand(index) {
  const price = CONFIG.newLand.price;
  if (!canUnlockLand(index)) return false;
  if (state.coins < price) {
    showToast('Not enough coins! 🪙');
    return false;
  }
  state.coins -= price;
  state.tiles[index].unlocked = true;
  renderCoins();
  renderTile(index);
  showToast('🚜 New land is ready!');
  saveGame();
  return true;
}

// Ripeness is worked out from the timestamp, so it is correct even
// after the page was closed for a while.
function isRipe(tile, now = gameNow()) {
  if (!tile || !tile.crop) return false;
  return now - tile.crop.plantedAt >= CONFIG.crops[tile.crop.type].growTimeMs;
}

// Add coins for one item at the current Market price.
function earnFromSale(cropId) {
  const price = state.market.prices[cropId];
  state.coins += price;
  renderCoins();
  showToast(`Sold for 🪙 ${price}!`);
}

// Sell the ripe crop on a tile at the current Market price.
function sellCrop(index) {
  const tile = state.tiles[index];
  if (!isRipe(tile)) return false;
  earnFromSale(tile.crop.type);
  tile.crop = null;
  renderTile(index);
  saveGame();
  return true;
}

/* =========================================================
   STORAGE
   ========================================================= */
// Number of Warehouses on the field (a building is counted once, on its anchor tile).
function warehouseCount() {
  return state.tiles.filter((t, i) => t.building && t.building.type === 'warehouse' && t.building.anchor === i).length;
}
function storageCapacity() {
  return warehouseCount() * CONFIG.storage.slotsPerWarehouse;
}
// Slots the stored things take: each kind fills ceil(count / stackSize) slots.
function storageSlotsUsed(storage = state.storage) {
  return Object.values(storage).reduce((sum, n) => sum + (n > 0 ? Math.ceil(n / CONFIG.storage.stackSize) : 0), 0);
}
// [[id, countInThisSlot], ...] — one entry per slot.
function storageStacks() {
  const stacks = [];
  Object.entries(state.storage).forEach(([id, n]) => {
    if (!(n > 0) || !itemInfo(id)) return;
    for (let left = n; left > 0; left -= CONFIG.storage.stackSize) {
      stacks.push([id, Math.min(left, CONFIG.storage.stackSize)]);
    }
  });
  return stacks;
}
// Is there room for one more `id`? Shows a toast if not.
function roomInStorage(id) {
  if (storageCapacity() === 0) {
    showToast(`Build a Warehouse first! ${CONFIG.buildings.warehouse.icon}`);
    return false;
  }
  const after = { ...state.storage, [id]: (state.storage[id] || 0) + 1 };
  if (storageSlotsUsed(after) > storageCapacity()) {
    showToast('Storage is full! 📦');
    return false;
  }
  return true;
}

// Move the ripe crop on a tile into Storage.
function storeCrop(index) {
  const tile = state.tiles[index];
  if (!isRipe(tile)) return false;
  const type = tile.crop.type;
  if (!roomInStorage(type)) return false;
  state.storage[type] = (state.storage[type] || 0) + 1;
  tile.crop = null;
  renderTile(index);
  renderStorage();
  showToast(`${CONFIG.crops[type].ripeIcon} Stored!`);
  saveGame();
  return true;
}

// Move a big animal into Storage (it is kept as goods, e.g. a Big Pig).
function storeAnimal(index) {
  const tile = state.tiles[index];
  if (!isGrown(tile)) return false;
  const id = CONFIG.animals[tile.animal.type].grownGoods;
  if (!roomInStorage(id)) return false;
  state.storage[id] = (state.storage[id] || 0) + 1;
  tile.animal = null;
  renderTile(index);
  renderStorage();
  showToast(`${goodsInfo(id).icon} Stored!`);
  saveGame();
  return true;
}

// Sell a big animal straight from its pen at the current Market price.
function sellAnimal(index) {
  const tile = state.tiles[index];
  if (!isGrown(tile)) return false;
  earnFromSale(CONFIG.animals[tile.animal.type].grownGoods);
  tile.animal = null;
  renderTile(index);
  saveGame();
  return true;
}

// Sell one stored item at the current Market price.
function sellFromStorage(cropId) {
  if (!(state.storage[cropId] > 0)) return false;
  state.storage[cropId] -= 1;
  if (state.storage[cropId] === 0) delete state.storage[cropId];
  earnFromSale(cropId);
  renderStorage();
  saveGame();
  return true;
}

/* =========================================================
   BUILDING
   ========================================================= */
// Neighbour of a tile in a direction, or -1 if it is off the field.
function neighbourIndex(index, dCol, dRow) {
  const { col, row } = state.tiles[index];
  const c = col + dCol, r = row + dRow;
  if (c < 0 || c >= CONFIG.fieldColumns || r < 0 || r >= CONFIG.fieldRows) return -1;
  return r * CONFIG.fieldColumns + c;
}

// The tiles a building would use if dropped on `index`, or null if it does not fit.
// A 2-tile building tries the tile to the right, then left, then below, then above.
function findBuildSpot(type, index) {
  if (!canPlantOn(index)) return null;
  if (CONFIG.buildings[type].size === 1) return [index];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dc, dr] of dirs) {
    const n = neighbourIndex(index, dc, dr);
    if (n >= 0 && canPlantOn(n)) return [index, n].sort((a, b) => a - b);
  }
  return null;
}

// Returns true if building worked.
function placeBuilding(type, index) {
  const spot = findBuildSpot(type, index);
  if (!spot) return false;
  const b = CONFIG.buildings[type];
  if (state.coins < b.cost) {
    showToast('Not enough coins! 🪙');
    return false;
  }
  state.coins -= b.cost;
  spot.forEach(i => { state.tiles[i].building = { type, anchor: spot[0] }; });
  renderCoins();
  spot.forEach(renderTile);
  if (type === 'warehouse') renderStorage();
  showToast(`${b.icon} ${b.name} built!`);
  saveGame();
  return true;
}

// Why a building can't be removed right now, or '' if it can.
function removeBuildingBlocker(index) {
  const b = state.tiles[index].building;
  if (b.type === 'pigpen') {
    const p = partnerIndex(b.anchor);
    if (state.tiles[b.anchor].animal || (p >= 0 && state.tiles[p].product)) {
      return 'Empty the Pigpen first! 🐷';
    }
  }
  if (b.type === 'warehouse') {
    const free = storageCapacity() - storageSlotsUsed();
    const need = CONFIG.storage.slotsPerWarehouse;
    if (free < need) return `Storage needs ${need} empty slots first! 📦`;
  }
  return '';
}

// Remove a building (all its tiles). No refund.
function removeBuilding(index) {
  const b = state.tiles[index].building;
  if (!b || removeBuildingBlocker(index)) return false;
  const anchor = b.anchor;
  state.tiles.forEach((t, i) => {
    if (t.building && t.building.anchor === anchor) {
      t.building = null;
      t.product = null;
      t.produceAt = null;
      renderTile(i);
    }
  });
  if (b.type === 'warehouse') renderStorage();
  showToast(`${CONFIG.buildings[b.type].icon} ${CONFIG.buildings[b.type].name} removed`);
  saveGame();
  return true;
}

/* =========================================================
   MARKET PRICES
   ========================================================= */
function randomPrice(base) {
  const swing = CONFIG.market.priceSwing;
  const factor = 1 + (Math.random() * 2 - 1) * swing;   // 0.7 .. 1.3
  return Math.max(1, Math.round(base * factor));
}

// Change prices if one or more update periods have passed.
// Returns true if prices changed.
function updatePrices(now) {
  const m = state.market;
  const every = CONFIG.market.priceUpdateMs;
  if (now - m.lastUpdate < every) return false;
  // Only one change, even if the page was closed for many periods.
  m.lastUpdate = now - ((now - m.lastUpdate) % every);
  goodsList().forEach(([id, g]) => {
    const old = m.prices[id];
    m.prices[id] = randomPrice(g.basePrice);
    m.change[id] = Math.sign(m.prices[id] - old);
  });
  return true;
}

/* =========================================================
   GAME LOOP — runs every CONFIG.tickMs
   ========================================================= */
function tick() {
  const now = gameNow();

  // Crops: redraw tiles (renderTile only touches the DOM if the icon changed)
  // and unlock the Market when the first crop is ripe.
  let anyRipe = false;
  state.tiles.forEach((tile, i) => {
    renderTile(i);
    if (isRipe(tile, now)) anyRipe = true;
  });
  if (anyRipe && !state.tools.market) {
    state.tools.market = true;
    renderToolbar();
    showToast('💰 The Market is open!');
    saveGame();
  }

  if (updatePrices(now)) {
    renderMarket();
    saveGame();
  }

  // Pigpens: make Fertilizer / Baby Pigs, then redraw.
  if (updatePens(now)) {
    state.tiles.forEach((t, i) => renderTile(i));
    saveGame();
  }

  refreshTileMenu();
}

