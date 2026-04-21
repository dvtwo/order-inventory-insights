import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }) => {
  // If a shop query param is present, redirect to OAuth automatically
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function Auth() {
  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Install OrderSight Inventory Insights">
          <s-text>
            This app must be installed from the Shopify App Store. Please visit
            the App Store to add OrderSight to your store.
          </s-text>
        </s-section>
      </s-page>
    </AppProvider>
  );
}
