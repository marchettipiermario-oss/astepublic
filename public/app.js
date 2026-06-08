const state = {
  auctions: [],
  sources: [],
  query: "",
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

function renderAuctions() {
  const visibleAuctions = state.auctions.filter(auctionMatchesQuery);
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
