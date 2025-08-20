const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

// Evita warnings quando há várias execuções em fila
process.setMaxListeners(0);

const app = express();
app.use(cors({ origin: "*" }));

app.get("/", (_req, res) => res.status(200).send("ok"));
app.get("/health", (_req, res) => res.status(200).send("ok"));

/** ---------- Navegador compartilhado ---------- */
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--single-process",
          "--no-zygote",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
      })
      .then((b) => {
        // Se o Chrome cair, reabrimos no próximo request
        b.on("disconnected", () => {
          browserPromise = null;
        });
        return b;
      });
  }
  return browserPromise;
}

/** ---------- Fila simples p/ limitar concorrência ---------- */
const MAX_CONCURRENCY = Number(process.env.SPECS_CONCURRENCY || 2);
let running = 0;
const queue = [];

function runQueued(taskFn) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      try {
        running++;
        const r = await taskFn();
        resolve(r);
      } catch (e) {
        reject(e);
      } finally {
        running--;
        if (queue.length) queue.shift()();
      }
    };
    if (running < MAX_CONCURRENCY) run();
    else queue.push(run);
  });
}

/** ---------- Cache em memória com TTL ---------- */
const cache = new Map(); // url -> { ts, data }
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h

function getCache(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  if (hit) cache.delete(url);
  return null;
}

function setCache(url, data) {
  cache.set(url, { ts: Date.now(), data });
}

/** ---------- Scraper com retry ---------- */
async function scrapeOnce(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
  );

  // Bloqueia peso morto
  await page.setRequestInterception(true);
  page.on("request", (reqInt) => {
    const type = reqInt.resourceType();
    if (["image", "media", "font", "stylesheet"].includes(type)) reqInt.abort();
    else reqInt.continue();
  });

  try {
    // Menos agressivo que networkidle2 (evita travar)
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);

    const specs = await page.evaluate(() => {
      const out = {};

      const normalizeMap = new Map([
        ["os", "os"],
        ["operating system", "os"],
        ["sistema operacional", "os"],

        ["processor", "processor"],
        ["cpu", "processor"],
        ["processador", "processor"],

        ["memory", "memory"],
        ["memória", "memory"],
        ["memoria", "memory"],
        ["ram", "memory"],

        ["graphics", "graphics"],
        ["gpu", "graphics"],
        ["placa de vídeo", "graphics"],
        ["placa de video", "graphics"],
        ["video", "graphics"],

        ["storage", "storage"],
        ["hard drive", "storage"],
        ["disco rígido", "storage"],
        ["disco rigido", "storage"],
        ["hd", "storage"],
      ]);

      const setPair = (rawKey, rawVal) => {
        if (!rawKey || !rawVal) return;
        const key = rawKey.replace(/:$/, "").trim().toLowerCase();
        const norm = normalizeMap.get(key);
        if (norm && !out[norm]) {
          out[norm] = rawVal.replace(/\s+/g, " ").trim();
        }
      };

      const containers = document.querySelectorAll(
        ".col-sm-6, #system-requirements, .system-requirements, .minimum-requirements, .requirements, .card, section, article, main"
      );

      containers.forEach((root) => {
        const labels = root.querySelectorAll("span, strong, b, dt");
        labels.forEach((label) => {
          const text = label.textContent?.trim();
          if (!text) return;

          let valueEl = label.closest("dt")
            ? label.closest("dt").nextElementSibling
            : label.nextElementSibling;

          if (!valueEl) {
            valueEl = label.parentElement?.querySelector(
              "p,li,dd,span:not(.text-muted)"
            );
          }

          const value = valueEl?.textContent;
          setPair(text, value);
        });
      });

      const lineNodes = document.querySelectorAll("li, p");
      lineNodes.forEach((node) => {
        const t = node.textContent?.replace(/\s+/g, " ").trim() || "";
        const m = t.match(
          /^(OS|Operating System|Sistema Operacional|Processor|CPU|Processador|Memory|Memória|Memoria|RAM|Graphics|GPU|Placa de Vídeo|Placa de Video|Storage|Hard Drive|Disco Rígido|Disco Rigido|HD)\s*[:\-]\s*(.+)$/i
        );
        if (m) {
          const [, k, v] = m;
          setPair(k, v);
        }
      });

      return out;
    });

    return specs && Object.keys(specs).length ? specs : null;
  } finally {
    // fecha a aba sempre
    await page.close().catch(() => {});
  }
}

async function scrapeWithRetry(url, attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const data = await scrapeOnce(url);
      if (data) return data;
    } catch (e) {
      lastErr = e;
      // pequena espera entre tentativas
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

/** ---------- Endpoint ---------- */
app.get("/specs", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  // cache
  const cached = getCache(url);
  if (cached) return res.json(cached);

  try {
    const data = await runQueued(() => scrapeWithRetry(String(url), 2));

    if (!data) return res.status(204).end();

    setCache(String(url), data);
    return res.json(data);
  } catch (error) {
    console.error("Error scraping:", error?.message || error);
    return res.status(500).json({ error: "Failed to extract system specs" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("up on " + PORT));
