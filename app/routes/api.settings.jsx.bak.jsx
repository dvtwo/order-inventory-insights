import db from "../db.server";
import {authenticate} from "../shopify.server";

export async function loader({request}) {
  const {session, cors} = await authenticate.admin(request);

  const settings = await db.appSettings.findUnique({
    where: {shop: session.shop},
  });

  return cors(
    Response.json({
      shop: session.shop,
      lowStockThreshold: Number(settings?.lowStockThreshold ?? 2),
      showOutOfStockHighlight: settings?.showOutOfStockHighlight ?? true,
      showFulfillmentHint: settings?.showFulfillmentHint ?? true,
    }),
  );
}

export async function action({request}) {
  const {cors} = await authenticate.admin(request);

  return cors(
    Response.json(
      {error: "Method not allowed"},
      {status: 405},
    ),
  );
}
