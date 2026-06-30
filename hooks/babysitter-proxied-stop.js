#!/usr/bin/env node
"use strict";
var execSync = require("child_process").execSync;
var path = require("path");
var readFileSync = require("fs").readFileSync;

var PLUGIN_ROOT = process.env.PI_PLUGIN_ROOT || process.env.PLUGIN_ROOT || path.resolve(__dirname, "..");
var stdin = "";
try { stdin = readFileSync(0, "utf8"); } catch (e) { process.stderr.write("[extensions-adapter] stdin read failed: " + (e instanceof Error ? e.message : String(e)) + "\n"); }
try {
  var result = execSync("bash " + JSON.stringify(path.join(PLUGIN_ROOT, "hooks/stop.sh")), {
    input: stdin,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30000,
    env: Object.assign({}, process.env, {
      HOOK_TYPE: process.env.HOOK_TYPE || "",
      ADAPTER_NAME: process.env.ADAPTER_NAME || "pi",
      PLUGIN_ROOT: PLUGIN_ROOT,
      CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT
    })
  });
  process.stdout.write(result);
} catch (e) {
  process.stderr.write("[extensions-adapter] hook execution failed: " + (e instanceof Error ? e.message : String(e)) + "\n");
  process.stdout.write(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) + "\n");
  process.exit(1);
}
