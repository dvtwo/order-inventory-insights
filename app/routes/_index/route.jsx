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
        <h1 className={styles.heading}>OrderSight Inventory Insights</h1>

        <p className={styles.text}>
          See inventory across all locations — directly inside Shopify orders.
        </p>

        <p className={styles.subtext}>
          Identify low stock instantly and help your team make faster, more
          accurate fulfillment decisions without leaving the order page.
        </p>

        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span className={styles.labelText}>
                Get started with your Shopify store
              </span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="your-store.myshopify.com"
                autoComplete="off"
              />
              <span className={styles.helperText}>
                Enter your Shopify domain to securely log in and install the app.
              </span>
            </label>

            <button className={styles.button} type="submit">
              Log in with Shopify
            </button>
          </Form>
        )}

        <div className={styles.screenshotWrap}>
          <img
            src="/feature-1.png"
            alt="OrderSight inventory inside Shopify orders"
            className={styles.screenshot}
          />
        </div>

        <div className={styles.features}>
          <div className={styles.featureCard}>
            <strong className={styles.featureTitle}>Inventory by location</strong>
            <p className={styles.featureText}>
              Instantly see stock levels across all locations for every order
              line item.
            </p>
          </div>

          <div className={styles.featureCard}>
            <strong className={styles.featureTitle}>Low stock visibility</strong>
            <p className={styles.featureText}>
              Identify inventory issues before they impact fulfillment or cause
              delays.
            </p>
          </div>

          <div className={styles.featureCard}>
            <strong className={styles.featureTitle}>
              Better fulfillment decisions
            </strong>
            <p className={styles.featureText}>
              Give your team the context they need to choose the right location
              faster.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
