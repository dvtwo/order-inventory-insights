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

export const loader = async ({ request }) => {
  // This is the line Shopify checks for session tokens
  const { session, admin } = await authenticate.admin(request);

  return {
    shop: session.shop,
  };
};

export default function Index() {
  const { shop } = useLoaderData();

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
