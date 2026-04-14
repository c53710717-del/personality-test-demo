export const TOKEN_COLORS = ["white", "blue", "green", "red", "black"];
export const ALL_TOKEN_COLORS = [...TOKEN_COLORS, "gold"];

export function createGame({ players, seed = 1 }) {
  const rng = mulberry32(seed);
  const decks = buildDecks(rng);
  const bank = initialBank(players.length);
  const investors = buildInvestors(rng);
  const table = {
    1: drawMany(decks[1], 4),
    2: drawMany(decks[2], 4),
    3: drawMany(decks[3], 4)
  };

  const state = {
    id: makeId(),
    status: "playing",
    players: players.map((p) => ({
      id: p.id,
      username: p.username,
      tokens: emptyTokens(),
      bonuses: emptyBonuses(),
      points: 0,
      reserved: [],
      cards: []
    })),
    bank,
    decks,
    table,
    investors,
    claimedInvestors: [],
    currentPlayer: 0,
    finalRoundStartIndex: null,
    lastAction: null
  };

  return state;
}

export function applyAction(state, playerId, action) {
  if (state.status !== "playing") {
    return { ok: false, error: "Game is not active." };
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { ok: false, error: "Player not found." };
  if (playerIndex !== state.currentPlayer) return { ok: false, error: "Not your turn." };

  const player = state.players[playerIndex];

  switch (action.type) {
    case "takeTokens":
      return takeTokens(state, playerIndex, action.colors);
    case "takeTwo":
      return takeTwo(state, playerIndex, action.color);
    case "reserve":
      return reserveCard(state, playerIndex, action.cardId);
    case "buy":
      return buyCard(state, playerIndex, action.cardId, action.source);
    default:
      return { ok: false, error: "Unknown action." };
  }
}

export function canAfford(player, card) {
  const cost = card.cost;
  let goldNeeded = 0;
  for (const color of TOKEN_COLORS) {
    const needed = Math.max(0, cost[color] - player.bonuses[color]);
    const pay = Math.min(needed, player.tokens[color]);
    const remaining = needed - pay;
    goldNeeded += remaining;
  }
  return goldNeeded <= player.tokens.gold;
}

export function publicStateForPlayer(state, playerId) {
  const players = state.players.map((p) => {
    if (p.id === playerId) return p;
    return {
      ...p,
      reserved: p.reserved.map((c) => ({ id: c.id, hidden: true }))
    };
  });

  return { ...state, players };
}

function takeTokens(state, playerIndex, colors) {
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > 3) {
    return { ok: false, error: "Choose 1-3 different colors." };
  }
  const unique = new Set(colors);
  if (unique.size !== colors.length) {
    return { ok: false, error: "Colors must be different." };
  }
  for (const c of colors) {
    if (!TOKEN_COLORS.includes(c)) return { ok: false, error: "Invalid color." };
    if (state.bank[c] < 1) return { ok: false, error: "Not enough tokens." };
  }

  const player = state.players[playerIndex];
  const totalAfter = totalTokens(player.tokens) + colors.length;
  if (totalAfter > 10) return { ok: false, error: "Token limit is 10." };

  for (const c of colors) {
    state.bank[c] -= 1;
    player.tokens[c] += 1;
  }

  advanceTurn(state, { type: "takeTokens", colors, playerId: player.id });
  return { ok: true };
}

function takeTwo(state, playerIndex, color) {
  if (!TOKEN_COLORS.includes(color)) return { ok: false, error: "Invalid color." };
  if (state.bank[color] < 4) return { ok: false, error: "Need 4 tokens in bank to take two." };
  const player = state.players[playerIndex];
  if (totalTokens(player.tokens) + 2 > 10) return { ok: false, error: "Token limit is 10." };

  state.bank[color] -= 2;
  player.tokens[color] += 2;

  advanceTurn(state, { type: "takeTwo", color, playerId: player.id });
  return { ok: true };
}

function reserveCard(state, playerIndex, cardId) {
  const player = state.players[playerIndex];
  if (player.reserved.length >= 3) return { ok: false, error: "Reserve limit is 3." };

  const cardInfo = findCardInTable(state, cardId);
  if (!cardInfo) return { ok: false, error: "Card not found." };

  const goldGain = state.bank.gold > 0 ? 1 : 0;
  if (totalTokens(player.tokens) + goldGain > 10) {
    return { ok: false, error: "Token limit is 10." };
  }

  player.reserved.push(cardInfo.card);
  state.table[cardInfo.tier].splice(cardInfo.index, 1);
  state.table[cardInfo.tier].push(drawOne(state.decks[cardInfo.tier]));

  if (state.bank.gold > 0) {
    state.bank.gold -= 1;
    player.tokens.gold += 1;
  }

  advanceTurn(state, { type: "reserve", cardId, playerId: player.id });
  return { ok: true };
}

function buyCard(state, playerIndex, cardId, source) {
  const player = state.players[playerIndex];
  let card = null;
  if (source === "reserve") {
    const idx = player.reserved.findIndex((c) => c.id === cardId);
    if (idx === -1) return { ok: false, error: "Card not found." };
    card = player.reserved[idx];
    if (!canAfford(player, card)) return { ok: false, error: "Cannot afford." };
    player.reserved.splice(idx, 1);
  } else {
    const cardInfo = findCardInTable(state, cardId);
    if (!cardInfo) return { ok: false, error: "Card not found." };
    card = cardInfo.card;
    if (!canAfford(player, card)) return { ok: false, error: "Cannot afford." };
    state.table[cardInfo.tier].splice(cardInfo.index, 1);
    state.table[cardInfo.tier].push(drawOne(state.decks[cardInfo.tier]));
  }

  // pay tokens
  for (const color of TOKEN_COLORS) {
    const need = Math.max(0, card.cost[color] - player.bonuses[color]);
    const pay = Math.min(need, player.tokens[color]);
    player.tokens[color] -= pay;
    state.bank[color] += pay;
    const remaining = need - pay;
    if (remaining > 0) {
      player.tokens.gold -= remaining;
      state.bank.gold += remaining;
    }
  }

  player.cards.push(card);
  player.bonuses[card.bonusColor] += 1;
  player.points += card.points;

  claimInvestorIfEligible(state, playerIndex);

  advanceTurn(state, { type: "buy", cardId, playerId: player.id, source });
  return { ok: true };
}

function claimInvestorIfEligible(state, playerIndex) {
  const player = state.players[playerIndex];
  const available = state.investors.filter(
    (i) => !state.claimedInvestors.find((c) => c.investorId === i.id)
  );

  for (const investor of available) {
    let ok = true;
    for (const color of TOKEN_COLORS) {
      if (player.bonuses[color] < investor.req[color]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      state.claimedInvestors.push({ investorId: investor.id, playerId: player.id });
      player.points += investor.points;
      break;
    }
  }
}

function advanceTurn(state, actionSummary) {
  state.lastAction = actionSummary;

  const currentPlayer = state.players[state.currentPlayer];
  if (state.finalRoundStartIndex === null && currentPlayer.points >= 15) {
    state.finalRoundStartIndex = state.currentPlayer;
  }

  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;

  if (
    state.finalRoundStartIndex !== null &&
    state.currentPlayer === state.finalRoundStartIndex
  ) {
    state.status = "finished";
  }
}

function findCardInTable(state, cardId) {
  for (const tier of [1, 2, 3]) {
    const index = state.table[tier].findIndex((c) => c.id === cardId);
    if (index !== -1) return { tier, index, card: state.table[tier][index] };
  }
  return null;
}

function initialBank(playerCount) {
  const base = playerCount === 2 ? 4 : playerCount === 3 ? 5 : 7;
  return {
    white: base,
    blue: base,
    green: base,
    red: base,
    black: base,
    gold: 5
  };
}

function emptyTokens() {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
}

function emptyBonuses() {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0 };
}

function totalTokens(tokens) {
  return ALL_TOKEN_COLORS.reduce((sum, c) => sum + tokens[c], 0);
}

function drawMany(deck, count) {
  const drawn = [];
  for (let i = 0; i < count; i += 1) drawn.push(drawOne(deck));
  return drawn;
}

function drawOne(deck) {
  if (!deck.length) return null;
  return deck.pop();
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDecks(rng) {
  const tier1 = [];
  const tier2 = [];
  const tier3 = [];

  const companyNames = [
    "Helios Labs",
    "Quantum Forge",
    "Aurora AI",
    "Neural Harbor",
    "Lumen Dynamics",
    "Vector Peak",
    "Atlas Compute",
    "NovaStack",
    "Sage Protocol",
    "Orion Data"
  ];

  let idCounter = 1;
  for (let i = 0; i < 40; i += 1) {
    tier1.push(makeCard(idCounter++, 1, rng, companyNames));
  }
  for (let i = 0; i < 30; i += 1) {
    tier2.push(makeCard(idCounter++, 2, rng, companyNames));
  }
  for (let i = 0; i < 20; i += 1) {
    tier3.push(makeCard(idCounter++, 3, rng, companyNames));
  }

  shuffle(tier1, rng);
  shuffle(tier2, rng);
  shuffle(tier3, rng);

  return { 1: tier1, 2: tier2, 3: tier3 };
}

function makeCard(id, tier, rng, companyNames) {
  const bonusColor = TOKEN_COLORS[Math.floor(rng() * TOKEN_COLORS.length)];
  const points = tier === 1 ? (rng() < 0.2 ? 1 : 0) : tier === 2 ? (rng() < 0.6 ? 2 : 1) : (rng() < 0.7 ? 4 : 3);
  const cost = {};
  for (const color of TOKEN_COLORS) cost[color] = 0;
  const costBase = tier === 1 ? 2 : tier === 2 ? 4 : 6;
  for (let i = 0; i < 3; i += 1) {
    const c = TOKEN_COLORS[Math.floor(rng() * TOKEN_COLORS.length)];
    cost[c] += Math.max(1, Math.floor(rng() * 3) + Math.floor(costBase / 2));
  }

  const company = companyNames[Math.floor(rng() * companyNames.length)];
  const ticker = `${company.split(" ")[0].slice(0, 3).toUpperCase()}${id}`;

  return {
    id: `C${id}`,
    tier,
    name: `${company} Series ${tier}`,
    company,
    ticker,
    bonusColor,
    points,
    cost
  };
}

function buildInvestors(rng) {
  const investors = [];
  for (let i = 0; i < 10; i += 1) {
    const req = emptyBonuses();
    for (let j = 0; j < 3; j += 1) {
      const c = TOKEN_COLORS[Math.floor(rng() * TOKEN_COLORS.length)];
      req[c] += 3;
    }
    investors.push({
      id: `I${i + 1}`,
      name: `Investor ${String.fromCharCode(65 + i)}`,
      req,
      points: 3
    });
  }
  return investors;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
