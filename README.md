# astepublic

Web app per aggregare in un'unica pagina le aste pubblicate da:

- [IVG Brescia / Fallco Aste](https://ivgbrescia.fallcoaste.it/index.html)
- [IVG Bergamo](https://www.ivgbergamo.it/ricerca/mobili)
- [SIVAG](https://www.sivag.com/ricerca/mobili)

I risultati vengono ordinati per data di scadenza e mostrano citta, prezzo base e
prezzo attuale quando il dato e disponibile dalla sorgente.

## Avvio locale

```bash
npm install
npm start
```

Apri poi <http://localhost:3000>.

Durante lo sviluppo:

```bash
npm run dev
```

Se apri direttamente `public/index.html` o usi una preview statica senza backend,
la pagina mostra comunque uno snapshot incluso in `public/data/auctions-snapshot.js`.
Per dati aggiornati in tempo reale serve invece avviare il server con `npm start`.

## API

La pagina usa l'endpoint:

```text
GET /api/auctions
```

La risposta contiene:

- `auctions`: elenco normalizzato e gia ordinato per scadenza;
- `sources`: stato di lettura di ogni sorgente;
- `fetchedAt`: data/ora dell'ultimo aggiornamento.

Per forzare un refresh saltando la cache breve:

```text
GET /api/auctions?fresh=1
```

## Note sulle sorgenti

- IVG Bergamo e SIVAG vengono interrogati tramite l'indice Typesense pubblico usato
  dai rispettivi frontend.
- IVG Brescia viene letto dal markup HTML pubblico della pagina indicata, estraendo
  le schede asta presenti e deduplicandole.
