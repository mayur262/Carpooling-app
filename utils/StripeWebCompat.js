// Platform-specific Stripe compatibility wrapper
// Metro will automatically pick the correct file based on platform:
// - StripeWebCompat.web.js for web
// - StripeWebCompat.native.js for native platforms

// This file serves as the main entry point that re-exports from platform-specific files
// The actual implementation is in the .web.js and .native.js files

throw new Error('This file should not be loaded directly. Metro should resolve to .web.js or .native.js based on platform');