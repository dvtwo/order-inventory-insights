import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  try {
    const { topic, shop } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    await db.session.deleteMany({
      where: { shop },
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("app/uninstalled webhook error:", error);
    return new Response("Webhook error", { status: 500 });
  }
};
