let paymentMiddleware;
try {
  const x402 = await import("x402-express");
  paymentMiddleware = x402.paymentMiddleware;
} catch {
  console.log("x402-express not installed — AI agent payments disabled");
}

const PRICING = {
  "POST /api/convert":   "$0.005",
  "GET /api/status/:id": "$0.001",
};

const PAY_TO_ADDRESS = process.env.X402_PAYOUT_ADDRESS;

export function applyX402(app) {
  if (!paymentMiddleware) return;
  app.use(
    paymentMiddleware(
      PAY_TO_ADDRESS,
      PRICING,
      {
        network: "base",
        facilitator: { url: "https://x402.org/facilitator" },
        skip: (req) => !!req.headers.authorization?.startsWith("Bearer spool_"),
      },
    ),
  );
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
