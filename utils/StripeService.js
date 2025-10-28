// Use the web-compatible wrapper instead of direct imports
import { StripeProvider, useStripe } from './StripeWebCompat';

// Use hardcoded test key for now - replace with your actual test key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ';

// Stripe configuration
export const stripeConfig = {
  publishableKey: STRIPE_PUBLISHABLE_KEY || 'your_stripe_publishable_key_here',
  merchantIdentifier: 'merchant.com.sharemyride',
  country: 'US',
  currency: 'USD',
};

// Payment service utilities
export const PaymentService = {
  // Create payment intent (this should be called from your backend)
  createPaymentIntent: async (amount, currency = 'usd') => {
    try {
      // Simulate creating a payment intent
      // In a real app, this would be a backend API call
      console.log('Creating payment intent for amount:', amount, 'currency:', currency);
      
      // Simulate a client secret for test mode
      const clientSecret = 'pi_test_' + Date.now() + '_secret_' + Math.random().toString(36).substr(2, 9);
      return clientSecret;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },

  // Process payment with saved card
  processPayment: async (clientSecret, paymentMethodId) => {
    try {
      // This would be handled by Stripe in a real implementation
  const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
  const response = await fetch(`${apiBase}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: clientSecret,
          paymentMethodId,
        }),
      });

      if (!response.ok) {
        throw new Error('Payment confirmation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  },

  // Calculate Stripe fees
  calculateStripeFee: (amount) => {
    // Stripe fee: 2.9% + $0.30
    const percentageFee = amount * 0.029;
    const fixedFee = 0.30;
    return percentageFee + fixedFee;
  },

  // Calculate total amount including fees
  calculateTotalWithFees: (baseAmount) => {
    const stripeFee = PaymentService.calculateStripeFee(baseAmount);
    return baseAmount + stripeFee;
  },

  // Format amount for display
  formatAmount: (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  },

  // Validate payment amount
  validateAmount: (amount) => {
    if (isNaN(amount) || amount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }
    if (amount > 999999.99) {
      return { valid: false, error: 'Amount exceeds maximum limit' };
    }
    return { valid: true };
  },
};

// Custom hook for payment processing
export const usePayment = () => {
  const { confirmPayment } = useStripe();

  const processPayment = async (amount, bookingId, description = 'Ride payment', currency = 'usd') => {
    try {
      // Create payment intent
      const clientSecret = await PaymentService.createPaymentIntent(amount, currency);
      
      // For now, simulate successful payment since we're in test mode
      // In a real app, you would collect card details and confirm payment
      console.log('Simulating payment for amount:', amount, 'bookingId:', bookingId);
      
      // Simulate successful payment
      return {
        success: true,
        paymentIntent: {
          id: 'simulated_payment_intent_' + Date.now(),
          amount: amount * 100, // Convert to cents
          currency: currency,
          status: 'succeeded',
        },
      };
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  };

  return {
    processPayment,
  };
};

export { StripeProvider };