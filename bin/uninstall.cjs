#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const shared = require('./install-shared');

const PACKAGE_ROOT = path.resolve(__dirname, '..');

function main() {
  const pluginRoot = shared.getHomePluginRoot();

  if (!fs.existsSync(pluginRoot)) {
    console.log(`[${shared.PLUGIN_NAME}] Plugin not installed at ${pluginRoot}`);
  } else {
    try {
      fs.rmSync(pluginRoot, { recursive: true, force: true });
      console.log(`[${shared.PLUGIN_NAME}] Uninstalled from ${pluginRoot}`);
    } catch (err) {
      console.error(`[${shared.PLUGIN_NAME}] Failed to uninstall: ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }

  // Harness-specific cleanup (managed hooks/skills surfaces, marketplace
  // entries) provided by the plugin's install surface, when present.
  if (typeof shared.harnessUninstall === 'function') {
    try {
      shared.harnessUninstall(PACKAGE_ROOT);
    } catch (err) {
      console.error(`[${shared.PLUGIN_NAME}] Failed to clean up harness state: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

main();
