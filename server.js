const path = require("path");
const express = require("express");
const { fetchAuctions } = require("./src/auctionService");

const app = express();
const port = process.env.PORT || 3000;
const cacheTtlMs = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);

let cache = null;

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_, response) => {
  response.json({ status: "ok" });
});

app.get("/api/auctions", async (request, response) => {
  const wantsFreshData = request.query.fresh === "1";
  const cacheIsFresh = cache && Date.now() - cache.createdAt < cacheTtlMs;

  if (!wantsFreshData && cacheIsFresh) {
    response.json({
      ...cache.payload,
      cached: true,
      cacheExpiresAt: new Date(cache.createdAt + cacheTtlMs).toISOString(),
    });
    return;
  }

  try {
    const payload = await fetchAuctions();
    cache = {
      createdAt: Date.now(),
      payload,
    };

    response.json({
      ...payload,
      cached: false,
      cacheExpiresAt: new Date(cache.createdAt + cacheTtlMs).toISOString(),
    });
  } catch (error) {
    response.status(502).json({
      error: "Impossibile aggiornare le aste in questo momento.",
      detail: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Auction aggregator listening on http://localhost:${port}`);
});
