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
              <Banner title="✅ App is now working" tone="success">
                <p>Shop: <strong>{shop}</strong></p>
              </Banner>

              <Text as="p" variant="bodyMd">
                OrderSight Inventory Insights is running.<br />
                Shopify’s Embedded App check should now see the session token.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
