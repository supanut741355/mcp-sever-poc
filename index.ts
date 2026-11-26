import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const API_URL = process.env.MOCKAPI_URL;



interface Product {
  id: string;
  name: string;
  price: number;
}

// Generic request to MockAPI (supports /:id and JSON body)
const apiRequest = async <T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  id?: string,
  body?: unknown
): Promise<T> => {
  if (!API_URL) throw new Error("MOCKAPI_URL is not set");
  const url = id ? `${API_URL.replace(/\/$/, "")}/${encodeURIComponent(id)}` : API_URL;

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as T;
};

// Get all products
const makeRequest = (): Promise<Product[]> => apiRequest<Product[]>("GET");

// Search products by name
const searchProducts = async (
  keyword: string
): Promise<Product[]> => {
  const products = await makeRequest();

  return products.filter((product) =>
    product.name.toLowerCase().includes(keyword.toLowerCase())
  );
};

// Create MCP server
const createServer = () => {
  const server = new McpServer({
    name: "yo-app",
    version: "1.0.0",
  });

  server.registerTool(
    "get_products",
    {
      description: "Get all products data from MockAPI",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const products = await makeRequest();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(products, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Failed to fetch products:", error);

        return {
          content: [
            {
              type: "text",
              text: `Failed to get products: ${
                error instanceof Error
                  ? error.message
                  : "Unknown error"
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Search products
  server.registerTool(
    "search_products",
    {
      description: "Search products by name keyword",
      inputSchema: z.object({
        keyword: z.string().min(1).describe("Product name to search"),
      }),
    },
    async ({ keyword }) => {
      try {
        const products = await searchProducts(keyword);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  keyword,
                  count: products.length,
                  products,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text:
                error instanceof Error
                  ? error.message
                  : "Failed to search products",
            },
          ],
          isError: true,
        };
      }
    }
  );
  // Tool: Manage products (one tool, multiple actions)
  server.registerTool(
    "manage_products",
    {
      description:
        "Manage products in MockAPI with a single tool. Actions: " +
        "'list' (all products), 'get' (by id), 'search' (by name keyword), " +
        "'create' (name, price), 'update' (id + name and/or price), 'delete' (by id).",
      inputSchema: z.object({
        action: z
          .enum(["list", "get", "search", "create", "update", "delete"])
          .describe("Action to perform"),
        id: z.string().optional().describe("Product id (required for get, update, delete)"),
        keyword: z.string().optional().describe("Name keyword (required for search)"),
        name: z.string().optional().describe("Product name (required for create, optional for update)"),
        price: z.number().optional().describe("Product price (required for create, optional for update)"),
      }),
    },
    async ({ action, id, keyword, name, price }) => {
      const ok = (data: unknown) => ({
        content: [{ type: "text" as const, text: JSON.stringify({ action, data }, null, 2) }],
      });
      const fail = (message: string) => ({
        content: [{ type: "text" as const, text: `[${action}] ${message}` }],
        isError: true,
      });

      try {
        switch (action) {
          case "list":
            return ok(await makeRequest());

          case "get":
            if (!id) return fail("'id' is required");
            return ok(await apiRequest<Product>("GET", id));

          case "search": {
            if (!keyword) return fail("'keyword' is required");
            const products = await searchProducts(keyword);
            return ok({ keyword, count: products.length, products });
          }

          case "create":
            if (!name || price === undefined) return fail("'name' and 'price' are required");
            return ok(await apiRequest<Product>("POST", undefined, { name, price }));

          case "update": {
            if (!id) return fail("'id' is required");
            if (name === undefined && price === undefined)
              return fail("provide at least one of 'name' or 'price'");
            const patch: Partial<Product> = {};
            if (name !== undefined) patch.name = name;
            if (price !== undefined) patch.price = price;
            return ok(await apiRequest<Product>("PUT", id, patch));
          }

          case "delete":
            if (!id) return fail("'id' is required");
            return ok(await apiRequest<Product>("DELETE", id));
        }
      } catch (error: unknown) {
        console.error(`manage_products ${action} failed:`, error);
        return fail(error instanceof Error ? error.message : "Unknown error");
      }
    }
  );

  return server;
};

serveStdio(createServer, {
  onerror: (err) => console.error("Yo MCP server error:", err)
})
console.error("Yo MCP server running on stdio")