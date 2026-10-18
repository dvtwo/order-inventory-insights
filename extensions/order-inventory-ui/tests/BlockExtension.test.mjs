import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real component with simulated Shopify responses and hook state.
// Shopify's hosted web components still need a visual check in a dev store.
const source = readFileSync(
  new URL("../src/BlockExtension.jsx", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: "preact",
    target: ts.ScriptTarget.ES2022,
  },
});

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (tree == null || typeof tree === "boolean") return [];
  if (typeof tree !== "object") return [tree];
  return [tree, ...nodes(tree.props.children)];
}

function text(tree) {
  return nodes(tree)
    .filter((node) => typeof node !== "object")
    .join("");
}

async function mount({
  active = true,
  orderId = "gid://shopify/Order/1",
  settingsFail = false,
  billingFail = false,
  orderFail = false,
} = {}) {
  const state = [];
  const effects = [];
  const calls = [];
  let cursor = 0;
  let component;
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const context = {
    exports,
    document: { body: {} },
    console: { error() {} },
    shopify: { data: { selected: orderId ? [{ id: orderId }] : [] } },
    require(name) {
      if (name === "@shopify/ui-extensions/preact") return {};
      if (name === "preact/jsx-runtime")
        return { jsx, jsxs: jsx, Fragment: "fragment" };
      if (name === "preact")
        return {
          render: (node) => {
            component = node.type;
            component();
          },
        };
      if (name === "preact/hooks")
        return {
          useState(initial) {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [
              state[index],
              (next) => {
                state[index] =
                  typeof next === "function" ? next(state[index]) : next;
              },
            ];
          },
          useEffect(effect) {
            effects.push(effect);
          },
        };
      throw new Error(`Unexpected import: ${name}`);
    },
    async fetch(url, options) {
      calls.push({ url, options });
      const response = (data) => ({ ok: true, json: async () => data });
      if (url === "/api/settings") {
        if (settingsFail) return { ok: false, status: 500 };
        return response({ lowStockThreshold: 2, enabledLocationIds: ["main"] });
      }
      assert.equal(url, "shopify:admin/api/graphql.json");
      const { query, variables } = JSON.parse(options.body);
      assert.match(
        query.trim(),
        /^query\b/,
        "Inventory extension must only read store data",
      );
      if (query.includes("ExtensionBillingStatus")) {
        if (billingFail)
          return response({ errors: [{ message: "Billing unavailable" }] });
        return response({
          data: {
            currentAppInstallation: {
              activeSubscriptions: active
                ? [{ name: "Standard", status: "ACTIVE" }]
                : [],
            },
          },
        });
      }
      if (query.includes("AllLocations"))
        return response({
          data: {
            locations: {
              edges: [
                { node: { id: "main", name: "Main warehouse" } },
                { node: { id: "disabled", name: "Disabled warehouse" } },
              ],
            },
          },
        });
      if (query.includes("OrderLineItems")) {
        assert.equal(variables.id, orderId);
        return response({
          data: {
            order: orderFail
              ? null
              : {
                  lineItems: {
                    edges: [2, 0, null, 8].map((quantity, index) => ({
                      node: {
                        id: `line-${index}`,
                        name: `Product ${index}`,
                        quantity: 1,
                        sku: `SKU-${index}`,
                        product: { title: `Product ${index}` },
                        variant: {
                          title: "Default Title",
                          inventoryItem: {
                            id: `inventory-${index}`,
                            tracked: quantity !== null,
                          },
                        },
                      },
                    })),
                  },
                },
          },
        });
      }
      if (query.includes("InventoryLevels")) {
        const index = Number(variables.id.split("-")[1]);
        const quantity = [2, 0, null, 8][index];
        const level = (id, count) => ({
          node: {
            location: { id },
            quantities: [
              { name: "on_hand", quantity: count },
              { name: "committed", quantity: 1 },
              { name: "available", quantity: Math.max(0, count - 1) },
            ],
          },
        });
        return response({
          data: {
            inventoryItem: {
              inventoryLevels: {
                edges: [level("main", quantity), level("disabled", 100)],
              },
            },
          },
        });
      }
      throw new Error("Unexpected GraphQL operation");
    },
  };
  vm.runInNewContext(outputText, context);
  exports.default();
  for (const effect of effects.splice(0)) effect();
  for (let attempt = 0; state[0] && attempt < 30; attempt++)
    await setImmediate();
  assert.equal(state[0], false, "Loading must finish");
  const render = () => {
    cursor = 0;
    return component();
  };
  return { render, calls };
}

test("inventory, location filtering, stock warnings and pagination survive the upgrade", async () => {
  const app = await mount();
  let tree = app.render();
  assert.equal(tree.props.collapsedSummary, "4 items");
  assert.match(text(tree), /Low stock \(2 on hand\)/);
  assert.match(text(tree), /Out of stock/);
  assert.doesNotMatch(text(tree), /Disabled warehouse|Default Title/);
  assert.match(text(tree), /Committed: 1.*Available: 1/);
  assert.match(text(tree), /Page 1 of 2/);
  const button = (label) =>
    nodes(tree).find(
      (node) => node.type === "s-button" && text(node) === label,
    );
  assert.equal(button("Previous").props.disabled, true);
  button("Next").props.onClick();
  tree = app.render();
  assert.match(text(tree), /Tracking disabled/);
  assert.match(text(tree), /Product 3/);
  assert.match(text(tree), /Page 2 of 2/);
  assert.equal(button("Next").props.disabled, true);
  button("Previous").props.onClick();
  assert.match(text(app.render()), /Page 1 of 2/);
});

test("inactive subscriptions remain locked without requesting inventory", async () => {
  const app = await mount({ active: false });
  assert.match(text(app.render()), /Subscription required/);
  assert.equal(app.render().props.collapsedSummary, "Locked");
  assert.equal(app.calls.length, 2);
});

test("billing errors keep the extension locked", async () => {
  const app = await mount({ billingFail: true });
  assert.match(text(app.render()), /Subscription required/);
  assert.equal(app.calls.length, 2);
});

test("settings failures retain the existing fallback behavior", async () => {
  const app = await mount({ settingsFail: true });
  assert.match(text(app.render()), /Disabled warehouse/);
  assert.equal(app.render().props.collapsedSummary, "4 items");
});

test("unavailable orders show the existing permission guidance", async () => {
  const app = await mount({ orderFail: true });
  assert.equal(app.render().props.collapsedSummary, "Error");
  assert.match(text(app.render()), /read_all_orders permission/);
});

test("missing order context shows an error without data requests", async () => {
  const app = await mount({ orderId: null });
  assert.match(text(app.render()), /No order detected/);
  assert.equal(app.calls.length, 0);
});
