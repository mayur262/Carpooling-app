// Native-specific Stripe compatibility - uses real Stripe modules
import { Platform } from 'react-native';

console.log('Loading native-specific Stripe compatibility layer');

let CardField, useStripe, useConfirmPayment, StripeProvider;

try {
  // This will only be processed on native platforms
  const stripeModule = require('@stripe/stripe-react-native');
  CardField = stripeModule.CardField;
  useStripe = stripeModule.useStripe;
  useConfirmPayment = stripeModule.useConfirmPayment;
  StripeProvider = stripeModule.StripeProvider;
  console.log('Real Stripe React Native components loaded successfully');
} catch (error) {
  console.error('Failed to load Stripe React Native on native platform:', error);
  // Fallback to basic mocks if Stripe fails to load on native
  CardField = () => null;
  useStripe = () => ({});
  useConfirmPayment = () => async () => ({ error: { message: 'Stripe not available' } });
  StripeProvider = ({ children }) => children;
}

export { CardField, useStripe, useConfirmPayment, StripeProvider };