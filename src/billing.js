import Stripe from "stripe";
import { updateUserTier } from "./database.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const TIER_PRICES = {
  pro:   process.env.STRIPE_PRICE_PRO?.trim(),
  ultra: process.env.STRIPE_PRICE_ULTRA?.trim(),
};

console.log('[STRIPE DEBUG] Price IDs loaded:', TIER_PRICES);

const PRICE_TO_TIER = Object.fromEntries(
  Object.entries(TIER_PRICES).map(([tier, price]) => [price.trim(), tier])
);

export async function createCheckoutSession({ email, tier }) {
  console.log('[STRIPE DEBUG] Creating checkout for:', { email, tier });
  console.log('[STRIPE DEBUG] All TIER_PRICES:', JSON.stringify(TIER_PRICES));
  const price = TIER_PRICES[tier];
  console.log('[STRIPE DEBUG] Price ID found:', price);
  console.log('[STRIPE DEBUG] Price length:', price?.length);
  console.log('[STRIPE DEBUG] Price starts with:', price?.slice(0, 10));
  if (!price) throw new Error(`Unknown tier: ${tier}`);
  if (!price.startsWith('price_')) throw new Error(`Invalid price ID format: ${price}`);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{ price, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/`,
    metadata: { tier },
  });
  return { url: session.url, id: session.id };
}

export async function cancelSubscription(email) {
  // Find customer by email
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length === 0) {
    throw new Error("No customer found");
  }
  const customer = customers.data[0];
  
  // Get active subscriptions
  const subscriptions = await stripe.subscriptions.list({ 
    customer: customer.id, 
    status: 'active',
    limit: 1 
  });
  
  if (subscriptions.data.length === 0) {
    throw new Error("No active subscription found");
  }
  
  // Cancel at period end
  const subscription = await stripe.subscriptions.update(subscriptions.data[0].id, {
    cancel_at_period_end: true,
  });
  
  return { 
    canceled: true, 
    current_period_end: subscription.current_period_end,
    message: "Subscription will cancel at end of billing period" 
  };
}

export async function handleStripeWebhook(rawBody, signature) {
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  );

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      const tier = session.metadata?.tier;
      if (email && tier) {
        const upgraded = await updateUserTier(email, tier);
        console.log(`Upgraded ${email} to ${tier}:`, upgraded?.id);
      }
      break;
    }
    case "customer.subscription.deleted":
    case "invoice.payment_failed": {
      const sub = event.data.object;
      const customer = await stripe.customers.retrieve(sub.customer);
      if (customer.email) {
        await updateUserTier(customer.email, "free");
        console.log(`Downgraded ${customer.email} to free`);
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const newPriceId = sub.items.data[0]?.price?.id;
      const newTier = PRICE_TO_TIER[newPriceId];
      const customer = await stripe.customers.retrieve(sub.customer);
      if (customer.email && newTier) {
        await updateUserTier(customer.email, newTier);
        console.log(`Retiered ${customer.email} to ${newTier}`);
      }
      break;
    }
  }
  return { received: true };
}
