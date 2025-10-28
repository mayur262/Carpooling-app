/**
 * Mock Asset Registry for Metro bundler
 * This provides a fallback when the real AssetRegistry cannot be resolved
 */

const assets = [];

function registerAsset(asset) {
  return assets.push(asset);
}

function getAssetByID(assetId) {
  return assets[assetId - 1];
}

module.exports = {
  registerAsset,
  getAssetByID,
};