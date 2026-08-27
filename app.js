(() => {
  "use strict";

  const TOPICS = [
    { id: "ai", label: "AI", query: '"artificial intelligence" OR "AI"' },
    { id: "hr-trends", label: "HR Trends", query: '"HR trends" OR "human resources trends"' },
    { id: "quantum-physics", label: "Quantum Physics", query: '"quantum physics" OR "quantum computing"' },
    { id: "leadership", label: "Leadership Practices", query: '"leadership development" OR "leadership practices"' },
    { id: "b2b-sales", label: "B2B Sales Practices", query: '"B2B sales" OR "sales enablement"' },
  ];

  const STORAGE_KEY = "news-update:selected-topics";
  const CACHE_PREFIX = "news-update:cache:";
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const ARTICLES_PER_TOPIC = 8;

  const topicListEl = document.getElementById("topic-list");
  const feedEl = document.getElementById("feed");
  const refreshBtn = document.getElementById("refresh");
  const selectAllBtn = document.getElementById("select-all");
  const selectNoneBtn = document.getElementById("select-none");

  function loadSelection() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set(TOPICS.map((t) => t.id));
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return new Set(arr);
      return new Set(TOPICS.map((t) => t.id));
    } catch {
      return new Set(TOPICS.map((t) => t.id));
    }
  }

  function saveSelection(selected) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }

  let selected = loadSelection();

  function renderChips() {
    topicListEl.innerHTML = "";
    TOPICS.forEach((topic) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "topic-chip";
      btn.dataset.topicId = topic.id;
      const isActive = selected.has(topic.id);
      btn.setAttribute("aria-pressed", String(isActive));

      const dot = document.createElement("span");
      dot.className = "dot";
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(topic.label));

      btn.addEventListener("click", () => {
        if (selected.has(topic.id)) {
          selected.delete(topic.id);
        } else {
          selected.add(topic.id);
        }
        saveSelection(selected);
        renderChips();
        loadFeed();
      });

      topicListEl.appendChild(btn);
    });
  }

  function getCache(topicId) {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + topicId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
      return parsed.items;
    } catch {
      return null;
    }
  }

  function setCache(topicId, items) {
    try {
      sessionStorage.setItem(
        CACHE_PREFIX + topicId,
        JSON.stringify({ timestamp: Date.now(), items })
      );
    } catch {
      // ignore storage failures
    }
  }

  async function fetchTopic(topic) {
    const cached = getCache(topic.id);
    if (cached) return { topic, items: cached, fromCache: true };

    const rssUrl =
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(topic.query) +
      "&hl=en-US&gl=US&ceid=US:en";
    const apiUrl =
      "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rssUrl);

    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    if (data.status !== "ok") throw new Error(data.message || "Feed error");

    const items = (data.items || []).slice(0, ARTICLES_PER_TOPIC).map((item) => ({
      title: item.title || "Untitled",
      link: item.link || "#",
      source: (item.author || "").trim() || hostFromUrl(item.link),
      pubDate: item.pubDate || "",
    }));

    setCache(topic.id, items);
    return { topic, items, fromCache: false };
  }

  function hostFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function formatDate(pubDate) {
    if (!pubDate) return "";
    const d = new Date(pubDate);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function renderSkeleton() {
    feedEl.innerHTML = "";
    const activeTopics = TOPICS.filter((t) => selected.has(t.id));
    if (!activeTopics.length) {
      renderEmptyState();
      return;
    }
    activeTopics.forEach((topic) => {
      const section = document.createElement("section");
      section.className = "topic-section";
      section.id = `section-${topic.id}`;

      const h2 = document.createElement("h2");
      h2.textContent = topic.label;
      section.appendChild(h2);

      const grid = document.createElement("div");
      grid.className = "card-grid";
      for (let i = 0; i < 3; i++) {
        const sk = document.createElement("div");
        sk.className = "skeleton";
        grid.appendChild(sk);
      }
      section.appendChild(grid);
      feedEl.appendChild(section);
    });
  }

  function renderEmptyState() {
    feedEl.innerHTML = "";
    const div = document.createElement("div");
    div.className = "empty-state";
    div.textContent = "Select at least one topic above to see headlines.";
    feedEl.appendChild(div);
  }

  function renderTopicResult({ topic, items, error }) {
    const section = document.getElementById(`section-${topic.id}`);
    if (!section) return;

    section.innerHTML = "";
    const h2 = document.createElement("h2");
    h2.textContent = topic.label;
    if (!error) {
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = `${items.length} article${items.length === 1 ? "" : "s"}`;
      h2.appendChild(count);
    }
    section.appendChild(h2);

    if (error) {
      const msg = document.createElement("p");
      msg.className = "state-msg error";
      msg.textContent = "Couldn't load this topic right now. Try refreshing.";
      section.appendChild(msg);
      return;
    }

    if (!items.length) {
      const msg = document.createElement("p");
      msg.className = "state-msg";
      msg.textContent = "No recent articles found.";
      section.appendChild(msg);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "card-grid";
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "card";

      const a = document.createElement("a");
      a.className = "title";
      a.href = item.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = item.title;
      card.appendChild(a);

      const meta = document.createElement("div");
      meta.className = "meta";
      const source = document.createElement("span");
      source.textContent = item.source || "";
      const date = document.createElement("span");
      date.textContent = formatDate(item.pubDate);
      meta.appendChild(source);
      meta.appendChild(date);
      card.appendChild(meta);

      grid.appendChild(card);
    });
    section.appendChild(grid);
  }

  async function loadFeed() {
    const activeTopics = TOPICS.filter((t) => selected.has(t.id));
    if (!activeTopics.length) {
      renderEmptyState();
      return;
    }

    renderSkeleton();
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Loading…";

    await Promise.all(
      activeTopics.map((topic) =>
        fetchTopic(topic)
          .then((result) => renderTopicResult(result))
          .catch(() => renderTopicResult({ topic, items: [], error: true }))
      )
    );

    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }

  function clearCacheAndReload() {
    TOPICS.forEach((topic) => {
      try {
        sessionStorage.removeItem(CACHE_PREFIX + topic.id);
      } catch {
        // ignore
      }
    });
    loadFeed();
  }

  selectAllBtn.addEventListener("click", () => {
    selected = new Set(TOPICS.map((t) => t.id));
    saveSelection(selected);
    renderChips();
    loadFeed();
  });

  selectNoneBtn.addEventListener("click", () => {
    selected = new Set();
    saveSelection(selected);
    renderChips();
    loadFeed();
  });

  refreshBtn.addEventListener("click", clearCacheAndReload);

  renderChips();
  loadFeed();
})();
