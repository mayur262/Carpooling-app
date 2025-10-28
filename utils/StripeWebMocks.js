// Web-only mock implementations for Stripe React Native components
// This file is only loaded on web platform to avoid native module imports

import React from 'react';

// Mock CardField component for web
export const CardField = ({
  postalCodeEnabled = true,
  placeholders,
  cardStyle,
  style,
  onCardChange,
  onFocus,
  onBlur,
}) => {
  return (
    <div style={style}>
      <input
        type="text"
        placeholder={placeholders?.number || "Card number"}
        onChange={(e) => onCardChange?.({
          complete: e.target.value.length > 10,
          number: e.target.value,
          expiryMonth: 12,
          expiryYear: 25,
          cvc: "123",
          postalCode: "12345"
        })}
        style={{
          padding: "10px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          width: "100%",
          marginBottom: "10px"
        }}
      />
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="MM/YY"
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            flex: 1
          }}
        />
        <input
          type="text"
          placeholder="CVC"
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            flex: 1
          }}
        />
      </div>
      {postalCodeEnabled && (
        <input
          type="text"
          placeholder={placeholders?.postalCode || "ZIP"}
          style={{
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            width: "100%",
            marginTop: "10px"
          }}
        />
      )}
    </div>
  );
};

// Mock useStripe hook for web
export const useStripe = () => ({
  confirmPayment: async () => ({ 
    paymentIntent: { 
      status: 'succeeded',
      id: 'mock_payment_intent_' + Date.now()
    } 
  }),
  presentPaymentSheet: async () => ({ error: null }),
  confirmPaymentSheetPayment: async () => ({ error: null }),
  initPaymentSheet: async () => ({ error: null }),
});

// Mock useConfirmPayment hook for web
export const useConfirmPayment = () => async () => ({
  paymentIntent: { 
    status: 'succeeded',
    id: 'mock_payment_intent_' + Date.now()
  },
  error: null
});

// Mock StripeProvider for web
export const StripeProvider = ({ children }) => children;