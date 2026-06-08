const state = {
  auctions: [],
  sources: [],
  query: "",
  usingSnapshot: false,
  snapshotReason: "",
  selectedSourceIds: new Set(),
  sourceFilterInitialized: false,
};

const elements = {
  cards: document.querySelector("#auctionCards"),
  cardTemplate: document.querySelector("#auctionCardTemplate"),
  sourceStatus: document.querySelector("#sourceStatus"),
  sourceTemplate: document.querySelector("#sourceCardTemplate"),
  totalCount: document.querySelector("#totalCount"),
  lastUpdated: document.querySelector("#lastUpdated"),
  emptyState: document.querySelector("#emptyState"),
  notice: document.querySelector("#notice"),
  refresh: document.querySelector("#refresh"),
  search: document.querySelector("#search"),
  sourceFilters: document.querySelector("#sourceFilters"),
  selectAllSources: document.querySelector("#selectAllSources"),
  clearAllSources: document.querySelector("#clearAllSources"),
};

function formatDateTime(value) {
  if (!value) {
    return "Scadenza non disponibile";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatUpdatedAt(value, cached) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const label = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
  return `${cached ? "Dati in cache" : "Aggiornato"}: ${label}`;
}

function priceOrDash(value) {
  return value || '<span class="muted">Non disponibile</span>';
}

function imagePlaceholder() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <rect width="640" height="420" fill="#eaf2ff"/>
      <circle cx="320" cy="176" r="58" fill="#b8cff0"/>
      <path d="M196 314l86-96 58 64 38-42 78 74H196z" fill="#8db0df"/>
      <text x="320" y="372" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0a4081">Foto non disponibile</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatPlace(city, province) {
  if (city && province) {
    return `${city} (${province})`;
  }

  return city || province || "Non indicata";
}

function renderSources() {
  elements.sourceStatus.replaceChildren();

  for (const source of state.sources) {
    const card = elements.sourceTemplate.content.firstElementChild.cloneNode(true);
    card.classList.add(source.status);
    card.querySelector("h2").textContent = source.name;
    card.querySelector("a").href = source.url;
    card.querySelector("p").textContent =
      source.status === "ok"
        ? `${source.count} aste lette in ${source.durationMs} ms`
        : `Errore: ${source.error || "sorgente non disponibile"}`;
    elements.sourceStatus.append(card);
  }
}

function sourceLabel(source) {
  if (source.id === "firenze") {
    return "Firenze";
  }

  return source.name.replace(/^IVG\s+/i, "").replace(/^ISVEG\s+/i, "Firenze - ");
}

function initializeSourceFilters() {
  if (state.sourceFilterInitialized) {
    const availableIds = new Set(state.sources.map((source) => source.id));
    state.selectedSourceIds = new Set(
      [...state.selectedSourceIds].filter((sourceId) => availableIds.has(sourceId)),
    );
    return;
  }

  state.selectedSourceIds = new Set(state.sources.map((source) => source.id));
  state.sourceFilterInitialized = true;
}

function renderSourceFilters() {
  initializeSourceFilters();
  elements.sourceFilters.replaceChildren();

  for (const source of state.sources) {
    const label = document.createElement("label");
    label.className = "source-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = source.id;
    input.checked = state.selectedSourceIds.has(source.id);
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedSourceIds.add(source.id);
      } else {
        state.selectedSourceIds.delete(source.id);
      }
      renderAuctions();
    });

    const text = document.createElement("span");
    text.textContent = `${sourceLabel(source)} (${source.count || 0})`;

    label.append(input, text);
    elements.sourceFilters.append(label);
  }
}

function auctionMatchesQuery(auction) {
  if (!state.query) {
    return true;
  }

  const haystack = [
    auction.title,
    auction.city,
    auction.province,
    auction.sourceName,
    auction.category,
    auction.saleType,
    auction.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(state.query);
}

function auctionMatchesSelectedSources(auction) {
  return state.selectedSourceIds.has(auction.sourceId);
}

function renderAuctions() {
  const visibleAuctions = state.auctions
    .filter(auctionMatchesSelectedSources)
    .filter(auctionMatchesQuery);
  elements.cards.replaceChildren();

  for (const auction of visibleAuctions) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const title = card.querySelector(".title");
    const image = card.querySelector(".auction-image");
    const description = auction.description || auction.title;

    card.href = auction.url;
    title.textContent = auction.title;
    image.src = auction.image || imagePlaceholder();
    image.alt = auction.title;
    image.addEventListener("error", () => {
      image.src = imagePlaceholder();
    });

    card.querySelector(".deadline").textContent =
      auction.deadlineDisplay || formatDateTime(auction.deadlineAt);
    card.querySelector(".description").textContent = description;
    card.querySelector(".meta").textContent = [auction.category, auction.saleType]
      .filter(Boolean)
      .join(" - ");
    card.querySelector(".city").textContent = formatPlace(auction.city, auction.province);
    card.querySelector(".base-price").innerHTML = priceOrDash(auction.basePriceDisplay);
    card.querySelector(".current-price").innerHTML = priceOrDash(auction.currentPriceDisplay);
    card.querySelector(".source").textContent = auction.sourceName;

    elements.cards.append(card);
  }

  elements.totalCount.textContent = visibleAuctions.length.toLocaleString("it-IT");
  elements.emptyState.hidden = visibleAuctions.length > 0;
}

function renderNotice() {
  const failedSources = state.sources.filter((source) => source.status !== "ok");
  const notices = [];

  if (state.usingSnapshot) {
    notices.push(
      `Stai visualizzando uno snapshot statico delle aste perche i dati live non sono disponibili${state.snapshotReason ? ` (${state.snapshotReason})` : ""}. Se vuoi aggiornare i risultati in tempo reale, avvia l'app con "npm start" e apri http://localhost:3000.`,
    );
  }

  if (failedSources.length) {
    notices.push(
      `Alcune sorgenti non sono disponibili: ${failedSources
        .map((source) => source.name)
        .join(", ")}. I risultati mostrati includono solo le sorgenti caricate correttamente.`,
    );
  }

  if (!notices.length) {
    elements.notice.hidden = true;
    elements.notice.textContent = "";
    return;
  }

  elements.notice.hidden = false;
  elements.notice.textContent = notices.join(" ");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function getEmbeddedSnapshot() {
  if (window.AUCTION_SNAPSHOT?.auctions?.length) {
    return window.AUCTION_SNAPSHOT;
  }

  return null;
}

async function loadSnapshot(reason) {
  const embeddedSnapshot = getEmbeddedSnapshot();
  if (embeddedSnapshot) {
    return {
      payload: embeddedSnapshot,
      usingSnapshot: true,
      snapshotReason: reason,
    };
  }

  const payload = await fetchJson("data/auctions-snapshot.json");
  return {
    payload,
    usingSnapshot: true,
    snapshotReason: reason,
  };
}

async function loadLiveOrSnapshot(fresh) {
  try {
    const payload = await fetchJson(`api/auctions${fresh ? "?fresh=1" : ""}`);
    if (!payload.auctions || payload.auctions.length === 0) {
      throw new Error("nessuna asta live restituita");
    }

    return {
      payload,
      usingSnapshot: false,
      snapshotReason: "",
    };
  } catch (error) {
    return loadSnapshot(error.message);
  }
}

async function loadAuctions({ fresh = false } = {}) {
  elements.refresh.disabled = true;
  elements.refresh.textContent = "Aggiornamento...";
  elements.lastUpdated.textContent = "Caricamento dati...";

  try {
    const { payload, usingSnapshot, snapshotReason } = await loadLiveOrSnapshot(fresh);
    state.auctions = payload.auctions || [];
    state.sources = payload.sources || [];
    state.usingSnapshot = usingSnapshot;
    state.snapshotReason = snapshotReason;
    elements.lastUpdated.textContent = state.usingSnapshot
      ? formatUpdatedAt(payload.fetchedAt, true)
      : formatUpdatedAt(payload.fetchedAt, payload.cached);
    renderSourceFilters();
    renderSources();
    renderNotice();
    renderAuctions();
  } catch (error) {
    state.usingSnapshot = false;
    state.snapshotReason = "";
    elements.notice.hidden = false;
    elements.notice.textContent = `Impossibile caricare le aste: ${error.message}`;
    elements.lastUpdated.textContent = "Errore durante il caricamento.";
  } finally {
    elements.refresh.disabled = false;
    elements.refresh.textContent = "Aggiorna dati";
  }
}

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderAuctions();
});

elements.refresh.addEventListener("click", () => loadAuctions({ fresh: true }));

elements.selectAllSources.addEventListener("click", () => {
  state.selectedSourceIds = new Set(state.sources.map((source) => source.id));
  renderSourceFilters();
  renderAuctions();
});

elements.clearAllSources.addEventListener("click", () => {
  state.selectedSourceIds = new Set();
  renderSourceFilters();
  renderAuctions();
});

loadAuctions();
