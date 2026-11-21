const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { createReview, validateReview } = require("./lib/reviews");

const publicDirectory = __dirname;
const dataDirectory = path.join(__dirname, "data");
const reviewsFile = path.join(dataDirectory, "reviews.json");
const maxRequestSize = 16 * 1024;
let saveQueue = Promise.resolve();

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function loadReviews() {
  try {
    const contents = await fs.readFile(reviewsFile, "utf8");
    const reviews = JSON.parse(contents);
    if (!Array.isArray(reviews)) {
      throw new Error("Stored reviews must be a JSON array");
    }
    return reviews;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let exceededLimit = false;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxRequestSize) {
        exceededLimit = true;
        return;
      }
      body += chunk.toString("utf8");
    });

    request.on("end", () => {
      if (exceededLimit) {
        const error = new Error("Request body is too large");
        error.statusCode = 413;
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        const error = new Error("Request body must be valid JSON");
        error.statusCode = 400;
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function saveReview(review) {
  const operation = saveQueue.then(async () => {
    const reviews = await loadReviews();
    reviews.unshift(review);
    await fs.mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${reviewsFile}.${randomUUID()}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(reviews, null, 2), "utf8");
    await fs.rename(temporaryFile, reviewsFile);
  });
  saveQueue = operation.catch(() => {});
  return operation;
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const isAsset = pathname.startsWith("/assets/");
  if (pathname !== "/" && pathname !== "/index.html" && !isAsset) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);
  const allowedDirectory = isAsset
    ? `${path.join(publicDirectory, "assets")}${path.sep}`
    : `${publicDirectory}${path.sep}`;
  if (!filePath.startsWith(allowedDirectory)) {
    response.writeHead(403);
    response.end();
    return;
  }

  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    throw error;
  }
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, "http://localhost");
  if (requestUrl.pathname === "/api/reviews") {
    if (request.method === "GET") {
      sendJson(response, 200, await loadReviews());
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405, { Allow: "GET, POST" });
      response.end();
      return;
    }

    const value = await readJsonBody(request);
    const validationError = validateReview(value);
    if (validationError) {
      sendJson(response, 400, { error: validationError });
      return;
    }

    const review = createReview(value);
    await saveReview(review);
    sendJson(response, 201, { review });
    return;
  }

  await serveStatic(request, response, decodeURIComponent(requestUrl.pathname));
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode ? error.message : "The server could not complete the request."
      });
    } else {
      response.destroy();
    }
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Bosslady review site running at http://localhost:${port}`);
});
