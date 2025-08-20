const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

// Caminho do Chrome da imagem do Puppeteer (com fallback via env)
const CHROME_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  "/usr/bin/google-chrome";

app.get("/", (_req, res) => res.status(200).send("ok"));
app.get("/health", (_req, res) => res.status(200).send("ok"));

app.get("/specs", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, // usar true em ambientes serverless
      executablePath: CHROME_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    });

    const page = await browser.newPage();

    // 1) User-Agent decente para reduzir bloqueios
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );

    // 2) Intercepta para não baixar coisas pesadas
    await page.setRequestInterception(true);
    page.on("request", (reqInt) => {
      const type = reqInt.resourceType();
      if (["image", "media", "font", "stylesheet"].includes(type)) {
        reqInt.abort();
      } else {
        reqInt.continue();
      }
    });

    // 3) Vai para a página e espera a rede acalmar
    await page.goto(String(url), {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 30000,
    });

    // Espera algum container plausível (não falha se não achar)
    await page
      .waitForSelector(
        ".col-sm-6, #system-requirements, .system-requirements, .minimum-requirements, .requirements",
        { timeout: 8000 }
      )
      .catch(() => {});

    const specs = await page.evaluate(() => {
      const out = {};

      // mapa de chaves aceitas
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

      // 1) Padrão “label ao lado” (span/strong/b/dt) + próximo irmão
      const containers = document.querySelectorAll(
        ".col-sm-6, #system-requirements, .system-requirements, .minimum-requirements, .requirements, .card, section, article, main"
      );

      containers.forEach((root) => {
        const labels = root.querySelectorAll("span, strong, b, dt");
        labels.forEach((label) => {
          const text = label.textContent?.trim();
          if (!text) return;

          // dt -> dd; senão, próximo elemento
          let valueEl = label.closest("dt")
            ? label.closest("dt").nextElementSibling
            : label.nextElementSibling;

          // fallback: busca p/li dentro do mesmo pai
          if (!valueEl) {
            valueEl = label.parentElement?.querySelector(
              "p,li,dd,span:not(.text-muted)"
            );
          }

          const value = valueEl?.textContent;
          setPair(text, value);
        });
      });

      // 2) Fallback para linhas “Label: Valor” em <li> ou <p>
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
      // Se não achou nada, devolve 204 para o cliente tratar.
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
