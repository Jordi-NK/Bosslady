const { neon } = require("@neondatabase/serverless");
const { createReview, validateReview } = require("../lib/reviews");

let schemaPromise;

async function ensureReviewsTable(sql) {
  if (!schemaPromise) {
    schemaPromise = sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        product VARCHAR(16) NOT NULL CHECK (product IN ('Pure', 'Aura', 'Bosslady')),
        rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        message VARCHAR(1000) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `;
  }

  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = undefined;
    throw error;
  }
}

function sendError(response, statusCode, message) {
  response.status(statusCode).json({ error: message });
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendError(response, 405, "Method not allowed.");
    return;
  }

  if (!process.env.DATABASE_URL) {
    sendError(response, 503, "Review storage is not configured.");
    return;
  }

  let value;
  if (request.method === "POST") {
    value = request.body;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        sendError(response, 400, "Request body must be valid JSON.");
        return;
      }
    }

    const bodySize = Buffer.byteLength(JSON.stringify(value ?? ""));
    if (bodySize > 16 * 1024) {
      sendError(response, 413, "Request body is too large.");
      return;
    }

    const validationError = validateReview(value);
    if (validationError) {
      sendError(response, 400, validationError);
      return;
    }
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureReviewsTable(sql);

    if (request.method === "GET") {
      const rows = await sql`
        SELECT id, name, product, rating, message, created_at AS "createdAt"
        FROM reviews
        ORDER BY created_at DESC, id DESC
        LIMIT 500
      `;
      response.status(200).json(rows);
      return;
    }

    const review = createReview(value);
    const [savedReview] = await sql`
      INSERT INTO reviews (id, name, product, rating, message, created_at)
      VALUES (
        ${review.id}::uuid,
        ${review.name},
        ${review.product},
        ${review.rating},
        ${review.message},
        ${review.createdAt}::timestamptz
      )
      RETURNING id, name, product, rating, message, created_at AS "createdAt"
    `;
    response.status(201).json({ review: savedReview });
  } catch (error) {
    console.error("Could not access review storage:", error);
    sendError(response, 500, "Reviews could not be loaded or saved.");
  }
};
