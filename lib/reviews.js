const { randomUUID } = require("node:crypto");

const products = new Set(["Pure", "Aura", "Bosslady"]);

function validateReview(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Review must be an object.";
  }

  const { name, product, rating, message } = value;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 60) {
    return "Name must be between 1 and 60 characters.";
  }
  if (typeof product !== "string" || !products.has(product)) {
    return "Please select a valid product.";
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "Rating must be between 1 and 5.";
  }
  if (typeof message !== "string" || !message.trim() || message.trim().length > 1000) {
    return "Review must be between 1 and 1000 characters.";
  }
  return null;
}

function createReview(value) {
  return {
    id: randomUUID(),
    name: value.name.trim(),
    product: value.product,
    rating: value.rating,
    message: value.message.trim(),
    createdAt: new Date().toISOString()
  };
}

module.exports = { createReview, validateReview };
