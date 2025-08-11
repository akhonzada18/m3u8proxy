import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const host = process.env.HOST || "127.0.0.1";
const port = process.env.PORT || 8080;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

// Determine Referer based on URL
function getRefererForURL(url) {
  if (url.includes("tubeplx")) {
    console.log("Using vidwish referer for URL:", url);
    return "https://vidwish.live/";
  }
  if (url.includes("dotstream")) {
    console.log("Using megaplay referer for URL:", url);
    return "https://megaplay.buzz/";
  }
  console.log("Using default referer for URL:", url);
  return "https://megacloud.blog/";
}

export default async function proxyM3U8(url, res) {
  const headers = {
    Referer: getRefererForURL(url),
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
  };

  const req = await axios(url, {
    headers: headers,
  }).catch((err) => {
    res.writeHead(500);
    res.end(err.message);
    return null;
  });
  if (!req) {
    return;
  }

  // Normalize line endings and split, trimming empty lines
  const rawM3u8 = req.data.replace(/\r\n/g, "\n");
  const lines = rawM3u8
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Check if this is a master playlist (has RESOLUTION) or media playlist
  const isMasterPlaylist = lines.some((line) => line.includes("RESOLUTION="));

  if (!isMasterPlaylist) {
    // Media playlist must have EXT-X-TARGETDURATION
    const hasTargetDuration = lines.some((line) =>
      line.startsWith("#EXT-X-TARGETDURATION")
    );
    if (!hasTargetDuration) {
      console.warn(
        "Warning: Media playlist missing #EXT-X-TARGETDURATION tag. Roku may fail to play this."
      );
      // Optionally return error to client:
      // res.writeHead(500);
      // res.end("Invalid media playlist: missing EXT-X-TARGETDURATION");
      // return;
    }
  }

  const newLines = [];
  for (const line of lines) {
    if (line.startsWith("#")) {
      if (line.startsWith("#EXT-X-KEY:")) {
        const regex = /https?:\/\/[^\""\s]+/g;
        const foundUrl = regex.exec(line)?.[0] ?? "";
        const proxyUrl = `${web_server_url}/ts-proxy?url=${encodeURIComponent(
          foundUrl
        )}`;
        newLines.push(line.replace(regex, proxyUrl));
      } else if (
        isMasterPlaylist &&
        line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")
      ) {
        const regex = /https?:\/\/[^\""\s]+/g;
        const foundUrl = regex.exec(line)?.[0] ?? "";
        const proxyUrl = `${web_server_url}/m3u8-proxy?url=${encodeURIComponent(
          foundUrl
        )}`;
        newLines.push(line.replace(regex, proxyUrl));
      } else {
        newLines.push(line);
      }
    } else {
      // This is a URI line; resolve relative URLs and proxy them
      try {
        const resolvedUrl = new URL(line, url).href;
        const proxyPath = isMasterPlaylist ? "/m3u8-proxy" : "/ts-proxy";
        newLines.push(
          `${web_server_url}${proxyPath}?url=${encodeURIComponent(resolvedUrl)}`
        );
      } catch {
        // fallback if URL parsing fails
        newLines.push(line);
      }
    }
  }

  // Remove sensitive headers before sending response
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

  // Set required headers with no-cache and CORS support
  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // Log proxied playlist for debugging
  console.log(
    "Proxied playlist content:\n" + newLines.join("\r\n").substring(0, 2000) // log first 2000 chars max
  );

  // Use CRLF line endings for Roku compatibility
  res.end(newLines.join("\r\n"));
}
