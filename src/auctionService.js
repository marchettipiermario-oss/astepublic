const cheerio = require("cheerio");

const TYPESENSE_ENDPOINT =
  "https://typesense.astagiudiziaria.com/collections/astagiudiziaria-prod-v3/documents/search";
const TYPESENSE_API_KEY = "iDZib3RLuzWfhD6j22A6DQboJWLzFFuU";
const TYPESENSE_QUERY_BY =
  "ivg_short_name,province,numero_procedura,category,subcategory,title,inserzioneEspVendita,tags,city";

const SOURCES = [
  {
    id: "brescia",
    name: "IVG Brescia",
    city: "Brescia",
    url: "https://ivgbrescia.fallcoaste.it/index.html",
    type: "fallco-html",
  },
  {
    id: "bergamo",
    name: "IVG Bergamo",
    city: "Bergamo",
    url: "https://www.ivgbergamo.it/ricerca/mobili",
    type: "typesense",
    visibleOn: 24,
  },
  {
    id: "sivag",
    name: "SIVAG Milano",
    city: "Segrate",
    url: "https://www.sivag.com/ricerca/mobili",
    type: "typesense",
    visibleOn: 12,
  },
];

const REQUEST_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "accept-language": "it-IT,it;q=0.9,en;q=0.8",
  "user-agent":
    "Mozilla/5.0 (compatible; AuctionAggregator/1.0; +https://github.com/marchettipiermario-oss/astepublic)",
};

const ITALY_TIME_ZONE = "Europe/Rome";

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEuro(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const match = String(value).match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/);
  if (!match) {
    return null;
  }

  const integerPart = match[1].replace(/\./g, "");
  const decimalPart = (match[2] || "00").padEnd(2, "0");
  return Number(`${integerPart}.${decimalPart}`);
}

function formatEuro(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value));
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }
      return accumulator;
    }, {});

  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return zonedAsUtc - date.getTime();
}

function zonedDateTimeToUtcMs({ year, month, day, hour, minute }, timeZone = ITALY_TIME_ZONE) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return utcGuess - offset;
}

function parseItalianDate(value) {
  const match = String(value || "").match(
    /(\d{2})\/(\d{2})\/(\d{4})(?:\s+h?\.?\s*|\s+)(\d{1,2}):(\d{2})/i,
  );
  if (!match) {
    return { iso: null, sortValue: Number.MAX_SAFE_INTEGER, display: cleanText(value) };
  }

  const [, day, month, year, hour, minute] = match;
  const sortValue = zonedDateTimeToUtcMs({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  });
  const iso = new Date(sortValue).toISOString();
  return {
    iso,
    sortValue,
    display: `${day}/${month}/${year} ${hour.padStart(2, "0")}:${minute}`,
  };
}

function absoluteUrl(url, baseUrl) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...REQUEST_HEADERS,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function extractLabeledPrice(text, label) {
  const normalized = cleanText(text);
  const pattern = new RegExp(`${label}\\s*€\\s*:\\s*([\\d.]+,\\d{1,2})`, "i");
  const match = normalized.match(pattern);
  return match ? parseEuro(match[1]) : null;
}

function parseBresciaAuctions(html, source = SOURCES[0]) {
  const $ = cheerio.load(html);
  const auctions = new Map();

  $("article.auction[data-auction-id]").each((_, element) => {
    const article = $(element);
    const id = article.attr("data-auction-id");
    if (!id || auctions.has(id)) {
      return;
    }

    const link = article.find('a[href*="/vendita/"][title]').first();
    const title = cleanText(link.attr("title") || article.find("h3, h2").first().text());
    const url = absoluteUrl(link.attr("href"), source.url);
    const deadlineRaw = article.attr("data-auction-data-termine");
    const parsedDeadline = parseItalianDate(deadlineRaw);
    const attributesText = article
      .find("[title]")
      .map((__, item) => $(item).attr("title"))
      .get()
      .join(" ");
    const fullText = `${attributesText} ${article.text()}`;
    const basePrice = extractLabeledPrice(fullText, "Prezzo base");
    const currentPrice = extractLabeledPrice(fullText, "Miglior offerta");
    const image = absoluteUrl(article.find("img").first().attr("src"), source.url);

    if (!title || !url) {
      return;
    }

    auctions.set(id, {
      id: `${source.id}-${id}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.url,
      title,
      url,
      city: source.city,
      province: "BS",
      category: cleanText(article.find(".category, .categoria").first().text()) || null,
      deadlineAt: parsedDeadline.iso,
      deadlineDisplay: parsedDeadline.display,
      deadlineSort: parsedDeadline.sortValue,
      basePrice,
      basePriceDisplay: formatEuro(basePrice),
      currentPrice,
      currentPriceDisplay: formatEuro(currentPrice),
      image,
      status: "In vendita",
      saleType: cleanText(article.text()).match(/Asincrona telematica|Sincrona telematica|Raccolta offerte/i)?.[0] || null,
    });
  });

  return [...auctions.values()];
}

function normalizeTypesenseDocument(document, source) {
  const basePrice =
    document.price_label && /miglior|offerta corrente/i.test(document.price_label)
      ? null
      : parseEuro(document.price);
  const currentPrice =
    document.price_label && /miglior|offerta corrente/i.test(document.price_label)
      ? parseEuro(document.price)
      : null;
  const deadline = parseItalianDate(document.fine_gara || document.data_vendita);
  const url = absoluteUrl(document.permalink || "", source.url);

  return {
    id: `${source.id}-${document.id}`,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    title: cleanText(document.title),
    description: cleanText(document.descrizione),
    url,
    city: cleanText(document.city) || source.city,
    province: cleanText(document.province),
    category: cleanText(document.category),
    deadlineAt: deadline.iso,
    deadlineDisplay: deadline.display || cleanText(document.fine_gara),
    deadlineSort: document.data_vendita_search
      ? Number(document.data_vendita_search) * 1000
      : deadline.sortValue,
    basePrice,
    basePriceDisplay: formatEuro(basePrice),
    currentPrice,
    currentPriceDisplay: formatEuro(currentPrice),
    minimumOffer: parseEuro(document.minimumOffer),
    minimumOfferDisplay: formatEuro(document.minimumOffer),
    image: Array.isArray(document.gallery) ? document.gallery[0] || null : null,
    status: cleanText(document.status),
    saleType: cleanText(document.sellType),
  };
}

async function fetchBresciaAuctions(source) {
  const response = await fetchWithTimeout(source.url);
  const html = await response.text();
  return parseBresciaAuctions(html, source);
}

async function fetchTypesenseAuctions(source) {
  const perPage = 250;
  const auctions = [];
  let page = 1;
  let found = 0;

  do {
    const params = new URLSearchParams({
      "x-typesense-api-key": TYPESENSE_API_KEY,
      q: "",
      query_by: TYPESENSE_QUERY_BY,
      filter_by: `genre:=[MOBILI] && status:=[In vendita] && visibile_su:=[${source.visibleOn}]`,
      sort_by: "data_vendita_search:asc",
      per_page: String(perPage),
      page: String(page),
    });

    const response = await fetchWithTimeout(`${TYPESENSE_ENDPOINT}?${params}`, {
      headers: { accept: "application/json" },
    });
    const payload = await response.json();
    found = Number(payload.found || 0);

    for (const hit of payload.hits || []) {
      if (hit.document) {
        auctions.push(normalizeTypesenseDocument(hit.document, source));
      }
    }

    page += 1;
  } while (auctions.length < found && page <= 10);

  return auctions;
}

async function fetchSource(source) {
  const startedAt = Date.now();
  try {
    const auctions =
      source.type === "typesense"
        ? await fetchTypesenseAuctions(source)
        : await fetchBresciaAuctions(source);

    return {
      source: {
        id: source.id,
        name: source.name,
        url: source.url,
        status: "ok",
        count: auctions.length,
        durationMs: Date.now() - startedAt,
      },
      auctions,
    };
  } catch (error) {
    return {
      source: {
        id: source.id,
        name: source.name,
        url: source.url,
        status: "error",
        count: 0,
        durationMs: Date.now() - startedAt,
        error: error.message,
      },
      auctions: [],
    };
  }
}

async function fetchAuctions() {
  const results = await Promise.all(SOURCES.map(fetchSource));
  const auctions = results
    .flatMap((result) => result.auctions)
    .filter((auction) => auction.title && auction.url)
    .sort((a, b) => {
      if (a.deadlineSort !== b.deadlineSort) {
        return a.deadlineSort - b.deadlineSort;
      }
      return a.title.localeCompare(b.title, "it");
    });

  return {
    fetchedAt: new Date().toISOString(),
    total: auctions.length,
    sources: results.map((result) => result.source),
    auctions,
  };
}

module.exports = {
  SOURCES,
  fetchAuctions,
  parseBresciaAuctions,
  normalizeTypesenseDocument,
  parseEuro,
  parseItalianDate,
  formatEuro,
};
