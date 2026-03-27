import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  return json({
    success: true,
    message: "Session token verified! Shopify will now see this.",
    shop: session.shop,
    timestamp: new Date().toISOString(),
  });
};
