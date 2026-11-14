const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 8765;
const ROOT = __dirname;
const SNAPP_API = "https://app.snapp.taxi/api/api-base/v3/passenger/ride/history";
const SNAPPFOOD_API = "https://snappfood.ir/mobile/v1/order/reorder";

async function getDeviceFingerprint() {
  const source = await fs.readFile(path.join(ROOT, "snapp.js"), "utf8");
  const fingerprint = source.match(/const DEVICE_FINGERPRINT = "([^"]+)"/)?.[1];

  if (!fingerprint) {
    throw new Error("Device fingerprint was not found in snapp.js");
  }

  return fingerprint;
}

function send(response, status, body, contentType) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  });
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${HOST}:${PORT}`);

    if (request.method === "OPTIONS") {
      send(response, 204, "", "text/plain; charset=utf-8");
      return;
    }

    if (url.pathname === "/snapp-api" || url.pathname === "/snappfood-api") {
      const authorization = request.headers.authorization;
      if (!authorization?.startsWith("Bearer ")) {
        send(
          response,
          401,
          JSON.stringify({ error: "Snapp token is required" }),
          "application/json; charset=utf-8"
        );
        return;
      }

      if (url.pathname === "/snappfood-api") {
        const query = new URLSearchParams({
          lat: "35.774",
          long: "51.418",
          optionalClient: "WEBSITE",
          client: "WEBSITE",
          deviceType: "WEBSITE",
          appVersion: "8.1.1",
          locale: "fa",
          page: url.searchParams.get("page") || "0",
          size: url.searchParams.get("page_size") || "100",
        });
        const apiResponse = await fetch(`${SNAPPFOOD_API}?${query}`, {
          headers: {
            accept: "application/json, text/plain, */*",
            Authorization: authorization,
            origin: "https://superapp.snappfood.ir",
            referer: "https://superapp.snappfood.ir/",
            "x-is-bonyan": "true",
          },
        });
        const body = await apiResponse.text();
        send(response, apiResponse.status, body, "application/json; charset=utf-8");
        return;
      }

      const fingerprint = await getDeviceFingerprint();
      const query = new URLSearchParams({
        page: url.searchParams.get("page") || "1",
        archive: url.searchParams.get("archive") || "0",
      });
      const apiResponse = await fetch(`${SNAPP_API}?${query}`, {
        headers: {
          Authorization: authorization,
          "X-Device-Fingerprint": fingerprint,
          "x-app-name": "passenger-pwa",
          "x-app-version": "v18.46.0",
          "App-Version": "pwa",
          locale: "fa-IR",
        },
      });
      const body = await apiResponse.text();
      send(response, apiResponse.status, body, "application/json; charset=utf-8");
      return;
    }

    const files = {
      "/": ["snapp.html", "text/html; charset=utf-8"],
      "/snapp.html": ["snapp.html", "text/html; charset=utf-8"],
      "/snapp.js": ["snapp.js", "text/javascript; charset=utf-8"],
    };
    const file = files[url.pathname];

    if (!file) {
      send(response, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const body = await fs.readFile(path.join(ROOT, file[0]));
    send(response, 200, body, file[1]);
  } catch (error) {
    send(
      response,
      500,
      JSON.stringify({ error: error.message }),
      "application/json; charset=utf-8"
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Snapp report: http://${HOST}:${PORT}`);
});
