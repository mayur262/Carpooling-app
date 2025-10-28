const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Get default asset extensions and ensure PNG files are handled
const defaultAssetExts = config.resolver.assetExts || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
config.resolver.assetExts = defaultAssetExts;

// Modify the resolver to redirect react-native-maps to mock for web platform
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle missing-asset-registry-path
  if (moduleName === 'missing-asset-registry-path') {
    try {
      // Try to resolve the asset registry from react-native
      const assetRegistryPath = require.resolve('react-native/Libraries/Image/AssetRegistry');
      return {
        filePath: assetRegistryPath,
        type: 'sourceFile',
      };
    } catch (error) {
      console.log('AssetRegistry not found, using fallback');
      // Create a simple mock for the asset registry
      const mockRegistryPath = path.resolve(__dirname, 'web-mocks/asset-registry-mock.js');
      return {
        filePath: mockRegistryPath,
        type: 'sourceFile',
      };
    }
  }

  // Redirect react-native-maps to mock implementation for web platform
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'web-mocks/react-native-maps.js'),
      type: 'sourceFile',
    };
  }
  
  // Fall back to the original resolver
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  
  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;