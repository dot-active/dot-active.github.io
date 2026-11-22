/* =========================================================
   INPUT
   ========================================================= */
function onToolClick(toolId) {
  if (!state.tools[toolId]) return;
  if (toolId === 'shop') openWindow($('shop-window'), 'right');
  if (toolId === 'market') openWindow($('market-window'), 'left');
  if (toolId === 'build') openWindow($('build-window'), 'right', 330);
  if (toolId === 'storage') openWindow($('storage-window'), 'left', 280);
  if (toolId === 'pets') openWindow($('pets-window'), 'right', 120);
}

function setupInput() {
  // Shop window: drag by title, close button, drag seeds out of it.
  const shop = $('shop-window');
  makeWindowDraggable(shop);
  $('shop-close').addEventListener('click', () => closeWindow(shop));
  $('shop-items').addEventListener('pointerdown', e => {
    const item = e.target.closest('.shop-item');
    if (item) onSlotPointerDown($('shop-items'), item, e, startShopDrag);
  });
  function startShopDrag(item, e) {
    if (item.dataset.crop) startSeedDrag(item, e);
    else if (item.dataset.animal) {
      const type = item.dataset.animal;
      startTileItemDrag(item, e, CONFIG.animals[type].icon,
        i => canPlaceAnimal(type, i), i => placeAnimal(type, i));
    }
    else if (item.dataset.item === 'fertilizer')
      startTileItemDrag(item, e, CONFIG.fertilizer.icon, canFertilize, useFertilizer);
    else if (item.dataset.item === 'newLand')
      startTileItemDrag(item, e, CONFIG.newLand.icon, canUnlockLand, unlockLand);
    else if (item.dataset.item === 'petEgg')
      startEggDrag(item, e);
  }

  // Market window: drag by title, close button.
  const market = $('market-window');
  makeWindowDraggable(market);
  $('market-close').addEventListener('click', () => closeWindow(market));

  // Build window: drag by title, close button, drag buildings out of it.
  const build = $('build-window');
  makeWindowDraggable(build);
  $('build-close').addEventListener('click', () => closeWindow(build));
  $('build-items').addEventListener('pointerdown', e => {
    const item = e.target.closest('.shop-item');
    if (item) onSlotPointerDown($('build-items'), item, e, startBuildDrag);
  });

  // Storage window: drag by title, close button, drag goods out to the Market.
  const storage = $('storage-window');
  makeWindowDraggable(storage);
  $('storage-close').addEventListener('click', () => closeWindow(storage));
  $('storage-items').addEventListener('pointerdown', e => {
    const row = e.target.closest('.storage-row');
    if (row) onSlotPointerDown($('storage-items'), row, e, startStorageDrag);
  });

  // Field: tap a tile for its menu; drag ripe crops (to the Market or Storage)
  // and big animals / pen products (to Storage).
  $('field').addEventListener('pointerdown', onFieldPointerDown);

  // Tile menu: buttons; a press anywhere else closes it.
  $('tile-menu').addEventListener('click', onTileMenuClick);
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('#tile-menu') && !e.target.closest('#field .tile')) closeTileMenu();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTileMenu(); });

  // Pets window: drag by title, close button, rename a pet; hatch card button.
  const pets = $('pets-window');
  makeWindowDraggable(pets);
  $('pets-close').addEventListener('click', () => closeWindow(pets));
  $('pets-list').addEventListener('click', e => {
    const btn = e.target.closest('.pet-rename');
    if (btn) renamePet(btn.dataset.pet);
  });
  $('hatch-ok').addEventListener('click', closeHatchCard);

  window.addEventListener('resize', () => {
    closeTileMenu();
    [shop, market, build, storage, pets].forEach(win => {
      if (win.classList.contains('open')) placeWindow(win, win.offsetLeft, win.offsetTop);
    });
  });

  // Footer buttons (pointer events work for mouse and touch).
  $('toolbar').addEventListener('pointerup', e => {
    const btn = e.target.closest('.tool-btn');
    if (btn && !btn.disabled) onToolClick(btn.dataset.tool);
  });

  // Debug fast mode.
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === CONFIG.debugKey) toggleDebug();
  });

  // Save when the page is hidden or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { gameNow(); saveGame(); }
  });
  window.addEventListener('pagehide', () => { gameNow(); saveGame(); });
}

/* =========================================================
   START
   ========================================================= */
function init() {
  state = loadGame() || newGameState();
  migratePens();
  renderAll();
  setupInput();
  tick();
  saveGame();
  setInterval(tick, CONFIG.tickMs);
  setInterval(() => { gameNow(); saveGame(); }, CONFIG.saveEveryMs);
}

init();
