import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, BlockStack, Text, Banner } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

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
              <Banner title="✅ App is running" tone="success">
                <p>Shop: <strong>{shop}</strong></p>
                <p>Session token is now active for Shopify checks.</p>
              </Banner>

              <Text as="p" variant="bodyMd">
                This is the minimal working page.<br />
                Your full dashboard will be restored in the next update.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
