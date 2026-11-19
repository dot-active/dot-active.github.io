/* =========================================================
   CONFIG — all game numbers live here. Change them freely!
   ========================================================= */
const CONFIG = {
  // --- Field ---
  fieldColumns: 10,      // number of tile columns
  fieldRows: 5,          // number of tile rows

  // Tiles that are available (not locked) at the very start.
  // A rectangle: top-left corner (col,row), counted from 0, plus its size.
  // The two left-most columns: 2 wide x 5 tall = 10 tiles.
  startArea: { col: 0, row: 0, width: 2, height: 5 },

  // --- Money ---
  startCoins: 100,       // coins a new player starts with

  // --- Crops ---
  crops: {
    corn: {
      seedName: 'Corn Seed', // name shown in the shop
      icon: '🌽',            // icon in the shop and while dragging
      seedPrice: 10,         // coins to buy and plant one seed
      seedlingIcon: '🌱',    // what the tile shows right after planting
      growTimeMs: 10 * 60 * 1000, // time from planting to ripe (10 minutes)
      name: 'Corn',          // name of the harvested crop in the Market
      ripeIcon: '🌽',        // what the tile shows when ripe
      basePrice: 20,         // average coins the Market pays for one
    },
  },

  // --- Tools you can buy in the Shop ---
  fertilizer: {
    name: 'Fertilizer',    // name shown in the shop
    icon: '🧪',            // icon in the shop and while dragging
    price: 10,             // coins per use
    timeSavedMs: 9 * 60 * 1000,  // makes a growing crop ripen this much earlier (9 minutes)
  },
  // --- Animals (bought in the Shop, placed in a Pigpen — one per pen tile) ---
  animals: {
    pig: {
      name: 'Baby Pig',      // name shown in the shop
      icon: '🐷',            // baby pig: shop, dragging, and on the field (drawn smaller)
      price: 30,             // coins to buy one
      growTimeMs: 10 * 60 * 1000, // time to grow into a big pig (10 minutes)
      grownIcon: '🐖',       // big pig on the field
      home: 'pigpen',        // building it must be placed in
      grownGoods: 'bigPig',  // a big pig is sold / stored as these goods (see "products")
      food: 'corn',          // drag this onto a growing baby to feed it
      feedTimeSavedMs: 10 * 60 * 1000, // each feeding makes it grow up this much earlier (10 minutes)
    },
  },

  // --- Pigpen production ---
  // A pigpen holds 1 pig (on its first tile). While the pig is there, the
  // second tile makes a Fertilizer or a Baby Pig. Nothing new is made until
  // that one is collected (dragged away).
  pigpen: {
    // Each new thing appears after a random wait between these two times (no countdown is shown).
    produceMinMs: 2 * 60 * 1000,  // shortest wait (2 minutes)
    produceMaxMs: 8 * 60 * 1000,  // longest wait (8 minutes)
    babyPigChance: 0.5,           // chance it is a Baby Pig (otherwise Fertilizer): 0.5 = half the time
  },

  // --- Products (goods that are not crops) ---
  products: {
    bigPig: {
      name: 'Big Pig',
      icon: '🐖',
      basePrice: 50,         // average coins the Market pays for one
    },
  },

  newLand: {
    name: 'New Land',      // name shown in the shop
    icon: '🚜',            // icon in the shop and while dragging
    price: 100,            // coins to turn one locked (grey) tile into an available one
  },

  // --- Buildings (Build window) ---
  buildings: {
    pigpen: {
      name: 'Pigpen',
      icon: '🐷',          // icon in the Build window, while dragging, and on the field
      cost: 50,            // coins to build one
      size: 2,             // tiles it takes (2 side-by-side or one above the other)
    },
    warehouse: {
      name: 'Warehouse',
      icon: '🏠',
      cost: 30,
      size: 1,
    },
  },

  // --- Storage (needs Warehouses) ---
  storage: {
    slotsPerWarehouse: 4,  // each Warehouse built adds this many Storage slots
    stackSize: 10,         // how many of the same thing fit in one slot (1 = every item takes its own slot)
    minShownSlots: 20,     // the Storage window always shows at least this many slots (locked ones are grey)
    // A Warehouse can be removed only if at least slotsPerWarehouse slots are empty (so everything still fits).
  },

  // --- Market ---
  market: {
    priceUpdateMs: 30 * 1000, // prices change every 30 seconds
    priceSwing: 0.30,         // prices move within ±30% of basePrice
  },

  tickMs: 1000,          // how often the game checks timers (real milliseconds)

  // --- Footer tools ---
  // "unlocked: true" means clickable from the start.
  tools: [
    { id: 'shop',    icon: '🛒', label: 'Shop',    unlocked: true  },
    { id: 'build',   icon: '🔨', label: 'Build',   unlocked: true  },
    { id: 'market',  icon: '💰', label: 'Market',  unlocked: false }, // unlocks when the first crop ripens
    { id: 'storage', icon: '📦', label: 'Storage', unlocked: true  },
  ],

  // --- Debug ---
  debugKey: 'f',         // press this key to toggle fast mode
  debugSpeed: 60,        // how many times faster timers run in fast mode

  // --- Saving ---
  saveKey: 'dotfarm-save-v2',  // localStorage key (change it to start a fresh save)
  saveEveryMs: 5000,           // auto-save interval (real milliseconds)
};

