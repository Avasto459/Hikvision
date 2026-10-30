import http from "http";
import https from "https";

// SSL агент с отключённой проверкой сертификата для hasi.tj (просроченный/самоподписанный сертификат).
const sslAgent = new https.Agent({ rejectUnauthorized: false });

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response("Параметр url обязателен", { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = https.request(
        parsedUrl,
        {
          agent: sslAgent,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; HASI-Catalog/1.0; +https://hasi.tj)",
            Accept: "image/*,*/*",
          },
        },
        resolve,
      );
      req.on("error", reject);
      req.end();
    });

    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
      return new Response(
        `Не удалось загрузить изображение: ${response.statusCode}`,
        { status: response.statusCode || 502 },
      );
    }

    const contentType = (response.headers["content-type"] || "application/octet-stream").toString();
    // Проксируем только изображения; иначе отдаём 415.
    if (!ALLOWED_CONTENT_TYPES.has(contentType.split(";")[0].trim().toLowerCase())) {
      return new Response("Неподдерживаемый тип контента", { status: 415 });
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });

    const uint8 = new Uint8Array(buffer);

    return new Response(uint8, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    return new Response("Ошибка проксирования изображения", { status: 502 });
  }
}