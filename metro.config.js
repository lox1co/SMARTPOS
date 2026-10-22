// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the bulk-import Excel template as a static asset.
config.resolver.assetExts.push('xlsx');

module.exports = config;