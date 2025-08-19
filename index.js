const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: "*", // ou use "*" para testes
  })
);

app.get("/specs", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    const specs = await page.evaluate(() => {
      const specsData = {};
      const columns = document.querySelectorAll("div.col-sm-6");

      columns.forEach((col) => {
        const elements = Array.from(col.children);

        for (let i = 0; i < elements.length - 1; i++) {
          const labelEl = elements[i];
          const valueEl = elements[i + 1];

          if (
            labelEl.tagName === "SPAN" &&
            valueEl.tagName === "P" &&
            labelEl.classList.contains("text-muted")
          ) {
            const key = labelEl.textContent
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            const formattedKey = key
              .split(" ")
              .map((w, i) =>
                i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)
              )
              .join("");
            specsData[formattedKey] = valueEl.textContent.trim();
          }
        }
      });

      return specsData;
    });

    res.json(specs);
  } catch (error) {
    console.error("Error scraping:", error);
    res.status(500).json({ error: "Failed to extract system specs" });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("up on " + PORT));
