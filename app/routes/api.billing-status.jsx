import { authenticate, unauthenticated } from "../shopify.server";

export async function loader({ request }) {
  // Authenticate the extension request to establish the shop, then check billing
  // with the shop offline session so staff access is consistent.
  const { session, cors } = await authenticate.admin(request);

  try {
    const { admin } = await unauthenticated.admin(session.shop);
    const response = await admin.graphql("#graphql query OrderSightBillingStatus { currentAppInstallation { activeSubscriptions { name status } } }");
    const result = await response.json();

    if (!response.ok || result.errors?.length) {
      throw new Error(result.errors?.map((error) => error.message).join(", ") || "Shopify billing query failed (" + response.status + ")");
    }

    const subscriptions = result?.data?.currentAppInstallation?.activeSubscriptions || [];
    const activeSubscription = subscriptions.find((subscription) => subscription.status === "ACTIVE") || subscriptions[0] || null;

    return cors(Response.json({
      hasActivePayment: activeSubscription?.status === "ACTIVE",
      status: activeSubscription?.status || "NOT_ACTIVE",
      planName: activeSubscription?.name || "",
    }));
  } catch (error) {
    console.error("Order page billing status check failed:", error);
    return cors(Response.json({ error: "Unable to verify the store subscription." }, { status: 503 }));
  }
}
