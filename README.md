# News Update

A small static web app for tracking headlines across five B2B-relevant topics:
**AI**, **HR Trends**, **Quantum Physics**, **Leadership Practices**, and **B2B Sales Practices**.

Pick which topics you care about, and the app pulls in recent headlines for each.
Your topic selection is saved in the browser (`localStorage`), so it's remembered
next time you open the app.

## Running it

No build step or dependencies — it's plain HTML/CSS/JS.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser (some browsers restrict `fetch`
from `file://` URLs, so a local server is more reliable).

## How it works

- Each topic maps to a search query sent to Google News RSS.
- Headlines are fetched client-side through [rss2json.com](https://rss2json.com)'s
  free public API, which converts the RSS feed to JSON and adds the CORS headers
  browsers need (Google News RSS doesn't allow direct cross-origin `fetch`).
- Results are cached in `sessionStorage` for 10 minutes per topic to avoid
  hammering the free API tier. The "Refresh" button clears the cache and
  re-fetches everything.

### Swapping the news source

The free rss2json tier is rate-limited and fine for personal/demo use, but not
for production traffic. To swap it out, edit `fetchTopic()` in `app.js`:

- Use your own backend as a proxy for Google News RSS (avoids third-party
  rate limits entirely), or
- Use a paid news API (e.g. NewsAPI.org, Bing News Search) and adjust the
  request/response mapping accordingly.

## Customizing topics

Topics live in the `TOPICS` array at the top of `app.js` — each has an `id`,
a display `label`, and a `query` string used to search Google News. Add,
remove, or edit entries there.
