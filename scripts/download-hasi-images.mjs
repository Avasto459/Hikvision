
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import https from "node:https";
import http from "node:http";

const root = process.cwd();
const publicDir = path.join(root, "public", "catalog");
const db = createClient({
  url: `file:${path.join(root, "data", "hasi.db")}`,
});
const limitArg = process.argv.find((x) => x.startsWith("--limit="));
const limit = Math.max(1, Number(limitArg?.split("=")[1] || 1500));

const agent = new https.Agent({ rejectUnauthorized: false });

function hash(value) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, 12);
}

function safeName(value) {
  return String(value || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 35) || "product";
}

function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("Too many redirects"));

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error("Invalid URL"));
    }

    if (!["https:", "http:"].includes(parsed.protocol)) {
      return reject(new Error("Unsupported protocol"));
    }

    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 HASI-Catalog-Image-Downloader",
        Accept: "image/*,*/*;q=0.8",
      },
      timeout: 20000,
      ...(parsed.protocol === "https:" ? { agent } : {}),
    };

    const request = (parsed.protocol === "https:" ? https : http)
      .get(url, options, (response) => {
        const status = response.statusCode || 0;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          response.resume();
          return download(new URL(location, url).href, redirects + 1)
            .then(resolve, reject);
        }

        if (status !== 200) {
          response.resume();
          return reject(new Error(`HTTP ${status}`));
        }

        const type = String(response.headers["content-type"] || "").toLowerCase();
        const chunks = [];
        let size = 0;

        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 8 * 1024 * 1024) {
            request.destroy(new Error("Image too large"));
          } else {
            chunks.push(chunk);
          }
        });

        response.on("end", () => {
          if (!type.startsWith("image/") || type.includes("svg")) {
            return reject(new Error(`Not an image: ${type}`));
          }

          const buffer = Buffer.concat(chunks);
          if (buffer.length < 1000) {
            return reject(new Error("Image too small"));
          }

          const ext = type.includes("webp") ? ".webp"
            : type.includes("png") ? ".png"
            : type.includes("jpeg") || type.includes("jpg") ? ".jpg"
            : null;

          if (!ext) return reject(new Error(`Unsupported image type: ${type}`));
          resolve({ buffer, ext });
        });

        response.on("error", reject);
      });

    request.on("timeout", () => request.destroy(new Error("Timeout")));
    request.on("error", reject);
  });
}


try {
  await mkdir(publicDir, { recursive: true });

  const result = await db.execute(
    "SELECT id, name, brand, sku, image, images FROM products WHERE isPublished=1 ORDER BY brand, name"
  );

  const candidates = result.rows.filter((p) =>
    String(p.image || "").startsWith("https://hasi.tj/wp-content/uploads/")
  ).slice(0, limit);

  console.log(`Маҳсулот: ${result.rows.length}; расмҳои hasi.tj барои санҷиш: 
${candidates.length}`);

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const product = candidates[i];
    const url = String(product.image);
    const base = `${safeName(product.brand)}-${safeName(product.sku || 
product.name)}-${hash(product.id)}`;

    try {
      const { buffer, ext } = await download(url);
      const filename = `${base}${ext}`;
      const destination = path.join(publicDir, filename);

      await writeFile(destination, buffer);

      const localUrl = `/catalog/${filename}`;
      await db.execute({
        sql: "UPDATE products SET image = ?, images = ? WHERE id = ?",
        args: [localUrl, JSON.stringify([localUrl]), product.id],
      });

      downloaded++;
      console.log(`[${i + 1}/${candidates.length}] OK ${product.name} -> ${localUrl}`);
    } catch (error) {
      failed++;
      console.log(`[${i + 1}/${candidates.length}] SKIP ${product.name}: ${error.message}`);
    }
  }

  console.log(`Анҷом: боргирӣ шуд ${downloaded}; ноком шуд ${failed}.`);
  console.log("Маҳсулотҳо нест карда нашуданд. Расмҳои номуваффақ тағйир дода нашуданд.");
} finally {
  db.close();
}

