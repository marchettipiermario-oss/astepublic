# astepublic

Web app per aggregare in un'unica pagina le aste pubblicate da:

- [IVG Brescia / Fallco Aste](https://ivgbrescia.fallcoaste.it/index.html)
- [IVG Bergamo](https://www.ivgbergamo.it/ricerca/mobili)
- [IVG Mantova](https://www.ivgmantova.it/ricerca/mobili)
- [IVG Como](https://www.ivgcomo.it/ricerca/mobili)
- [IVG Cremona / Fallco Aste](https://ivgcremona.fallcoaste.it/ricerca.html?filter=macro%7C591%5Einput_categoria%7CBeni%20Mobili%5Eubicazione_dst%7C50%5Estato%7C1&page=1)
- [IVG Bologna](https://www.ivgbologna.it/ricerca/mobili)
- [IVG Monza](https://www.ivgmonza.it/ricerca/mobili)
- [ISVEG Firenze](https://www.ivgfirenze.it/ricerca/mobili)
- [SIVAG](https://www.sivag.com/ricerca/mobili)

I risultati vengono ordinati per data di scadenza e mostrano citta, prezzo base e
prezzo attuale quando il dato e disponibile dalla sorgente.
La pagina permette anche di selezionare quali citta/sorgenti includere o
nascondere dall'elenco.
Per evitare di caricare troppe immagini contemporaneamente, la lista mostra 12
aste per pagina con controlli avanti/indietro e carica/scarica le immagini in
base alla visibilita durante lo scroll.

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

## Pubblicazione online

### Opzione piu semplice: GitHub Pages, solo browser

Questa opzione pubblica la cartella `public/` e permette di visitare il sito da
qualsiasi browser senza installare nulla.

Dopo il merge su `main`, il workflow GitHub Pages pubblica automaticamente il
sito. L'URL previsto e:

```text
https://marchettipiermario-oss.github.io/astepublic/
```

Se GitHub Pages e configurato su **Deploy from branch**, la root del repository
redirige automaticamente alla cartella dell'app:

```text
https://marchettipiermario-oss.github.io/astepublic/public/
```

Nota: GitHub Pages e statico, quindi usa lo snapshot incluso in
`public/data/auctions-snapshot.js`. Per aggiornare lo snapshot bisogna
rigenerarlo nel repository e fare un nuovo deploy.

### Opzione consigliata: Render, con dati live

Questa opzione pubblica anche il backend Node/Express, quindi il pulsante
"Aggiorna dati" recupera le aste live.

1. Crea un account su <https://render.com>.
2. Fai push/merge del codice su GitHub.
3. In Render scegli **New +** -> **Blueprint**.
4. Collega questo repository.
5. Render leggera automaticamente `render.yaml`.
6. Conferma la creazione del servizio.
7. Quando il deploy finisce, apri l'URL pubblico fornito da Render.

Configurazione gia inclusa:

- build: `npm ci`
- start: `npm start`
- health check: `/api/health`
- Node: `>=20`

### Opzione statica: GitHub Pages / Netlify / hosting statico

Puoi pubblicare solo la cartella `public/`.
In questo caso il sito e visibile online, ma usa lo snapshot statico incluso in
`public/data/auctions-snapshot.js`; i dati live non vengono aggiornati dal
backend.

Usa questa opzione solo se ti basta vedere una copia statica delle aste.

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

- IVG Bergamo, IVG Mantova, IVG Como, IVG Bologna, IVG Monza, ISVEG Firenze e
  SIVAG vengono interrogati tramite l'indice Typesense pubblico usato dai
  rispettivi frontend.
- IVG Brescia e IVG Cremona vengono letti dal markup HTML pubblico delle pagine
  indicate, estraendo le schede asta presenti e deduplicandole. Cremona viene
  letta anche sulle pagine successive dei risultati.
