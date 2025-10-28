// Web-specific Stripe compatibility - completely avoids native modules
import { Platform } from 'react-native';

console.log('Loading web-specific Stripe compatibility layer');

// Mock CardField component for web
const CardField = ({
  postalCodeEnabled = true,
  cardStyle = {},
  style = {},
  onCardChange = () => {},
}) => {
  console.log('CardField mock rendered on web');
  return null;
};

// Mock useStripe hook for web
const useStripe = () => {
  console.log('useStripe mock called on web');
  return {
    confirmPayment: async () => ({ error: { message: 'Stripe not available on web' } }),
    presentApplePay: async () => ({ error: { message: 'Apple Pay not available on web' } }),
    confirmApplePayPayment: async () => ({ error: { message: 'Apple Pay not available on web' } }),
    isApplePaySupported: false,
  };
};

// Mock useConfirmPayment hook for web
const useConfirmPayment = () => {
  console.log('useConfirmPayment mock called on web');
  return async () => ({ error: { message: 'Stripe not available on web' } });
};

// Mock StripeProvider for web
const StripeProvider = ({ children, publishableKey }) => {
  console.log('StripeProvider mock rendered on web with key:', publishableKey);
  return children;
};

export { CardField, useStripe, useConfirmPayment, StripeProvider };