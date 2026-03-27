import {useEffect, useMemo, useState, useCallback} from "react";
import {
  AppProvider,
  Page,
  Layout,
  Card,
  Tabs,
  Button,
  Banner,
  TextField,
  Checkbox,
  InlineGrid,
  Box,
  Text,
  Badge,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import db from "../db.server";
import {authenticate} from "../shopify.server";
import {
  useLoaderData,
  useSearchParams,
  Form,
  useActionData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";

function formatBillingStatus(status) {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PENDING":
      return "Pending approval";
    case "PENDING_CANCELLED":
      return "Pending cancellation";
    case "CANCELLED":
      return "Cancelled";
    case "DECLINED":
      return "Declined";
    case "EXPIRED":
      return "Expired";
    case "FROZEN":
      return "Frozen";
    case "NOT_ACTIVE":
      return "Not active";
    default:
      return status || "Not active";
  }
}

function billingBadgeTone(status) {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PENDING":
    case "PENDING_CANCELLED":
      return "attention";
    default:
      return undefined;
  }
}

function billingStatusMessage(status, hasActivePayment) {
  if (hasActivePayment) {
    return "This shop has an active Shopify subscription for OrderSight.";
  }

  switch (status) {
    case "PENDING":
      return "A plan has been selected in Shopify and is awaiting completion or confirmation.";
    case "PENDING_CANCELLED":
      return "This subscription is pending cancellation in Shopify.";
    case "DECLINED":
      return "The previous billing approval was declined. Open the Shopify plan page to try again.";
    case "CANCELLED":
      return "This subscription was cancelled. Open the Shopify plan page to choose a new plan.";
    case "EXPIRED":
      return "This subscription expired. Open the Shopify plan page to select a new plan.";
    case "FROZEN":
      return "This subscription is currently frozen in Shopify.";
    default:
      return "Choose a plan in Shopify to begin your 7-day free trial and unlock OrderSight.";
  }
}

export const loader = async ({request}) => {
  const {admin, session} = await authenticate.admin(request);
  const url = new URL(request.url);

  let settings = await db.appSettings.findUnique({
    where: {shop: session.shop},
  });

  if (!settings) {
    try {
      settings = await db.appSettings.create({
        data: {
          shop: session.shop,
          lowStockThreshold: 2,
          showOutOfStockHighlight: true,
          showFulfillmentHint: true,
        },
      });
    } catch (err) {
      console.log("Create settings failed:", err);

      settings = {
        lowStockThreshold: 2,
        showOutOfStockHighlight: true,
        showFulfillmentHint: true,
      };
    }
  }

  let billingInfo = {
    hasActivePayment: false,
    rawStatus: "NOT_ACTIVE",
    statusLabel: "Not active",
    planName: "No active plan",
    priceText: "$9.99 USD every 30 days",
    managedPricingUrl: "",
    error: "",
  };

  try {
    const billingResponse = await admin.graphql(
      `#graphql
        query ManagedPricingStatus {
          currentAppInstallation {
            activeSubscriptions {
              id
              name
              status
              lineItems {
                plan {
                  pricingDetails {
                    __typename
                    ... on AppRecurringPricing {
                      interval
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
    );

    const billingJson = await billingResponse.json();
    const activeSubscriptions =
      billingJson?.data?.currentAppInstallation?.activeSubscriptions || [];

    const activeSubscription =
      activeSubscriptions.find((sub) => sub.status === "ACTIVE") ||
      activeSubscriptions[0] ||
      null;

    const recurringPricing =
      activeSubscription?.lineItems?.[0]?.plan?.pricingDetails?.__typename ===
      "AppRecurringPricing"
        ? activeSubscription.lineItems[0].plan.pricingDetails
        : null;

    let priceText = "$9.99 USD every 30 days";

    if (
      recurringPricing?.price?.amount &&
      recurringPricing?.price?.currencyCode
    ) {
      const intervalText =
        recurringPricing.interval === "EVERY_30_DAYS"
          ? "every 30 days"
          : recurringPricing.interval === "ANNUAL"
            ? "every year"
            : recurringPricing.interval;

      priceText = `$${recurringPricing.price.amount} ${recurringPricing.price.currencyCode} ${intervalText}`;
    }

    const storeHandle = session.shop.replace(".myshopify.com", "");
    const appHandle = process.env.SHOPIFY_MANAGED_PRICING_HANDLE || "";

    const managedPricingUrl = appHandle
      ? `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`
      : "";

    const rawStatus = activeSubscription?.status || "NOT_ACTIVE";
    const hasActivePayment = Boolean(
      activeSubscription && activeSubscription.status === "ACTIVE",
    );

    billingInfo = {
      hasActivePayment,
      rawStatus,
      statusLabel: formatBillingStatus(rawStatus),
      planName: activeSubscription?.name || "No active plan",
      priceText,
      managedPricingUrl,
      error: "",
    };
  } catch (error) {
    console.error("Managed pricing loader error:", error);

    const storeHandle = session.shop.replace(".myshopify.com", "");
    const appHandle = process.env.SHOPIFY_MANAGED_PRICING_HANDLE || "";

    billingInfo = {
      hasActivePayment: false,
      rawStatus: "UNAVAILABLE",
      statusLabel: "Unavailable",
      planName: "Unavailable",
      priceText: "$9.99 USD every 30 days",
      managedPricingUrl: appHandle
        ? `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`
        : "",
      error: error?.message || "Unable to load billing status.",
    };
  }

  const storeHandle = session.shop.replace(".myshopify.com", "");

  return {
    shop: session.shop,
    shopAdminOrdersUrl: `https://admin.shopify.com/store/${storeHandle}/orders`,
    settings: {
      lowStockThreshold: settings.lowStockThreshold,
      showOutOfStockHighlight: settings.showOutOfStockHighlight,
      showFulfillmentHint: settings.showFulfillmentHint,
    },
    billing: {
      ...billingInfo,
      returnState: url.searchParams.get("billing") || "",
      missingHandle: !process.env.SHOPIFY_MANAGED_PRICING_HANDLE,
    },
  };
};

export const action = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const formData = await request.formData();

  const lowStockThreshold = Number(formData.get("lowStockThreshold") || 2);
  const showOutOfStockHighlight =
    formData.get("showOutOfStockHighlight") === "true";
  const showFulfillmentHint =
    formData.get("showFulfillmentHint") === "true";

  await db.appSettings.upsert({
    where: {shop: session.shop},
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

  return {
    success: true,
  };
};

function SummaryTile({label, value}) {
  return (
    <Box
      padding="400"
      background="bg-surface-secondary"
      borderRadius="300"
      borderWidth="025"
      borderColor="border"
    >
      <Text as="p" variant="bodySm" tone="subdued">
        {label}
      </Text>
      <Box paddingBlockStart="100">
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {value}
        </Text>
      </Box>
    </Box>
  );
}

function FeatureCard({title, text}) {
  return (
    <Card>
      <Box padding="400">
        <Text as="h3" variant="headingMd">
          {title}
        </Text>
        <Box paddingBlockStart="200">
          <Text as="p" variant="bodyMd" tone="subdued">
            {text}
          </Text>
        </Box>
      </Box>
    </Card>
  );
}

function OnboardingStep({stepNumber, title, text}) {
  return (
    <div style={styles.stepRow}>
      <div style={styles.stepNumber}>{stepNumber}</div>

      <div style={styles.stepContent}>
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
        <Box paddingBlockStart="100">
          <Text as="p" variant="bodyMd" tone="subdued">
            {text}
          </Text>
        </Box>
      </div>
    </div>
  );
}

export default function AppIndex() {
  const {shop, shopAdminOrdersUrl, settings, billing} = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();

  const hasActivePlan = billing.hasActivePayment;
  const requestedTab = searchParams.get("tab") || "home";
  const currentTab = hasActivePlan ? requestedTab : "billing";
  const isSaving = navigation.state === "submitting";

  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(settings.lowStockThreshold ?? 2),
  );
  const [showOutOfStockHighlight, setShowOutOfStockHighlight] = useState(
    Boolean(settings.showOutOfStockHighlight),
  );
  const [showFulfillmentHint, setShowFulfillmentHint] = useState(
    Boolean(settings.showFulfillmentHint),
  );

  const onboardingHiddenKey = `ordersight-onboarding-hidden-${shop}`;
  const [onboardingHidden, setOnboardingHidden] = useState(false);

  useEffect(() => {
    setLowStockThreshold(String(settings.lowStockThreshold ?? 2));
    setShowOutOfStockHighlight(Boolean(settings.showOutOfStockHighlight));
    setShowFulfillmentHint(Boolean(settings.showFulfillmentHint));
  }, [settings]);

  useEffect(() => {
    if (!hasActivePlan && requestedTab !== "billing") {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "billing");
      setSearchParams(next);
    }
  }, [hasActivePlan, requestedTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedHidden = window.localStorage.getItem(onboardingHiddenKey);
      setOnboardingHidden(savedHidden === "true");
    } catch (error) {
      console.error("Failed to load onboarding state", error);
    }
  }, [onboardingHiddenKey]);

  const hideOnboarding = useCallback(() => {
    setOnboardingHidden(true);

    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(onboardingHiddenKey, "true");
    } catch (error) {
      console.error("Failed to hide onboarding", error);
    }
  }, [onboardingHiddenKey]);

  const showOnboarding = useCallback(() => {
    setOnboardingHidden(false);

    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(onboardingHiddenKey, "false");
    } catch (error) {
      console.error("Failed to show onboarding", error);
    }
  }, [onboardingHiddenKey]);

  const tabs = useMemo(
    () => [
      {id: "home", content: "Home"},
      {id: "settings", content: "Settings"},
      {id: "billing", content: "Billing"},
    ],
    [],
  );

  const selectedTabIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === currentTab),
  );

  const handleTabChange = useCallback(
    (selectedTab) => {
      const nextTab = tabs[selectedTab]?.id || "home";
      const next = new URLSearchParams(searchParams);

      if (!hasActivePlan && nextTab !== "billing") {
        next.set("tab", "billing");
      } else {
        next.set("tab", nextTab);
      }

      setSearchParams(next);
    },
    [tabs, searchParams, setSearchParams, hasActivePlan],
  );

  const openSettingsTab = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "settings");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  return (
    <AppProvider i18n={{}}>
      <link rel="stylesheet" href={polarisStyles} />

      <div style={styles.page}>
        <div style={styles.container}>
          <Page
            title="OrderSight Inventory Insights"
            subtitle="View location-based inventory directly inside Shopify orders and make faster fulfillment decisions."
          >
            <Layout>
              <Layout.Section>
                <Card>
                  <Box padding="500">
                    <div style={styles.headerTopRow}>
                      <Badge tone="success">Connected</Badge>
                    </div>

                    <div style={styles.tabsWrapper}>
                      <Tabs
                        tabs={tabs}
                        selected={selectedTabIndex}
                        onSelect={handleTabChange}
                      />
                    </div>

                    {!hasActivePlan && (
                      <div style={styles.bannerWrap}>
                        <Banner tone="warning">
                          <p>
                            Choose a plan in Shopify to begin your 7-day free
                            trial and unlock OrderSight.
                          </p>
                        </Banner>
                      </div>
                    )}

                    <InlineGrid columns={{xs: 1, md: 3}} gap="400">
                      <SummaryTile label="Connected shop" value={shop} />
                      <SummaryTile
                        label="Low stock threshold"
                        value={lowStockThreshold || "0"}
                      />
                      <SummaryTile
                        label="Fulfillment suggestion"
                        value={showFulfillmentHint ? "Enabled" : "Disabled"}
                      />
                    </InlineGrid>
                  </Box>
                </Card>
              </Layout.Section>

              {hasActivePlan && currentTab === "home" && (
                <>
                  {!onboardingHidden ? (
                    <>
                      <Layout.Section>
                        <Card>
                          <Box padding="500">
                            <div style={styles.sectionHeaderRow}>
                              <div>
                                <Text as="h2" variant="headingLg">
                                  Get started
                                </Text>
                                <Box paddingBlockStart="100">
                                  <Text as="p" variant="bodyMd" tone="subdued">
                                    OrderSight works inside the Shopify order
                                    page. Add the block once, and your team can
                                    start checking location-based inventory
                                    while reviewing orders.
                                  </Text>
                                </Box>
                              </div>

                              <InlineStack gap="200" wrap>
                                <a
                                  href={shopAdminOrdersUrl}
                                  target="_top"
                                  rel="noreferrer"
                                  style={{textDecoration: "none"}}
                                >
                                  <Button variant="primary">
                                    Open Shopify Orders
                                  </Button>
                                </a>
                                <Button onClick={openSettingsTab}>
                                  Review settings
                                </Button>
                                <Button onClick={hideOnboarding}>
                                  Hide this guide
                                </Button>
                              </InlineStack>
                            </div>

                            <div style={styles.onboardingCard}>
                              <BlockStack gap="500">
                                <OnboardingStep
                                  stepNumber="1"
                                  title="Open any order in Shopify admin"
                                  text="Use the button above to go straight to your Orders list, then open any order."
                                />
                                <OnboardingStep
                                  stepNumber="2"
                                  title="Add the OrderSight block"
                                  text='On the order page, scroll to the Blocks section, click “+ Block”, then add “OrderSight Inventory Insights”.'
                                />
                                <OnboardingStep
                                  stepNumber="3"
                                  title="Pin the block for easier access"
                                  text="Once added, pin the block so it stays available during your order workflow."
                                />
                                <OnboardingStep
                                  stepNumber="4"
                                  title="Adjust app settings if needed"
                                  text="You can change low stock threshold, out-of-stock highlighting, and fulfillment suggestions from the Settings tab."
                                />
                              </BlockStack>
                            </div>
                          </Box>
                        </Card>
                      </Layout.Section>

                      <Layout.Section variant="oneHalf">
                        <Card>
                          <Box padding="400">
                            <Text as="h3" variant="headingSm">
                              Where to add the block
                            </Text>

                            <Box paddingBlockStart="200">
                              <img
                                src="/setup-add-block.png"
                                alt="Where to click + Block on the Shopify order page"
                                style={styles.sideGuideImage}
                              />
                            </Box>

                            <Box paddingBlockStart="200">
                              <Text as="p" variant="bodySm" tone="subdued">
                                Look for the “+ Block” button in the Blocks
                                section of the order page.
                              </Text>
                            </Box>
                          </Box>
                        </Card>
                      </Layout.Section>
                    </>
                  ) : (
                    <Layout.Section>
                      <Card>
                        <Box padding="500">
                          <div style={styles.sectionHeaderRow}>
                            <div>
                              <Text as="h2" variant="headingMd">
                                Setup guide hidden
                              </Text>
                              <Box paddingBlockStart="100">
                                <Text as="p" variant="bodyMd" tone="subdued">
                                  You can reopen the onboarding guide at any
                                  time if you want to review the one-time block
                                  setup steps.
                                </Text>
                              </Box>
                            </div>

                            <InlineStack gap="200" wrap>
                              <Button onClick={showOnboarding}>
                                Show guide again
                              </Button>
                              <a
                                href={shopAdminOrdersUrl}
                                target="_top"
                                rel="noreferrer"
                                style={{textDecoration: "none"}}
                              >
                                <Button variant="primary">
                                  Open Shopify Orders
                                </Button>
                              </a>
                            </InlineStack>
                          </div>
                        </Box>
                      </Card>
                    </Layout.Section>
                  )}

                  <Layout.Section>
                    <InlineGrid columns={{xs: 1, md: 3}} gap="400">
                      <FeatureCard
                        title="Low stock alerts"
                        text="Surface inventory pressure early so teams can act before delays or backorders happen."
                      />
                      <FeatureCard
                        title="Out-of-stock visibility"
                        text="Make unavailable items obvious at a glance during order review."
                      />
                      <FeatureCard
                        title="Fulfillment suggestions"
                        text="Help staff choose the best location faster and reduce split shipments."
                      />
                    </InlineGrid>
                  </Layout.Section>

                  <Layout.Section>
                    <Card>
                      <Box padding="500">
                        <Text as="h2" variant="headingMd">
                          What to expect
                        </Text>

                        <div style={styles.listRows}>
                          <div style={styles.listRow}>
                            <Text as="span" variant="bodyMd">
                              Inventory visibility by location
                            </Text>
                            <Badge tone="success">Included</Badge>
                          </div>

                          <div style={styles.listRow}>
                            <Text as="span" variant="bodyMd">
                              Configurable inventory signals
                            </Text>
                            <Badge tone="success">Included</Badge>
                          </div>

                          <div style={styles.listRowNoBorder}>
                            <Text as="span" variant="bodyMd">
                              Settings saved per connected shop
                            </Text>
                            <Badge tone="success">Included</Badge>
                          </div>
                        </div>

                        <Box paddingBlockStart="300">
                          <Banner tone="info">
                            <p>
                              Shopify requires the merchant to add the admin
                              block to the order page. OrderSight cannot place
                              that block automatically during install.
                            </p>
                          </Banner>
                        </Box>
                      </Box>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneThird">
                    <Card>
                      <Box padding="400">
                        <Text as="h3" variant="headingSm">
                          App status
                        </Text>
                        <Box paddingBlockStart="200">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            Installed and connected. Settings are saved inside
                            the app and applied to the order inventory
                            experience.
                          </Text>
                        </Box>
                      </Box>
                    </Card>
                  </Layout.Section>
                </>
              )}

              {hasActivePlan && currentTab === "settings" && (
                <>
                  <Layout.Section>
                    <Form method="post" id="settings-form">
                      <input
                        type="hidden"
                        name="lowStockThreshold"
                        value={lowStockThreshold}
                      />
                      <input
                        type="hidden"
                        name="showOutOfStockHighlight"
                        value={showOutOfStockHighlight ? "true" : "false"}
                      />
                      <input
                        type="hidden"
                        name="showFulfillmentHint"
                        value={showFulfillmentHint ? "true" : "false"}
                      />

                      <Card>
                        <Box padding="500">
                          <div style={styles.sectionHeaderRow}>
                            <div>
                              <Text as="h2" variant="headingMd">
                                Settings
                              </Text>
                              <Box paddingBlockStart="100">
                                <Text as="p" variant="bodyMd" tone="subdued">
                                  Configure how inventory signals appear inside
                                  the order inventory experience.
                                </Text>
                              </Box>
                            </div>

                            <Button submit variant="primary" loading={isSaving}>
                              Save settings
                            </Button>
                          </div>

                          {actionData?.success && (
                            <div style={styles.bannerWrap}>
                              <Banner tone="success">
                                <p>Settings saved successfully.</p>
                              </Banner>
                            </div>
                          )}

                          <div style={styles.formSection}>
                            <TextField
                              label="Low stock threshold"
                              type="number"
                              autoComplete="off"
                              value={lowStockThreshold}
                              onChange={setLowStockThreshold}
                              helpText="Items at or below this quantity can be treated as low stock."
                            />
                          </div>

                          <div style={styles.divider} />

                          <div style={styles.checkboxStack}>
                            <Checkbox
                              label="Highlight out-of-stock items"
                              checked={showOutOfStockHighlight}
                              onChange={setShowOutOfStockHighlight}
                              helpText="Adds stronger visual emphasis to unavailable inventory."
                            />

                            <Checkbox
                              label="Show fulfillment suggestion"
                              checked={showFulfillmentHint}
                              onChange={setShowFulfillmentHint}
                              helpText="Shows the best fulfillment location suggestion when available."
                            />
                          </div>
                        </Box>
                      </Card>
                    </Form>
                  </Layout.Section>

                  <Layout.Section variant="oneThird">
                    <Card>
                      <Box padding="400">
                        <Text as="h3" variant="headingSm">
                          Live preview
                        </Text>

                        <div style={styles.listRowsCompact}>
                          <div style={styles.listRow}>
                            <Text as="span" variant="bodyMd">
                              Low stock threshold
                            </Text>
                            <Badge>{lowStockThreshold || "0"}</Badge>
                          </div>

                          <div style={styles.listRow}>
                            <Text as="span" variant="bodyMd">
                              Out-of-stock highlight
                            </Text>
                            <Badge
                              tone={
                                showOutOfStockHighlight ? "success" : undefined
                              }
                            >
                              {showOutOfStockHighlight ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>

                          <div style={styles.listRowNoBorder}>
                            <Text as="span" variant="bodyMd">
                              Fulfillment suggestion
                            </Text>
                            <Badge
                              tone={showFulfillmentHint ? "success" : undefined}
                            >
                              {showFulfillmentHint ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                        </div>
                      </Box>
                    </Card>
                  </Layout.Section>
                </>
              )}

              {currentTab === "billing" && (
                <>
                  <Layout.Section>
                    <Card>
                      <Box padding="500">
                        <div style={styles.sectionHeaderRow}>
                          <div>
                            <Text as="h2" variant="headingMd">
                              Billing
                            </Text>
                            <Box paddingBlockStart="100">
                              <Text as="p" variant="bodyMd" tone="subdued">
                                Manage your Shopify subscription for OrderSight.
                              </Text>
                            </Box>
                          </div>

                          {billing.managedPricingUrl ? (
                            <a
                              href={billing.managedPricingUrl}
                              target="_top"
                              rel="noreferrer"
                              style={{textDecoration: "none"}}
                            >
                              <Button variant="primary">
                                Manage Shopify plan
                              </Button>
                            </a>
                          ) : null}
                        </div>

                        <Box paddingBlockEnd="400">
                          <img
                            src="/feature-1.png"
                            alt="OrderSight inventory preview"
                            style={{
                              width: "100%",
                              display: "block",
                              borderRadius: "12px",
                              border: "1px solid #e1e3e5",
                            }}
                          />
                        </Box>

                        {!hasActivePlan && !billing.error && (
                          <div style={styles.bannerWrap}>
                            <Banner tone="info">
                              <p>
                                Start your 7-day free trial to unlock real-time
                                inventory visibility directly inside Shopify
                                orders.
                              </p>
                            </Banner>
                          </div>
                        )}

                        {billing.missingHandle && (
                          <div style={styles.bannerWrap}>
                            <Banner tone="warning">
                              <p>
                                Missing SHOPIFY_MANAGED_PRICING_HANDLE in your
                                environment settings. Add it to enable the
                                Shopify hosted plan page button.
                              </p>
                            </Banner>
                          </div>
                        )}

                        {billing.returnState === "approved" && (
                          <div style={styles.bannerWrap}>
                            <Banner tone="success">
                              <p>Billing was approved successfully.</p>
                            </Banner>
                          </div>
                        )}

                        {billing.error && (
                          <div style={styles.bannerWrap}>
                            <Banner tone="warning">
                              <p>{billing.error}</p>
                            </Banner>
                          </div>
                        )}

                        <div style={styles.trialPoints}>
                          <div style={styles.trialPoint}>• 7-day free trial</div>
                          <div style={styles.trialPoint}>
                            • $9.99 USD/month after trial
                          </div>
                          <div style={styles.trialPoint}>• Cancel anytime</div>
                        </div>

                        <div style={styles.listRows}>
                          <div style={styles.listRow}>
                            <Text as="span" variant="bodyMd">
                              Current plan
                            </Text>
                            <Badge>{billing.planName}</Badge>
                          </div>

                          <div style={styles.listRow}>
                            <Text as="span" variant="bodyMd">
                              Price
                            </Text>
                            <Text as="span" variant="bodyMd">
                              {billing.priceText}
                            </Text>
                          </div>

                          <div style={styles.listRow}>
                            <Text as="span" variant="bodyMd">
                              Subscription status
                            </Text>
                            <Badge tone={billingBadgeTone(billing.rawStatus)}>
                              {billing.statusLabel}
                            </Badge>
                          </div>

                          <div style={styles.listRowNoBorder}>
                            <Text as="span" variant="bodyMd">
                              Billing mode
                            </Text>
                            <Text as="span" variant="bodyMd">
                              Shopify managed pricing
                            </Text>
                          </div>
                        </div>

                        <Box paddingBlockStart="300">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            Plan selection and billing approval are handled by
                            Shopify.
                          </Text>
                        </Box>
                      </Box>
                    </Card>
                  </Layout.Section>

                  <Layout.Section variant="oneThird">
                    <Card>
                      <Box padding="400">
                        <Text as="h3" variant="headingSm">
                          Plan status
                        </Text>
                        <Box paddingBlockStart="200">
                          <Badge tone={billingBadgeTone(billing.rawStatus)}>
                            {billing.hasActivePayment
                              ? "Active plan"
                              : billing.statusLabel}
                          </Badge>
                        </Box>
                        <Box paddingBlockStart="200">
                          <Text as="p" variant="bodyMd" tone="subdued">
                            {billingStatusMessage(
                              billing.rawStatus,
                              billing.hasActivePayment,
                            )}
                          </Text>
                        </Box>
                      </Box>
                    </Card>

                    {hasActivePlan && (
                      <Box paddingBlockStart="400">
                        <Card>
                          <Box padding="400">
                            <Text as="h3" variant="headingSm">
                              Next step after billing
                            </Text>
                            <Box paddingBlockStart="200">
                              <Text as="p" variant="bodyMd" tone="subdued">
                                After your plan is active, go to the Home tab
                                for the guided setup steps to add the OrderSight
                                block to the Shopify order page.
                              </Text>
                            </Box>
                          </Box>
                        </Card>
                      </Box>
                    )}
                  </Layout.Section>
                </>
              )}
            </Layout>
          </Page>
        </div>
      </div>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  let message = "Unknown error";

  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <AppProvider i18n={{}}>
      <link rel="stylesheet" href={polarisStyles} />
      <div style={styles.page}>
        <div style={styles.container}>
          <Page title="OrderSight Inventory Insights">
            <Layout>
              <Layout.Section>
                <Card>
                  <Box padding="500">
                    <Banner tone="critical">
                      <p>{message}</p>
                    </Banner>
                  </Box>
                </Card>
              </Layout.Section>
            </Layout>
          </Page>
        </div>
      </div>
    </AppProvider>
  );
}

const styles = {
  page: {
    background: "#f6f6f7",
    minHeight: "100vh",
    padding: "16px",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  headerTopRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: "16px",
  },
  tabsWrapper: {
    marginBottom: "20px",
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },
  bannerWrap: {
    marginBottom: "18px",
  },
  formSection: {
    marginBottom: "20px",
  },
  divider: {
    height: "1px",
    background: "#e1e3e5",
    margin: "20px 0",
  },
  checkboxStack: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  listRows: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginTop: "16px",
  },
  listRowsCompact: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginTop: "16px",
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "12px 0",
    borderBottom: "1px solid #e1e3e5",
  },
  listRowNoBorder: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "12px 0 0 0",
  },
  trialPoints: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "18px",
    marginBottom: "6px",
  },
  trialPoint: {
    fontSize: "14px",
    color: "#6d7175",
  },
  onboardingCard: {
    marginTop: "20px",
    border: "1px solid #e1e3e5",
    borderRadius: "12px",
    padding: "20px",
    background: "#ffffff",
  },
  stepRow: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: "32px",
    minWidth: "32px",
    height: "32px",
    borderRadius: "999px",
    background: "#f1f2f3",
    border: "1px solid #d2d5d8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: 600,
    color: "#202223",
  },
  stepContent: {
    flex: 1,
    paddingTop: "4px",
  },
  sideGuideImage: {
    width: "100%",
    display: "block",
    borderRadius: "12px",
    border: "1px solid #e1e3e5",
  },
};
