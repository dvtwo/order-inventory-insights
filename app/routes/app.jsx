import { Outlet, useLoaderData } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  // Force session token validation at root level
  await authenticate.admin(request);

  return {
    apiKey: process.env.SHOPIFY_API_KEY,
  };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider
      apiKey={apiKey}
      embedded               // ← This is required for session tokens check
    >
      <Outlet />
    </AppProvider>
  );
}
