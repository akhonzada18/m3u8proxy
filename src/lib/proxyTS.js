import http from "node:http";
import https from "node:https";
import getRefererForURL from "./getReferer.js";

export async function proxyTs(url, req, res) {
  let forceHTTPS = url.startsWith("https://");

  const uri = new URL(url);
  const options = {
    hostname: uri.hostname,
    port: uri.port || (forceHTTPS ? 443 : 80),
    path: uri.pathname + uri.search,
    method: req.method,
    headers: {
      Referer: getRefererForURL(url),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    },
  };

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  try {
    const proxy = (forceHTTPS ? https : http).request(options, (r) => {
      r.headers["content-type"] = "video/mp2t";
      res.writeHead(r.statusCode ?? 200, r.headers);
      r.pipe(res, { end: true });
    });

    req.pipe(proxy, { end: true });

    proxy.on("error", (err) => {
      res.writeHead(500);
      res.end(err.message);
    });
  } catch (e) {
    res.writeHead(500);
    res.end(e.message);
  }
}
