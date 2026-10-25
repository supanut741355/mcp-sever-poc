### For STDIO-based servers:
Never use console.log(), as it writes to standard output (stdout) by default. Writing to stdout will corrupt the JSON-RPC messages and break your server.


### For HTTP-based servers: 
Standard output logging is fine since it doesn’t interfere with HTTP responses.



```
npm install @modelcontextprotocol/server zod

npm install -D @types/node typescript
```

### Start mcp server
```
npx tsx ./index.ts
```

### Update Claude desktop config json
add mcp config