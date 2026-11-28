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
  // --- Animals (bought in the Shop, placed in their pen — one animal per pen) ---
  // While an animal lives in its pen, the pen's second tile makes things now and then
  // (see "produce"). Nothing new is made until that thing is collected (dragged away).
  animals: {
    pig: {
      name: 'Baby Pig',      // name shown in the shop
      icon: '🐷',            // baby pig: shop, dragging, and on the field (drawn smaller)
      price: 30,             // coins to buy one
      growTimeMs: 10 * 60 * 1000, // time to grow into a big pig (10 minutes)
      grownIcon: '🐖',       // big pig on the field
      home: 'pigpen',        // building it must be placed in (the Animal Pen)
      grownGoods: 'bigPig',  // a big pig is sold / stored as these goods (see "products")
      food: 'corn',          // drag this onto a growing baby to feed it
      feedTimeSavedMs: 10 * 60 * 1000, // each feeding makes it grow up this much earlier (10 minutes)
      produce: {
        onlyWhenGrown: false,       // false = a baby pig already makes things too
        // Each new thing appears after a random wait between these two times (no countdown is shown).
        minMs: 2 * 60 * 1000,       // shortest wait (2 minutes)
        maxMs: 8 * 60 * 1000,       // longest wait (8 minutes)
        // What it makes, and how likely each is (the chances should add up to 1).
        chances: { pig: 0.5, fertilizer: 0.5 },   // Baby Pig half the time, Fertilizer the other half
      },
    },
    sheep: {
      name: 'Baby Sheep',
      icon: '🐑',            // baby sheep (drawn smaller on the field)
      price: 40,
      growTimeMs: 10 * 60 * 1000, // time to grow up (10 minutes)
      grownIcon: '🐏',       // grown sheep on the field
      home: 'pigpen',        // the same Animal Pen as pigs
      grownGoods: 'bigSheep',
      food: 'corn',
      feedTimeSavedMs: 10 * 60 * 1000,
      produce: {
        onlyWhenGrown: true,        // only a grown sheep makes things
        minMs: 2 * 60 * 1000,
        maxMs: 8 * 60 * 1000,
        chances: { sheep: 0.3, wool: 0.7 },   // Baby Sheep 30%, Wool 70%
      },
    },
  },

  // --- Products (goods that are not crops) ---
  products: {
    bigPig: {
      name: 'Big Pig',
      icon: '🐖',
      basePrice: 50,         // average coins the Market pays for one
    },
    bigSheep: {
      name: 'Sheep',
      icon: '🐏',
      basePrice: 60,
    },
    wool: {
      name: 'Wool',
      icon: '🧶',
      basePrice: 20,
    },
    meat: {
      name: 'Meat',
      icon: '🥩',
      basePrice: 15,         // average coins the Market pays for one (a pig makes 5)
    },
  },

  // --- Butcher: turns 1 Big Pig into Meat ---
  // Drag a Big Pig (from a pen or from Storage) onto a Butcher.
  butcher: {
    input: 'bigPig',              // goods it takes
    output: 'meat',               // goods it makes
    outputCount: 5,               // how many it makes from one input
    workTimeMs: 10 * 60 * 1000,   // how long it takes (10 minutes)
  },

  // --- Goods you can also buy in the Shop (coins each) ---
  // Keep these above the best Market price (basePrice + priceSwing) so buying
  // and selling straight back never makes money.
  shopGoods: {
    wool: 30,   // Market pays 20 ± 30% (14..26)
    meat: 25,   // Market pays 15 ± 30% (11..20)
  },

  // --- Pets ---
  // Buy a Pet Egg in the Shop and drag it into a Pet House (Build window).
  // Then add Wool to keep it warm: it hatches into one of the species below, picked at random.
  petEgg: {
    name: 'Pet Egg',
    icon: '🥚',
    price: 100,
  },
  pets: {
    // The five stats, in the order they are shown, and what each one does.
    // (ids stay the same so old saves keep their points)
    stats: [
      { id: 'str', name: 'Strength',  icon: '💪' },   // 力量 → battle: Attack + Defense  (biggest effect in battle)
      { id: 'agi', name: 'Agility',   icon: '💨' },   // 敏捷 → battle: Speed;  stealing: get caught less / catch thieves at home
      { id: 'vit', name: 'Vitality',  icon: '❤️' },   // 体力 → battle: HP;  farm: eats more per meal (more XP)
      { id: 'end', name: 'Toughness', icon: '🛡️' },   // 耐力 → battle: Defense;  stealing: more trips per day
      { id: 'luk', name: 'Luck',      icon: '🍀' },   // 幸运 → battle: Critical hits (smallest effect);  stealing: success rate
    ],
    // Battle numbers made from the stats (action gauge + turn battles).
    // Balanced by simulating many fights so Strength matters most and Luck least.
    combat: {
      attackBase: 33,  attackPerStr: 0.8,        // Attack  = 33 + 0.8 x Strength
      defensePerStr: 0.35, defensePerTough: 0.85,   // Defense points = 0.35 x Strength + 0.85 x Toughness
      defenseSoft: 32,                           // Defense % = points / (points + 32)
      hpBase: 100,      hpPerVit: 2.4,              // HP      = 100 + 2.4 x Vitality
      speedBase: 60,    speedPerAgi: 0.9,           // Speed   = 60 + 0.9 x Agility (gauge filled per beat)
      gaugeFull: 1000,                            // a full gauge = one attack
      critPerLuk: 0.012, critMax: 0.5,            // Crit    = 1.2% x Luck (max 50%)
      critDamage: 2,                          //   a critical hit does x2 damage
      damageSpread: 0.1,                          // each hit: Attack x (1 - Defense %) x 0.9..1.1
    },
    // What the stats do outside battle.
    life: {
      // Vitality → food per meal (1 + 1 for every 20 Vitality: 10 → 1, 20 → 2, 40 → 3, 60 → 4)
      mealBase: 1, vitPerExtraFood: 20,
      xpPerFood: 1,                     // every food eaten gives this much XP
      // Toughness → stealing trips per day (1 + 1 for every 15 Toughness: 10 → 1, 20 → 2, 30 → 3, 60 → 5)
      stealsBase: 1, toughPerExtraSteal: 15,
      // Luck → chance a steal works: 30% + 1% x Luck (10 → 40%, 20 → 50%, 40 → 70%), max 90%
      stealBase: 0.3, stealPerLuk: 0.01, stealMax: 0.9,
      // Agility → thief vs guard: chance the thief is caught =
      //   30% + 1% x (guard Agility - thief Agility), between 5% and 90%.
      caughtBase: 0.3, caughtPerAgi: 0.01, caughtMin: 0.05, caughtMax: 0.9,
      averageAgi: 20,                   // pet cards show the chances against a pet with this Agility
    },
    baseEach: 10,       // every stat starts at this (5 x 10 = 50 fixed points)
    randomPoints: 50,   // then this many points go, one by one, to random stats (total 100)
    // The species an egg can hatch into (equal chance each).
    // icon + accessory are drawn on top of each other.
    species: {
      lobster: { name: 'Clanker', kind: 'Armored Lobster',   icon: '🦞', accessory: '🛡️', accessorySpot: 'armor' },
      weasel:  { name: 'Monty',   kind: 'Top-Hat Weasel',    icon: '🦦', accessory: '🎩', accessorySpot: 'hat' },
      lizard:  { name: 'Snoots',  kind: 'Long-Snout Lizard', icon: '🐊', accessory: '',   accessorySpot: '' },
    },
  },

  newLand: {
    name: 'New Land',      // name shown in the shop
    icon: '🚜',            // icon in the shop and while dragging
    price: 100,            // coins to turn one locked (grey) tile into an available one
  },

  // --- Buildings (Build window) ---
  buildings: {
    pigpen: {              // (id kept as 'pigpen' so old saves still work)
      name: 'Animal Pen',
      icon: '🐾',          // icon in the Build window, while dragging, and (faded) on an empty pen
      cost: 50,            // coins to build one
      size: 2,             // tiles it takes (2 side-by-side or one above the other)
      pen: true,           // animals live here (see "home" in animals): 1 pig OR 1 sheep per pen
    },
    warehouse: {
      name: 'Warehouse',
      icon: '🏠',
      cost: 30,
      size: 1,
    },
    butcher: {
      name: 'Butcher',
      icon: '🔪',
      cost: 80,
      size: 1,
    },
    petHouse: {
      name: 'Pet House',
      icon: '🛖',
      cost: 100,
      size: 1,
    },
  },

  // --- Pet House: keeps one Pet Egg warm until it hatches ---
  petHouse: {
    fuel: 'wool',                   // goods that keep the egg warm (one at a time)
    incubateMs: 10 * 60 * 1000,     // each Wool keeps it warm this long (10 minutes)
    hatchChance: 0.6,               // then it hatches with this chance (60%); otherwise the Wool is used up
    // After hatching, the pet lives in its Pet House and needs food.
    foods: ['corn', 'meat'],        // what it eats (only one kind in the house at a time)
    maxFood: 10,                    // the most food the house holds
    mealEveryMs: 5 * 60 * 60 * 1000, // it eats every 5 hours
    // how much it eats each time depends on its Vitality (see pets.life)
    // A pet left hungry too long wants to run away:
    runAwayWarnMs: 10 * 60 * 60 * 1000,  // after 10 hours hungry its bubble says it will run away...
    runAwayCheckMs: 5 * 60 * 60 * 1000,  // ...then every 5 hours...
    runAwayChance: 0.2,                  // ...it leaves for good with this chance (20%)
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
    { id: 'pets',    icon: '🐣', label: 'Pets',    unlocked: true  },
  ],

  // --- Debug ---
  debugKey: 'f',         // press this key to toggle fast mode
  debugSpeed: 60,        // how many times faster timers run in fast mode

  // --- Saving ---
  saveKey: 'dotfarm-save-v2',  // localStorage key (change it to start a fresh save)
  saveEveryMs: 5000,           // auto-save interval (real milliseconds)
};

