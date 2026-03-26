import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  try {
    const { topic, shop } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("app/scopes_update webhook error:", error);
    return new Response("Webhook error", { status: 500 });
  }
};
