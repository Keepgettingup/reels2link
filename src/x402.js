let paymentMiddleware;
try {
  const x402 = await import("x402-express");
  paymentMiddleware = x402.paymentMiddleware;
} catch (err) {
  console.log("x402-express not installed — AI agent payments disabled:", err.message);
}

const PRICING = {
  "POST /api/convert":   "$0.005",
  "GET /api/status/:id": "$0.001",
};

const PAY_TO_ADDRESS = process.env.X402_PAYOUT_ADDRESS;

export function applyX402(app) {
  if (!paymentMiddleware || !PAY_TO_ADDRESS) return;
  const x402Mw = paymentMiddleware(
    PAY_TO_ADDRESS,
    PRICING,
    {
      network: "base-sepolia",
      facilitator: { url: "https://x402.org/facilitator" },
      skip: (req) => {
        const shouldSkip = !!req.headers.authorization?.startsWith("Bearer spool_");
        console.log('[x402] skip check:', req.method, req.path, 'auth:', req.headers.authorization?.substring(0, 30), 'skip:', shouldSkip);
        return shouldSkip;
      },
    },
  );
  // Wrap x402 so authenticated spool_ users bypass it entirely
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer spool_")) {
      console.log('[x402] Bypassing x402 — spool_ token:', auth.substring(0, 30));
      return next();
    }
    console.log('[x402] Running x402 middleware for:', req.method, req.path, 'auth:', auth?.substring(0, 30) || 'NONE');
    x402Mw(req, res, next);
  });
}

export function x402Discovery(req, res) {
  res.json({
    service: "SPOOL",
    version: "1.0",
    endpoints: Object.entries(PRICING).map(([endpoint, price]) => {
      const [method, path] = endpoint.split(" ");
      return {
        method,
        path,
        price,
        currency: "USDC",
        network: "base",
        description: descriptionFor(path),
      };
    }),
    docs: `${process.env.BASE_URL}/docs`,
  });
}

function descriptionFor(path) {
  if (path.includes("/convert")) return "Convert an Instagram Reel to a hosted video link";
  if (path.includes("/status"))  return "Check the status and expiry of a hosted link";
  return "";
}
