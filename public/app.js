const state = {
  auctions: [],
  sources: [],
  query: "",
};

const elements = {
  rows: document.querySelector("#auctionRows"),
  rowTemplate: document.querySelector("#auctionRowTemplate"),
  sourceStatus: document.querySelector("#sourceStatus"),
  sourceTemplate: document.querySelector("#sourceCardTemplate"),
  totalCount: document.querySelector("#totalCount"),
  lastUpdated: document.querySelector("#lastUpdated"),
  emptyState: document.querySelector("#emptyState"),
  notice: document.querySelector("#notice"),
  refresh: document.querySelector("#refresh"),
  search: document.querySelector("#search"),
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
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(state.query);
}

function renderAuctions() {
  const visibleAuctions = state.auctions.filter(auctionMatchesQuery);
  elements.rows.replaceChildren();

  for (const auction of visibleAuctions) {
    const row = elements.rowTemplate.content.firstElementChild.cloneNode(true);
    const title = row.querySelector(".title");
    title.textContent = auction.title;
    title.href = auction.url;

    row.querySelector(".deadline").textContent =
      auction.deadlineDisplay || formatDateTime(auction.deadlineAt);
    row.querySelector(".meta").textContent = [auction.category, auction.saleType]
      .filter(Boolean)
      .join(" · ");
    row.querySelector(".city").textContent = formatPlace(auction.city, auction.province);
    row.querySelector(".base-price").innerHTML = priceOrDash(auction.basePriceDisplay);
    row.querySelector(".current-price").innerHTML = priceOrDash(auction.currentPriceDisplay);
    row.querySelector(".source").textContent = auction.sourceName;

    elements.rows.append(row);
  }

  elements.totalCount.textContent = visibleAuctions.length.toLocaleString("it-IT");
  elements.emptyState.hidden = visibleAuctions.length > 0;
}

function renderNotice() {
  const failedSources = state.sources.filter((source) => source.status !== "ok");

  if (!failedSources.length) {
    elements.notice.hidden = true;
    elements.notice.textContent = "";
    return;
  }

  elements.notice.hidden = false;
  elements.notice.textContent = `Alcune sorgenti non sono disponibili: ${failedSources
    .map((source) => source.name)
    .join(", ")}. I risultati mostrati includono solo le sorgenti caricate correttamente.`;
}

async function loadAuctions({ fresh = false } = {}) {
  elements.refresh.disabled = true;
  elements.refresh.textContent = "Aggiornamento...";
  elements.lastUpdated.textContent = "Caricamento dati...";

  try {
    const response = await fetch(`/api/auctions${fresh ? "?fresh=1" : ""}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    state.auctions = payload.auctions || [];
    state.sources = payload.sources || [];
    elements.lastUpdated.textContent = formatUpdatedAt(payload.fetchedAt, payload.cached);
    renderSources();
    renderNotice();
    renderAuctions();
  } catch (error) {
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

loadAuctions();
