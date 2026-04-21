import { redirect } from "react-router";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
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
