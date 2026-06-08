const test = require("node:test");
const assert = require("node:assert/strict");
const { parseEuro, parseItalianDate, parseBresciaAuctions } = require("../src/auctionService");

test("parseEuro converts Italian currency strings", () => {
  assert.equal(parseEuro("3.480,00"), 3480);
  assert.equal(parseEuro("€ 140,50"), 140.5);
  assert.equal(parseEuro("non disponibile"), null);
});

test("parseItalianDate treats Fallco dates as Europe/Rome local time", () => {
  const summer = parseItalianDate("08/06/2026 14:30");
  assert.equal(summer.sortValue, Date.UTC(2026, 5, 8, 12, 30));
  assert.equal(summer.display, "08/06/2026 14:30");

  const winter = parseItalianDate("11/12/2026 h 10:00");
  assert.equal(winter.sortValue, Date.UTC(2026, 11, 11, 9, 0));
  assert.equal(winter.display, "11/12/2026 10:00");
});

test("parseBresciaAuctions extracts and deduplicates auction cards", () => {
  const html = `
    <article class="hover-block auction" data-auction-id="1" data-auction-data-termine="08/06/2026 14:30">
      <a href="/vendita/prodotto-1.html" title="Prodotto uno">Prodotto uno</a>
      <div title="Prezzo base €: 1.200,00"><div class="label-desc">Prezzo base €:</div></div>
      <div>Asincrona telematica</div>
    </article>
    <article class="hover-block auction" data-auction-id="1" data-auction-data-termine="08/06/2026 14:30">
      <a href="/vendita/prodotto-1.html" title="Prodotto uno">Prodotto uno</a>
    </article>
    <article class="hover-block auction" data-auction-id="2" data-auction-data-termine="08/06/2026 15:00">
      <a href="/vendita/prodotto-2.html" title="Prodotto due">Prodotto due</a>
      <div title="Miglior offerta €: 450,00"><div class="label-desc">Miglior offerta €:</div></div>
    </article>
  `;

  const auctions = parseBresciaAuctions(html, {
    id: "brescia",
    name: "IVG Brescia",
    city: "Brescia",
    url: "https://ivgbrescia.fallcoaste.it/index.html",
  });

  assert.equal(auctions.length, 2);
  assert.equal(auctions[0].basePrice, 1200);
  assert.equal(auctions[0].currentPrice, null);
  assert.equal(auctions[1].basePrice, null);
  assert.equal(auctions[1].currentPrice, 450);
  assert.equal(auctions[0].url, "https://ivgbrescia.fallcoaste.it/vendita/prodotto-1.html");
});
