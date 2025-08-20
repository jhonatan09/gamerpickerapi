const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

app.get("/", (_req, res) => res.status(200).send("ok"));
app.get("/health", (_req, res) => res.status(200).send("ok"));

app.get("/specs", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  let browser;
  try {
    // Preferir variável de ambiente; senão usar o caminho que o Puppeteer conhece
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath();

    browser = await puppeteer.launch({
      headless: "new", // headless moderno
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );

    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const t = r.resourceType();
      if (["image", "media", "font", "stylesheet"].includes(t)) r.abort();
      else r.continue();
    });

    await page.goto(String(url), {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 30000,
    });

    await page
      .waitForSelector(
        ".col-sm-6, #system-requirements, .system-requirements, .minimum-requirements, .requirements",
        { timeout: 8000 }
      )
      .catch(() => {});

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
        if (norm && !out[norm]) out[norm] = rawVal.replace(/\s+/g, " ").trim();
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
        if (m) setPair(m[1], m[2]);
      });

      return out;
    });

    if (!specs || Object.keys(specs).length === 0) {
      return res.status(204).send();
    }

    res.json(specs);
  } catch (error) {
    console.error("Error scraping:", error?.message || error);
    res.status(500).json({ error: "Failed to extract system specs" });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("up on " + PORT));
