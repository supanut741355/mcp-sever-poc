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

const makeRequest = async (): Promise<Product[]> => {
  const response = await fetch(API_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as Product[];
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

  return server;
};

serveStdio(createServer, {
  onerror: (err) => console.error("Yo MCP server error:", err)
})
console.error("Yo MCP server running on stdio")