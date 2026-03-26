import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session, cors } = await authenticate.admin(request);

  const settings = await db.appSettings.findUnique({
    where: { shop: session.shop },
  });

  return cors(
    Response.json({
      shop: session.shop,
      lowStockThreshold: Number(settings?.lowStockThreshold ?? 2),
      showOutOfStockHighlight: settings?.showOutOfStockHighlight ?? true,
      showFulfillmentHint: settings?.showFulfillmentHint ?? true,
    })
  );
}

export async function action({ request }) {
  const { session, cors } = await authenticate.admin(request);

  const formData = await request.formData();

  const lowStockThreshold = parseInt(formData.get("lowStockThreshold") ?? "2", 10);
  const showOutOfStockHighlight = formData.get("showOutOfStockHighlight") === "true";
  const showFulfillmentHint = formData.get("showFulfillmentHint") === "true";

  await db.appSettings.upsert({
    where: { shop: session.shop },
    update: {
      lowStockThreshold,
      showOutOfStockHighlight,
      showFulfillmentHint,
    },
    create: {
      shop: session.shop,
      lowStockThreshold,
      showOutOfStockHighlight,
      showFulfillmentHint,
    },
  });

  return cors(Response.json({ success: true }));
}
