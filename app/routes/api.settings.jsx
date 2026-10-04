import db from "../db.server";
import { authenticate } from "../shopify.server";

function normalizeLocationIds(value) {
  return Array.isArray(value)
    ? value.filter((id) => typeof id === "string" && id.length > 0)
    : null;
}

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
      enabledLocationIds: normalizeLocationIds(settings?.enabledLocationIds),
    }),
  );
}

function parseEnabledLocationIds(value) {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string" && id.length > 0)
      : [];
  } catch {
    return [];
  }
}

export async function action({ request }) {
  const { session, cors } = await authenticate.admin(request);

  const formData = await request.formData();

  const lowStockThreshold = parseInt(
    formData.get("lowStockThreshold") ?? "2",
    10,
  );
  const showOutOfStockHighlight =
    formData.get("showOutOfStockHighlight") === "true";
  const showFulfillmentHint = formData.get("showFulfillmentHint") === "true";
  const enabledLocationIds = parseEnabledLocationIds(
    formData.get("enabledLocationIds"),
  );

  await db.appSettings.upsert({
    where: { shop: session.shop },
    update: {
      lowStockThreshold,
      showOutOfStockHighlight,
      showFulfillmentHint,
      enabledLocationIds,
    },
    create: {
      shop: session.shop,
      lowStockThreshold,
      showOutOfStockHighlight,
      showFulfillmentHint,
      enabledLocationIds,
    },
  });

  return cors(Response.json({ success: true }));
}
