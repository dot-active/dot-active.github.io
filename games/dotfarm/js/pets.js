/* =========================================================
   PETS — buy a Pet Egg, put it in a Pet House, add Wool:
   after 10 minutes it may hatch into a random species
   with random stats.
   ========================================================= */

// 10 points in every stat, then 50 points handed out one at a time
// to a random stat — so the total is always 100.
function randomPetStats() {
  const { stats, baseEach, randomPoints } = CONFIG.pets;
  const out = {};
  stats.forEach(s => { out[s.id] = baseEach; });
  for (let n = 0; n < randomPoints; n++) {
    const s = stats[Math.floor(Math.random() * stats.length)];
    out[s.id] += 1;
  }
  return out;
}

// "Clanker", then "Clanker 2", "Clanker 3", ... for more of the same species.
function newPetName(speciesId) {
  const base = CONFIG.pets.species[speciesId].name;
  const taken = new Set(state.pets.map(p => p.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// A new pet of a random species joins your pets.
function createPet() {
  const ids = Object.keys(CONFIG.pets.species);
  const species = ids[Math.floor(Math.random() * ids.length)];
  const pet = {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    species,
    name: newPetName(species),
    stats: randomPetStats(),
    hatchedAt: gameNow(),
  };
  state.pets.push(pet);
  renderPets();
  showHatchCard(pet);
  saveGame();
  return pet;
}

/* ---------- Pet House: egg + Wool → maybe a pet ---------- */
const isPetHouse = i => {
  const t = state.tiles[i];
  return !!t && !!t.building && t.building.type === 'petHouse';
};
// An egg can go into an empty Pet House.
const canPlaceEgg = i => isPetHouse(i) && !state.tiles[i].egg;
// Wool can go into a Pet House that holds an egg that is not warm yet.
const canAddWool = i => isPetHouse(i) && state.tiles[i].egg && !state.tiles[i].incubate;

// Buy an egg straight into a Pet House. Returns true if it worked.
function placeEgg(i) {
  if (!canPlaceEgg(i)) return false;
  const price = CONFIG.petEgg.price;
  if (state.coins < price) {
    showToast('Not enough coins! 🪙');
    return false;
  }
  state.coins -= price;
  state.tiles[i].egg = true;
  renderCoins();
  renderTile(i);
  renderPets();
  const fuel = goodsInfo(CONFIG.petHouse.fuel);
  showToast(`${CONFIG.petEgg.icon} In the Pet House! Add ${fuel.icon} ${fuel.name} to warm it`);
  saveGame();
  return true;
}

function startIncubating(i) {
  state.tiles[i].incubate = { doneAt: gameNow() + CONFIG.petHouse.incubateMs };
  renderTile(i);
  showToast(`${goodsInfo(CONFIG.petHouse.fuel).icon} The egg is warm…`);
  saveGame();
}

// One Wool from Storage.
function addWoolFromStorage(i) {
  const id = CONFIG.petHouse.fuel;
  if (!(state.storage[id] > 0) || !canAddWool(i)) return false;
  state.storage[id] -= 1;
  if (state.storage[id] === 0) delete state.storage[id];
  renderStorage();
  startIncubating(i);
  return true;
}

// Wool dragged straight from an animal pen.
function addWoolFromPen(penIndex, i) {
  if (state.tiles[penIndex].product !== CONFIG.petHouse.fuel || !canAddWool(i)) return false;
  takeProduct(penIndex);
  startIncubating(i);
  return true;
}

// Throw the egg away (only while it is not being warmed).
function discardEgg(i) {
  if (!isPetHouse(i) || !state.tiles[i].egg || state.tiles[i].incubate) return false;
  state.tiles[i].egg = false;
  renderTile(i);
  renderPets();
  saveGame();
  return true;
}

// Runs every tick: when the Wool is used up, the egg hatches (hatchChance)
// or stays, waiting for more Wool. Returns true if something changed.
function updatePetHouses(now) {
  let changed = false;
  state.tiles.forEach((t, i) => {
    if (!t.incubate || now < t.incubate.doneAt) return;
    t.incubate = null;
    if (Math.random() < CONFIG.petHouse.hatchChance) {
      t.egg = false;
      renderTile(i);
      createPet();
    } else {
      renderTile(i);
      const fuel = goodsInfo(CONFIG.petHouse.fuel);
      showToast(`${CONFIG.petEgg.icon} Not yet… the ${fuel.name} is used up. Add more ${fuel.icon}!`);
    }
    changed = true;
  });
  return changed;
}

// Tile menu for a Pet House (see tileMenuSpec in ui.js).
function petHouseMenuSpec(i) {
  const t = state.tiles[i], house = CONFIG.buildings.petHouse;
  const egg = CONFIG.petEgg, fuel = goodsInfo(CONFIG.petHouse.fuel);
  const remove = { icon: '🗑️', label: 'Remove', why: removeBuildingBlocker(i), remove: true, run: () => removeBuilding(i) };
  const chance = Math.round(CONFIG.petHouse.hatchChance * 100);
  if (t.incubate) {
    const wait = `${chance}% chance to hatch in ${formatTime(t.incubate.doneAt - gameNow())} ⏱️`;
    return {
      kind: 'petHouse-warm', icon: egg.icon, name: `${egg.name} · warming`,
      actions: [{ icon: '⏱️', label: formatTime(t.incubate.doneAt - gameNow()), why: wait, run: () => false }, remove],
    };
  }
  if (t.egg) {
    const have = state.storage[CONFIG.petHouse.fuel] || 0;
    return {
      kind: 'petHouse-egg', icon: egg.icon, name: egg.name,
      actions: [
        { icon: fuel.icon, label: `Add ${fuel.name} (${have})`,
          why: have ? '' : `No ${fuel.name} in Storage — drag one here from a pen`,
          run: () => addWoolFromStorage(i) },
        { icon: '🗑️', label: 'Throw egg away', why: '', remove: true, run: () => discardEgg(i) },
        remove,
      ],
    };
  }
  return {
    kind: 'petHouse', icon: house.icon, name: house.name,
    actions: [
      { icon: egg.icon, label: 'Add an egg', why: `Buy a ${egg.icon} ${egg.name} in the Shop and drag it here`, run: () => false },
      remove,
    ],
  };
}

function renamePet(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  const name = (window.prompt('New name for your pet:', pet.name) || '').trim().slice(0, 16);
  if (!name) return;
  pet.name = name;
  renderPets();
  saveGame();
}

/* ---------- Drawing ---------- */
const escapeHtml = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The pet picture: species emoji + its accessory on top.
function petArtHtml(speciesId) {
  const sp = CONFIG.pets.species[speciesId];
  const acc = sp.accessory ? `<span class="pet-acc acc-${sp.accessorySpot}">${sp.accessory}</span>` : '';
  return `<span class="pet-art pet-${speciesId}"><span class="pet-base">${sp.icon}</span>${acc}</span>`;
}

// Name, species and the five stat bars.
function petCardHtml(pet, { rename = false } = {}) {
  const sp = CONFIG.pets.species[pet.species];
  const { stats, baseEach, randomPoints } = CONFIG.pets;
  const max = baseEach + randomPoints;          // the highest a stat can start at
  const total = stats.reduce((s, st) => s + (pet.stats[st.id] || 0), 0);
  const rows = stats.map(st => {
    const v = pet.stats[st.id] || 0;
    return `<div class="stat-row">
        <span class="stat-name">${st.icon} ${st.name}</span>
        <span class="stat-bar"><span style="width:${Math.min(100, v / max * 100)}%"></span></span>
        <span class="stat-val">${v}</span>
      </div>`;
  }).join('');
  return `<div class="pet-card">
      <div class="pet-head">
        ${petArtHtml(pet.species)}
        <div class="pet-names">
          <div class="pet-name">${escapeHtml(pet.name)}${rename
            ? ` <button class="pet-rename" data-pet="${pet.id}" aria-label="Rename" title="Rename">✏️</button>` : ''}</div>
          <div class="pet-kind">${sp.kind}</div>
          <div class="pet-total">Total ${total}</div>
        </div>
      </div>
      <div class="pet-stats">${rows}</div>
    </div>`;
}

function renderPets() {
  const list = $('pets-list');
  list.innerHTML = state.pets.slice().reverse().map(p => petCardHtml(p, { rename: true })).join('');
  const egg = CONFIG.petEgg, house = CONFIG.buildings.petHouse, fuel = goodsInfo(CONFIG.petHouse.fuel);
  const how = `Build a ${house.icon} ${house.name}, put a ${egg.icon} ${egg.name} in it,<br>then add ${fuel.icon} ${fuel.name}: ${Math.round(CONFIG.petHouse.hatchChance * 100)}% chance to hatch after ${Math.round(CONFIG.petHouse.incubateMs / 60000)} min.`;
  $('pets-hint').innerHTML = state.pets.length === 0
    ? `No pets yet!<br>${how}`
    : `${state.pets.length} pet${state.pets.length > 1 ? 's' : ''} · ${how}`;
}

// Several eggs can hatch at once (e.g. after the page was closed): show them one by one.
const hatchQueue = [];
function showHatchCard(pet) {
  hatchQueue.push(pet);
  if (!$('hatch-overlay').classList.contains('open')) showNextHatch();
}
function showNextHatch() {
  const pet = hatchQueue.shift();
  if (!pet) { $('hatch-overlay').classList.remove('open'); return; }
  $('hatch-pet').innerHTML = petCardHtml(pet);
  $('hatch-overlay').classList.add('open');
}
function closeHatchCard() {
  showNextHatch();
}

/* ---------- Dragging an egg out of the Shop ---------- */
// It can only go into an empty Pet House.
function startEggDrag(item, e) {
  startIconDrag(e, item, CONFIG.petEgg.icon, {
    over(x, y) {
      clearDropHighlight();
      const i = tileIndexAt(x, y);
      if (i >= 0) $('field').children[i].classList.add(canPlaceEgg(i) ? 'drop-ok' : 'drop-bad');
    },
    end: clearDropHighlight,
    drop(x, y) {
      const i = tileIndexAt(x, y);
      if (i < 0) return false;
      if (!canPlaceEgg(i)) {
        const house = CONFIG.buildings.petHouse;
        showToast(isPetHouse(i) ? `This ${house.name} already has an egg` : `Put the egg in a ${house.icon} ${house.name}!`);
        return false;
      }
      return placeEgg(i);
    },
  });
}
