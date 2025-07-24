import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

const cdnMap = {
  dotstream: "cdn.dotstream.buzz",
  tubeplx: "tubeplx.viddsn.cfd",
};

export default async function proxyM3U8(url, _headers, res) {
  // Detect CDN slug from hostname
  const cdnSlug = Object.entries(cdnMap).find(([_, domain]) =>
    url.includes(domain)
  )?.[0];

  if (!cdnSlug) {
    res.writeHead(400);
    res.end("Unknown CDN");
    return;
  }

  let rawM3U8;
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 ...",
        Referer:
          cdnSlug === "tubeplx"
            ? "https://vidwish.live/"
            : "https://megaplay.buzz/",
      },
    });
    rawM3U8 = response.data;
  } catch (err) {
    res.writeHead(502);
    res.end(`Failed to fetch M3U8: ${err.message}`);
    return;
  }

  const lines = rawM3U8.split("\n");
  const newLines = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      if (line.startsWith("#EXT-X-KEY:")) {
        const regex = /https?:\/\/[^\""\s]+/g;
        const keyUrl = regex.exec(line)?.[0] ?? "";
        const keyPath = new URL(keyUrl).pathname;
        newLines.push(
          line.replace(keyUrl, `${web_server_url}/${cdnSlug}${keyPath}`)
        );
      } else if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
        const regex = /https?:\/\/[^\""\s]+/g;
        const audioUrl = regex.exec(line)?.[0] ?? "";
        const audioPath = new URL(audioUrl).pathname;
        newLines.push(
          line.replace(audioUrl, `${web_server_url}/${cdnSlug}${audioPath}`)
        );
      } else {
        newLines.push(line);
      }
    } else if (line.trim() !== "") {
      const fullPath = new URL(line, url).pathname;
      newLines.push(`${web_server_url}/${cdnSlug}${fullPath}`);
    } else {
      newLines.push(line); // Empty line or whitespace
    }
  }

  res.removeHeader("X-Powered-By");
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  res.end(newLines.join("\n"));
}
