import crypto from "crypto";

export const action = async ({ request }) => {
  try {
    const rawBody = await request.text();

    const hmacHeader = request.headers.get("x-shopify-hmac-sha256") || "";
    const topic = request.headers.get("x-shopify-topic") || "";
    const shop = request.headers.get("x-shopify-shop-domain") || "";

    const digest = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(rawBody, "utf8")
      .digest("base64");

    // Use timing-safe comparison (IMPORTANT)
    const valid =
      hmacHeader.length === digest.length &&
      crypto.timingSafeEqual(
        Buffer.from(hmacHeader),
        Buffer.from(digest)
      );

    if (!valid) {
      console.log("❌ Invalid webhook HMAC");
      return new Response("Unauthorized", { status: 401 });
    }

    console.log(`✅ Valid webhook: ${topic} from ${shop}`);

    // Parse AFTER validation
    const payload = JSON.parse(rawBody);

    switch (topic) {
      case "customers/data_request":
        console.log("customers/data_request", payload);
        break;

      case "customers/redact":
        console.log("customers/redact", payload);
        break;

      case "shop/redact":
        console.log("shop/redact", payload);
        break;

      default:
        console.log("Unhandled topic:", topic);
    }

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500 });
  }
};
