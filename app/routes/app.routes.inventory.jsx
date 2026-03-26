import prisma from "../db.server";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return Response.json(
      { error: "Missing shop parameter" },
      { status: 400 }
    );
  }

  let settings = await prisma.appSettings.findUnique({
    where: { shop },
  });

  if (!settings) {
    settings = {
      lowStockThreshold: 2,
      fulfillmentSuggestion: true,
    };
  }

  return Response.json({
    lowStockThreshold: settings.lowStockThreshold,
    fulfillmentSuggestion: settings.fulfillmentSuggestion,
  });
}
