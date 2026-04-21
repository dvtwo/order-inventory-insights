import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  let settings = await prisma.appSettings.findUnique({
    where: { shop: session.shop },
  });

  if (!settings) {
    settings = {
      lowStockThreshold: 2,
      showFulfillmentHint: true,
    };
  }

  return Response.json({
    lowStockThreshold: settings.lowStockThreshold,
    fulfillmentSuggestion: settings.showFulfillmentHint,
  });
}
