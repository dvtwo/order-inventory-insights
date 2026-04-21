import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>

        {/* HERO */}
        <h1 className={styles.heading}>
          OrderSight Inventory Insights
        </h1>

        <p className={styles.text}>
          Real-time inventory visibility directly inside Shopify orders.
        </p>

        <p className={styles.text}>
          Help your team view inventory by location, identify low stock instantly,
          and make faster fulfillment decisions without leaving the order page.
        </p>

        {/* LOGIN */}
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Enter your Shopify store</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="your-store.myshopify.com"
              />
            </label>

            <button className={styles.button} type="submit">
              Log in with Shopify
            </button>
          </Form>
        )}

        {/* FEATURES */}
        <ul className={styles.list}>
          <li>
            <strong>Inventory by location.</strong> Instantly see stock levels
            across all locations for every order line item.
          </li>
          <li>
            <strong>Low stock visibility.</strong> Identify inventory issues
            before they impact fulfillment.
          </li>
          <li>
            <strong>Better fulfillment decisions.</strong> Give your team the
            context they need to choose the right location faster.
          </li>
        </ul>

      </div>
    </div>
  );
}
