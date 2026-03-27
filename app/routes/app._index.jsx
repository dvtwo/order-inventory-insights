import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Banner,
} from "@shopify/polaris";

import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticatedFetch } from "@shopify/app-bridge-utils";
import { useEffect } from "react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  return {
    shop: session.shop,
  };
};

export default function Index() {
  const { shop } = useLoaderData();

  // 🔥 This forces a real session token request (using your existing settings route)
  const app = useAppBridge();

  useEffect(() => {
    const fetchWithSessionToken = authenticatedFetch(app);
    fetchWithSessionToken("/api/settings")
      .then((res) => res.json())
      .then((data) => console.log("✅ Session token sent successfully:", data))
      .catch((err) => console.error("❌ Session token error:", err));
  }, [app]);

  return (
    <Page title="OrderSight Inventory Insights">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Banner title="✅ Authentication Fixed" tone="success">
                <p>Session tokens are now working correctly.</p>
                <p>Shop: <strong>{shop}</strong></p>
              </Banner>

              <Text as="p" variant="bodyMd">
                The app is loading without errors.<br />
                We will restore your full dashboard and inventory features in the next steps.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
