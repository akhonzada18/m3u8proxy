import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

export default async function proxyM3U8(url, headers, res) {
  const req = await axios(url, { headers }).catch((err) => {
    res.writeHead(500);
    res.end(err.message);
    return null;
  });
  if (!req) return;

  const m3u8 = req.data.split("\n").join("\n");
  const lines = m3u8.split("\n");
  const newLines = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      if (line.startsWith("#EXT-X-KEY:")) {
        const regex = /https?:\/\/[^"\s]+/g;
        const match = regex.exec(line);
        if (match) {
          const keyUrl = `${web_server_url}/ts-proxy?url=${encodeURIComponent(
            match[0]
          )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
          newLines.push(line.replace(match[0], keyUrl));
        } else {
          newLines.push(line);
        }
      } else if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
        const regex = /URI="([^"]+)"/;
        const match = regex.exec(line);
        if (match) {
          const absUrl = new URL(match[1], url).href;
          const audioUrl = `${web_server_url}/m3u8-proxy?url=${encodeURIComponent(
            absUrl
          )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
          newLines.push(line.replace(match[1], audioUrl));
        } else {
          newLines.push(line);
        }
      } else if (line.startsWith("#EXT-X-I-FRAME-STREAM-INF")) {
        const regex = /URI="([^"]+)"/;
        const match = regex.exec(line);
        if (match) {
          const absUrl = new URL(match[1], url).href;
          const iframeUrl = `${web_server_url}/m3u8-proxy?url=${encodeURIComponent(
            absUrl
          )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
          newLines.push(line.replace(match[1], iframeUrl));
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    } else if (line.trim() !== "") {
      const absUrl = new URL(line, url).href;
      const isM3U8 = absUrl.includes(".m3u8");
      const path = isM3U8 ? "/m3u8-proxy" : "/ts-proxy";
      const proxyUrl = `${web_server_url}${path}?url=${encodeURIComponent(
        absUrl
      )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
      newLines.push(proxyUrl);
    } else {
      newLines.push("");
    }
  }

  [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
    "Access-Control-Max-Age",
    "Access-Control-Allow-Credentials",
    "Access-Control-Expose-Headers",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
    "Origin",
    "Vary",
    "Referer",
    "Server",
    "x-cache",
    "via",
    "x-amz-cf-pop",
    "x-amz-cf-id",
  ].forEach((header) => res.removeHeader(header));

  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  res.end(newLines.join("\n"));
}
