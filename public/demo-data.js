export const demoRepository = {
  owner: "example",
  name: "sample-shop",
  branch: "main",
  files: [
    {
      path: "src/auth/session.ts",
      language: "TypeScript",
      content: `import { apiClient } from "../lib/api";
import { clearSession, saveSession } from "./token";

const MAX_REFRESH_RETRIES = 1;

export async function refreshSession() {
  let attempts = 0;

  while (attempts <= MAX_REFRESH_RETRIES) {
    try {
      const response = await apiClient.post("/auth/refresh");
      saveSession(response.data);
      return response.data;
    } catch (error) {
      attempts += 1;

      if (attempts > MAX_REFRESH_RETRIES) {
        clearSession();
        throw error;
      }
    }
  }
}`,
      trace: {
        title: "Login sessions were expiring too early",
        explanation:
          "Users on slow networks were being signed out when token refresh timed out. This retry gives the refresh request one more chance before the session is cleared.",
        confidence: 87,
        evidence: [
          {
            type: "issue",
            label: "Issue #42 · Login timeout",
            detail: "Reports sign-outs on slow networks",
            url: "https://github.com/example/sample-shop/issues/42",
            date: "2026-02-12T10:00:00Z"
          },
          {
            type: "pull request",
            label: "PR #57 · Add retry guard",
            detail: "Introduces one controlled retry",
            url: "https://github.com/example/sample-shop/pull/57",
            date: "2026-02-15T10:00:00Z"
          },
          {
            type: "commit",
            label: "Commit a1b2c3",
            detail: "Handles failed token refresh",
            url: "https://github.com/example/sample-shop/commit/a1b2c3",
            date: "2026-02-15T11:00:00Z"
          }
        ]
      }
    },
    {
      path: "src/auth/token.ts",
      language: "TypeScript",
      content: `const TOKEN_KEY = "sample-shop-token";

export function saveSession(session) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
}

export function readSession() {
  const stored = localStorage.getItem(TOKEN_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}`,
      trace: {
        title: "Token access needed one safe entry point",
        explanation:
          "Authentication data used to be read directly in several components. This module keeps storage, expiry checks, and cleanup consistent.",
        confidence: 81,
        evidence: [
          {
            type: "issue",
            label: "Issue #31 · Stale tokens",
            detail: "Finds inconsistent token cleanup",
            url: "https://github.com/example/sample-shop/issues/31",
            date: "2026-01-05T10:00:00Z"
          },
          {
            type: "pull request",
            label: "PR #36 · Centralize auth state",
            detail: "Moves token access into one module",
            url: "https://github.com/example/sample-shop/pull/36",
            date: "2026-01-07T10:00:00Z"
          }
        ]
      }
    },
    {
      path: "src/cart/checkout.ts",
      language: "TypeScript",
      content: `import { getCurrentPrices } from "../products/api";

export async function prepareCheckout(cart) {
  const currentPrices = await getCurrentPrices(cart.productIds);

  const verifiedTotal = cart.items.reduce((total, item) => {
    const price = currentPrices[item.productId];
    return total + price * item.quantity;
  }, 0);

  return { ...cart, verifiedTotal };
}`,
      trace: {
        title: "The server must verify the checkout total",
        explanation:
          "Cart prices can change after a product is added. The checkout flow recalculates the total so customers are charged the latest valid price.",
        confidence: 92,
        evidence: [
          {
            type: "issue",
            label: "Issue #18 · Incorrect total",
            detail: "Reports stale prices at checkout",
            url: "https://github.com/example/sample-shop/issues/18",
            date: "2025-12-02T10:00:00Z"
          },
          {
            type: "commit",
            label: "Commit 9f8e7d",
            detail: "Prevents stale cart totals",
            url: "https://github.com/example/sample-shop/commit/9f8e7d",
            date: "2025-12-04T10:00:00Z"
          }
        ]
      }
    }
  ]
};
