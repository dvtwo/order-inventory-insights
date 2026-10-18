# Block Extension

Admin block extensions enable app developers to build custom functionality into the context of Shopify Admin. These extensions surface as cards at various extension targets and enhance the merchant experience. Developers can build the content of these extensions using Shopify's UI Extension components for Admin.

Learn more about Admin block extensions in Shopify’s [developer documentation](https://shopify.dev/docs/apps/admin/admin-actions-and-blocks).

## API upgrade (2025-10 → 2026-07)

The extension configuration and UI extension package now target 2026-07.
Display properties use the supported web component names and spacing values.
Inventory calculations, billing checks, settings requests, GraphQL queries,
extension identity, and the order details target are unchanged.

Run these checks from the app root:

```sh
npm run check --workspace order-inventory-ui
npm test --workspace order-inventory-ui
shopify app build --skip-dependencies-installation
npm run build
```

The regression tests simulate Shopify responses and component state. Before
releasing, preview the block in a development store and check product images,
long product titles, enabled locations, stock badges, Previous/Next controls,
the collapsed summary, and the subscription-required message. These tests do
not verify Shopify's hosted rendering or live API responses.

The Shopify AI Toolkit component validator could not run because the installed
toolkit is missing its `data/types/index.json` file. Type checking against the
installed 2026.7.4 SDK and the Shopify extension build both pass instead.

Local changes do not update the released app or clear the dashboard warning.
After store preview and release approval, deploy a new Shopify app version.
Keep the previous active version available in Versions for rollback.
