import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export default function extension() {
  render(<Extension />, document.body);
}

function Extension() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState({
    lowStockThreshold: 2,
    showOutOfStockHighlight: true,
    showFulfillmentHint: true,
    appLocked: true,
    billingStatus: 'NOT_ACTIVE',
    billingPlanName: '',
  });

  const pageSize = 2;
  const orderId = shopify.data.selected?.[0]?.id;

  useEffect(() => {
    if (!orderId) {
      setError('No order detected.');
      setLoading(false);
      return;
    }

    setPage(1);
    loadInventory();
  }, [orderId]);

  async function loadSettings() {
    try {
      console.log("🔍 Block: Starting settings fetch...");

      const response = await shopify.fetch('/api/settings');

      console.log("🔍 Block: Response status =", response.status);

      if (!response.ok) {
        throw new Error(`Settings request failed (${response.status})`);
      }

      const json = await response.json();
      console.log("✅ Block: Settings loaded from server =", json);

      return {
        lowStockThreshold: Number(json?.lowStockThreshold ?? 2),
        showOutOfStockHighlight: json?.showOutOfStockHighlight ?? true,
        showFulfillmentHint: json?.showFulfillmentHint ?? true,
      };
    } catch (err) {
      console.error("❌ Block: Settings load FAILED:", err);
      return {
        lowStockThreshold: 2,
        showOutOfStockHighlight: true,
        showFulfillmentHint: true,
      };
    }
  }

  async function adminGraphQL(query, variables = {}) {
    const response = await fetch('shopify:admin/api/graphql.json', {
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    });

    const json = await response.json();

    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join(', '));
    }

    return json;
  }

  async function loadBillingStatus() {
    try {
      const result = await adminGraphQL(`
        query ExtensionBillingStatus {
          currentAppInstallation {
            activeSubscriptions {
              id
              name
              status
            }
          }
        }
      `);

      const activeSubscriptions =
        result?.data?.currentAppInstallation?.activeSubscriptions || [];

      const activeSubscription =
        activeSubscriptions.find((sub) => sub.status === 'ACTIVE') ||
        activeSubscriptions[0] ||
        null;

      const billingStatus = activeSubscription?.status || 'NOT_ACTIVE';
      const billingPlanName = activeSubscription?.name || '';
      const appLocked = billingStatus !== 'ACTIVE';

      return {
        appLocked,
        billingStatus,
        billingPlanName,
      };
    } catch (err) {
      console.error('Billing status load failed:', err);

      return {
        appLocked: true,
        billingStatus: 'UNAVAILABLE',
        billingPlanName: '',
      };
    }
  }

  function getInventoryInsights(
    locations,
    orderedQty,
    tracked,
    lowStockThreshold,
  ) {
    if (tracked === false) {
      return {
        totalAvailable: 0,
        outOfStock: false,
        lowStock: false,
        bestLocationText: 'Inventory tracking disabled',
      };
    }

    const safeLocations = Array.isArray(locations) ? locations : [];

    const totalAvailable = safeLocations.reduce(
      (sum, loc) => sum + Math.max(0, Number(loc.available) || 0),
      0,
    );

    const fulfillableLocations = safeLocations
      .filter((loc) => Math.max(0, Number(loc.available) || 0) >= orderedQty)
      .sort(
        (a, b) =>
          Math.max(0, Number(b.available) || 0) -
          Math.max(0, Number(a.available) || 0),
      );

    const fallbackLocations = [...safeLocations].sort(
      (a, b) =>
        Math.max(0, Number(b.available) || 0) -
        Math.max(0, Number(a.available) || 0),
    );

    const bestLocation = fulfillableLocations[0] || fallbackLocations[0] || null;
    const outOfStock = totalAvailable <= 0;
    const lowStock = !outOfStock && totalAvailable <= lowStockThreshold;

    let bestLocationText = 'No locations can fulfill this order';

    if (bestLocation) {
      const bestQty = Math.max(0, Number(bestLocation.available) || 0);

      if (bestQty >= orderedQty) {
        bestLocationText = `${bestLocation.locationName} can fulfill (${bestQty} available)`;
      } else if (bestQty > 0) {
        bestLocationText = `${bestLocation.locationName} has the most stock (${bestQty} available)`;
      }
    }

    return {
      totalAvailable,
      outOfStock,
      lowStock,
      bestLocationText,
    };
  }

  async function loadInventory() {
    try {
      setLoading(true);
      setError('');

      const loadedSettings = await loadSettings();
      const billingInfo = await loadBillingStatus();

      const mergedSettings = {
        ...loadedSettings,
        ...billingInfo,
      };

      setSettings(mergedSettings);

      if (billingInfo.appLocked) {
        setItems([]);
        setLoading(false);
        return;
      }

      const locationsResult = await adminGraphQL(`
        query AllLocations {
          locations(first: 100, includeInactive: false) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `);

      const allLocations =
        locationsResult?.data?.locations?.edges?.map((edge) => ({
          id: edge.node.id,
          name: edge.node.name,
        })) || [];

      const orderResult = await adminGraphQL(
        `
          query OrderLineItems($id: ID!) {
            order(id: $id) {
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    name
                    quantity
                    sku
                    image {
                      url
                      altText
                    }
                    product {
                      title
                    }
                    variant {
                      title
                      inventoryItem {
                        id
                        tracked
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        { id: orderId },
      );

      const lineItems =
        orderResult?.data?.order?.lineItems?.edges?.map((e) => e.node) || [];

      const results = [];

      for (const item of lineItems) {
        const inventoryItemId = item?.variant?.inventoryItem?.id;
        const tracked = item?.variant?.inventoryItem?.tracked;

        const productTitle = item.product?.title || item.name || 'Unknown item';
        const rawVariantTitle =
          item.variant?.title && item.variant.title !== 'Default Title'
            ? item.variant.title
            : '';

        const variantTitle =
          rawVariantTitle &&
          rawVariantTitle.trim().toLowerCase() !== productTitle.trim().toLowerCase()
            ? rawVariantTitle
            : '';

        const baseItem = {
          name: item.name || 'Unknown item',
          productTitle,
          variantTitle,
          imageUrl: item.image?.url || '',
          imageAlt: item.image?.altText || item.name || 'Product image',
          sku: item.sku || 'No SKU',
          orderedQty: item.quantity || 0,
        };

        if (!inventoryItemId || tracked === false) {
          const mergedLocations = allLocations.map((loc) => ({
            locationId: loc.id,
            locationName: loc.name,
            available: 0,
          }));

          const insights = getInventoryInsights(
            mergedLocations,
            baseItem.orderedQty,
            false,
            loadedSettings.lowStockThreshold,
          );

          results.push({
            ...baseItem,
            tracked: false,
            locations: mergedLocations,
            ...insights,
          });
          continue;
        }

        const inventoryResult = await adminGraphQL(
          `
            query InventoryLevels($id: ID!) {
              inventoryItem(id: $id) {
                inventoryLevels(first: 100) {
                  edges {
                    node {
                      location {
                        id
                        name
                      }
                      quantities(names: ["available"]) {
                        name
                        quantity
                      }
                    }
                  }
                }
              }
            }
          `,
          { id: inventoryItemId },
        );

        const levels =
          inventoryResult?.data?.inventoryItem?.inventoryLevels?.edges || [];

        const levelMap = new Map();

        for (const edge of levels) {
          const locationId = edge.node.location?.id;
          const availableQty = Math.max(
            0,
            edge.node.quantities?.find((q) => q.name === 'available')?.quantity ?? 0,
          );

          if (locationId) {
            levelMap.set(locationId, {
              locationId,
              available: availableQty,
            });
          }
        }

        const mergedLocations = allLocations.map((loc) => {
          const match = levelMap.get(loc.id);
          return {
            locationId: loc.id,
            locationName: loc.name,
            available: match ? Math.max(0, match.available) : 0,
          };
        });

        const insights = getInventoryInsights(
          mergedLocations,
          baseItem.orderedQty,
          true,
          loadedSettings.lowStockThreshold,
        );

        results.push({
          ...baseItem,
          tracked: true,
          locations: mergedLocations,
          ...insights,
        });
      }

      setItems(results);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading inventory');
    } finally {
      setLoading(false);
    }
  }

  const collapsedSummary = loading
    ? 'Loading…'
    : error
      ? 'Error'
      : settings.appLocked
        ? 'Locked'
        : `${items.length} item${items.length === 1 ? '' : 's'}`;

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const visibleItems = items.slice(startIndex, startIndex + pageSize);

  return (
    <s-admin-block
      heading="Inventory Availability"
      collapsed-summary={collapsedSummary}
    >
      <s-stack direction="block" gap="extra-tight">
        {loading ? (
          <s-box padding="small">
            <s-text>Loading inventory…</s-text>
          </s-box>
        ) : error ? (
          <s-box padding="small">
            <s-text>{error}</s-text>
          </s-box>
        ) : settings.appLocked ? (
          <s-box padding="small">
            <s-stack direction="block" gap="small">
              <s-text fontweight="bold">Billing required</s-text>
              <s-text>
                Start your 7-day free trial in OrderSight to unlock inventory
                availability on orders.
              </s-text>
            </s-stack>
          </s-box>
        ) : items.length === 0 ? (
          <s-box padding="small">
            <s-text>No items found.</s-text>
          </s-box>
        ) : (
          <>
            <s-box padding="small">
              <s-stack direction="block" gap="small">
                {visibleItems.map((item, index) => {
                  const actualIndex = startIndex + index;
                  const isLastVisible = index === visibleItems.length - 1;

                  return (
                    <s-box key={`${item.sku}-${actualIndex}`} padding="none">
                      <s-stack direction="block" gap="extra-tight">
                        <s-stack direction="inline" gap="small" alignment="start">
                          <s-box inlineSize="28px" minInlineSize="28px">
                            {item.imageUrl ? (
                              <s-image
                                src={item.imageUrl}
                                alt={item.imageAlt}
                                aspectRatio="1/1"
                                objectFit="contain"
                                inlineSize="28px"
                                blockSize="28px"
                                borderRadius="small"
                              />
                            ) : (
                              <s-box
                                inlineSize="28px"
                                minInlineSize="28px"
                                minBlockSize="28px"
                                borderRadius="small"
                                background="subdued"
                              />
                            )}
                          </s-box>

                          <s-box inlineSize="fill">
                            <s-stack direction="block" gap="none">
                              <s-text fontweight="bold" numberOfLines={1}>
                                {item.productTitle || item.name}
                              </s-text>

                              {item.variantTitle ? (
                                <s-text appearance="subdued" size="small" numberOfLines={1}>
                                  {item.variantTitle}
                                </s-text>
                              ) : null}

                              <s-text appearance="subdued" size="small">
                                SKU: {item.sku} | Qty: {item.orderedQty}
                              </s-text>

                              <s-text appearance="subdued" size="small" numberOfLines={2}>
                                {item.tracked === false
                                  ? 'Tracking disabled'
                                  : item.locations
                                      .map(
                                        (loc) => `${loc.locationName}: ${loc.available ?? 0}`,
                                      )
                                      .join(' | ')}
                              </s-text>

                              {item.tracked !== false && settings.showFulfillmentHint ? (
                                <s-inline-stack gap="extra-tight" alignment="start">
                                  <s-badge tone="success">
                                    {item.bestLocationText}
                                  </s-badge>
                                </s-inline-stack>
                              ) : null}

                              {item.tracked !== false && item.lowStock ? (
                                <s-inline-stack gap="extra-tight" alignment="start">
                                  <s-badge tone="warning">
                                    Low stock ({item.totalAvailable})
                                  </s-badge>
                                </s-inline-stack>
                              ) : null}

                              {item.tracked !== false &&
                              item.outOfStock &&
                              settings.showOutOfStockHighlight ? (
                                <s-inline-stack gap="extra-tight" alignment="start">
                                  <s-badge tone="critical">Out of stock</s-badge>
                                </s-inline-stack>
                              ) : null}
                            </s-stack>
                          </s-box>
                        </s-stack>

                        {!isLastVisible ? (
                          <s-box paddingBlockStart="small">
                            <s-divider />
                          </s-box>
                        ) : null}
                      </s-stack>
                    </s-box>
                  );
                })}
              </s-stack>
            </s-box>

            {items.length > pageSize ? (
              <s-box paddingInline="small" paddingBlockStart="none" paddingBlockEnd="small">
                <s-stack direction="inline" gap="small" alignment="center">
                  <s-button
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </s-button>

                  <s-text appearance="subdued" size="small">
                    Page {page} of {totalPages}
                  </s-text>

                  <s-button
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                  >
                    Next
                  </s-button>
                </s-stack>
              </s-box>
            ) : null}
          </>
        )}
      </s-stack>
    </s-admin-block>
  );
}
