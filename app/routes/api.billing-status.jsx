import { authenticate, unauthenticated } from "../shopify.server";

export async function loader({ request }) {
  // Authenticate the embedded extension request to establish which shop is
  // asking, then check billing with the shop's offline app session. This keeps
  // the result consistent for store owners and staff members.
  const { session, cors } = await authenticate.admin(request);

  try {
    const { admin } = await unauthenticated.admin(session.shop);
    const response = await admin.graphql(
      `query OrderSightBillingStatus {
        currentAppInstallation {
          activeSubscriptions {
            name
            status
          }
        }
      }`,
    );
    const result = await response.json();

    if (!response.ok || result.errors?.length) {
      throw new Error(
        result.errors?.map((error) => error.message).join(", ") ||
          `Shopify billing query failed (${response.status})`,
      );
    }

    const subscriptions =
      result?.data?.currentAppInstallation?.activeSubscriptions || [];
    const activeSubscription =
      subscriptions.find((subscription) => subscription.status === "ACTIVE") ||
      subscriptions[0] ||
      null;

    return cors(
      Response.json({
        hasActivePayment: activeSubscription?.status === "ACTIVE",
        status: activeSubscription?.status || "NOT_ACTIVE",
        planName: activeSubscription?.name || "",
      }),
    );
  } catch (error) {
    console.error("Order page billing status check failed:", error);
    return cors(
      Response.json(
        { error: "Unable to verify the store subscription." },
        { status: 503 },
      ),
    );
  }
}
