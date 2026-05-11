const { defineConfig } = require("drizzle-kit");
const path = require("path");

module.exports = defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
