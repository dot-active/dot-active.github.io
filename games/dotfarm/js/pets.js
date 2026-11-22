/* =========================================================
   PETS — buy a Pet Egg, drag it onto the field, it hatches
   into a random species with random stats.
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

// Pay for an egg and hatch it. Returns true if it worked.
function hatchEgg() {
  const price = CONFIG.petEgg.price;
  if (state.coins < price) {
    showToast('Not enough coins! 🪙');
    return false;
  }
  state.coins -= price;
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
  renderCoins();
  renderPets();
  showHatchCard(pet);
  saveGame();
  return true;
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
  const egg = CONFIG.petEgg;
  $('pets-hint').innerHTML = state.pets.length === 0
    ? `No pets yet! Buy a ${egg.icon} ${egg.name} in the Shop<br>and drag it here or onto your field to hatch it.`
    : `${state.pets.length} pet${state.pets.length > 1 ? 's' : ''} · drag a ${egg.icon} here to hatch another`;
}

function showHatchCard(pet) {
  $('hatch-pet').innerHTML = petCardHtml(pet);
  $('hatch-overlay').classList.add('open');
}
function closeHatchCard() {
  $('hatch-overlay').classList.remove('open');
}

/* ---------- Dragging an egg out of the Shop ---------- */
const isOverPets = (x, y) => isOverWindow('pets-window', x, y);

// Drop it into the Pets window or anywhere on the field to hatch it.
function startEggDrag(item, e) {
  const pets = $('pets-window');
  startIconDrag(e, item, CONFIG.petEgg.icon, {
    over(x, y) {
      clearDropHighlight();
      pets.classList.toggle('drop-target', isOverPets(x, y));
      const i = tileIndexAt(x, y);
      if (i >= 0) $('field').children[i].classList.add('drop-ok');
    },
    end() {
      clearDropHighlight();
      pets.classList.remove('drop-target');
    },
    drop(x, y) {
      if (isOverPets(x, y) || tileIndexAt(x, y) >= 0) return hatchEgg();
      return false;
    },
  });
}
