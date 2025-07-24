import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";

/**
 * @param {Request} request -
 * @return {Response}
 */

// Default server URL provided manually
const web_server_url = "<public_url_of_edge_script>"; // Replace this with your public URL
const REFERER = "<custom_referer>";

BunnySDK.net.http.serve(async (request) => {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());

  // if (url.pathname === "/m3u8-proxy") {
  //   return proxyM3U8(url, headers);
  // } else if (url.pathname === "/ts-proxy") {
  //   return proxyTs(url, headers, request);
  // }
  if (url.pathname.endsWith(".m3u8")) {
    return proxyM3U8(url);
  } else if (url.pathname.endsWith(".ts")) {
    return proxyTs(url, request);
  }

  if (url.pathname === "/") {
    return new Response("Welcome to the Proxy Service", { status: 200 });
  }

  return new Response("Not Found", { status: 404 });
});

// function getCustomHeaders(targetUrl) {
//   const headers = {};
//   if (targetUrl.includes("tubeplx")) {
//     headers.Referer = "https://vidwish.live/";
//   } else if (targetUrl.includes("dotstream")) {
//     headers.Referer = "https://megaplay.buzz/";
//   }
//   headers["User-Agent"] = "Mozilla/5.0 ...";
//   return headers;
// }

function getCustomHeaders(targetUrl) {
  const headers = {};
  const hostname = new URL(targetUrl).hostname;

  if (hostname.includes("tubeplx")) {
    headers.Referer = "https://vidwish.live/";
  } else if (hostname.includes("dotstream")) {
    headers.Referer = "https://megaplay.buzz/";
  }

  headers["User-Agent"] = "Mozilla/5.0 ...";
  return headers;
}

async function proxyM3U8(url, headers) {
  // const targetUrl = url.searchParams.get("url");
  // const targetHeaders = JSON.parse(url.searchParams.get("headers") || "{}");

  const rawPath = url.pathname; // /anime/abc/master.m3u8

  const cdnMap = {
    dotstream: "cdn.dotstream.buzz",
    tubeplx: "tubeplx.viddsn.cfd",
  };

  const segments = url.pathname.split("/");
  const cdnSlug = segments[1]; // e.g. 'dotstream'
  const restPath = "/" + segments.slice(2).join("/");
  const host = cdnMap[cdnSlug];
  const targetUrl = `https://${host}${restPath}`;


  const customHeaders = getCustomHeaders(targetUrl);



  console.log({ rawPath, targetUrl, customHeaders });

  console.log("?????????????????????????");
  


  if (!targetUrl) {
    return new Response("URL is required", { status: 400 });
  }

  try {
    // Fetch the M3U8 file
    const response = await fetch(targetUrl, {
      headers: customHeaders,
    });
    if (!response.ok) {
      return new Response("Failed to fetch the M3U8 file", {
        status: response.status,
      });
    }

    let m3u8 = await response.text();
    m3u8 = m3u8
      .split("\n")
      .filter((line) => !line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO"))
      .join("\n");

    const newLines = m3u8.split("\n").map((line) => {
      if (line.startsWith("#")) {
        if (line.startsWith("#EXT-X-KEY:")) {
          const regex = /https?:\/\/[^\""\s]+/g;
          const keyUrl = regex.exec(line)?.[0] ?? "";
          const keyPath = new URL(keyUrl).pathname;

          // REPLACE with clean path format
          return line.replace(keyUrl, `/${cdnSlug}${keyPath}`);
        }
        return line;
      } else if (line.trim() !== "") {
        const mediaPath = new URL(line, targetUrl).pathname;
        return `/${cdnSlug}${mediaPath}`;
      }
      return line;
    });

    return new Response(newLines.join("\n"), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}

// async function proxyTs(url, request) {
//   const targetUrl = url.searchParams.get("url");
//   const targetHeaders = JSON.parse(url.searchParams.get("headers") || "{}");

//     const customHeaders = getCustomHeaders(targetUrl);

//   if (!targetUrl) {
//     return new Response("URL is required", { status: 400 });
//   }

//   try {
//     const response = await fetch(targetUrl, {
//       method: request.method,
//       headers: customHeaders,
//     });

//     if (!response.ok) {
//       return new Response("Failed to fetch TS segment", {
//         status: response.status,
//       });
//     }

//     return new Response(response.body, {
//       status: response.status,
//       headers: {
//         "Content-Type": "video/mp2t",
//         "Access-Control-Allow-Origin": "*",
//         "Access-Control-Allow-Headers": "*",
//         "Access-Control-Allow-Methods": "*",
//       },
//     });
//   } catch (error) {
//     return new Response(error.message, { status: 500 });
//   }
// }

async function proxyTs(url, request) {
  const cdnMap = {
    dotstream: "cdn.dotstream.buzz",
    tubeplx: "tubeplx.viddsn.cfd",
  };

  const segments = url.pathname.split("/");
  const cdnSlug = segments[1];
  const restPath = "/" + segments.slice(2).join("/");
  const host = cdnMap[cdnSlug];
  const targetUrl = `https://${host}${restPath}`;

  const customHeaders = getCustomHeaders(targetUrl);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: customHeaders,
    });

    if (!response.ok) {
      return new Response("Failed to fetch TS segment", {
        status: response.status,
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
}
