import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { useConfirmPayment } from '../utils/StripeService';
import { PaymentService } from '../utils/StripeService';
import SafeCardField from './SafeCardField';

const StripePaymentComponent = ({
  amount,
  onPaymentSuccess,
  onPaymentFailure,
  buttonText = 'Pay Now',
  showAmount = true,
  disabled = false,
}) => {
  const { confirmPayment } = useConfirmPayment();
  const [loading, setLoading] = useState(false);
  const [cardDetails, setCardDetails] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handlePayment = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Error', 'Please enter complete card details');
      return;
    }

    setLoading(true);

    try {
      // Create payment intent
      const clientSecret = await PaymentService.createPaymentIntent(amount);

      // Confirm payment
      const { paymentIntent, error } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {
            // Add billing details if needed
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent.status === 'succeeded') {
        setShowPaymentModal(false);
        onPaymentSuccess?.(paymentIntent);
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Failed', error.message);
      onPaymentFailure?.(error);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = () => {
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setCardDetails(null);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.payButton, disabled && styles.disabledButton]}
        onPress={openPaymentModal}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.payButtonText}>
            {showAmount ? `${buttonText} $${amount.toFixed(2)}` : buttonText}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent  // Use shorthand prop instead of transparent={true}
        onRequestClose={closePaymentModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Details</Text>
              <TouchableOpacity onPress={closePaymentModal}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.paymentInfo}>
              <Text style={styles.amountText}>
                Amount: {PaymentService.formatAmount(amount)}
              </Text>
              <Text style={styles.feeText}>
                Processing Fee: {PaymentService.formatAmount(PaymentService.calculateStripeFee(amount))}
              </Text>
              <Text style={styles.totalText}>
                Total: {PaymentService.formatAmount(PaymentService.calculateTotalWithFees(amount))}
              </Text>
            </View>

            <View style={styles.cardContainer}>
              <Text style={styles.cardLabel}>Card Information</Text>
              <SafeCardField
                postalCodeEnabled={false}
                placeholder={{
                  number: '4242 4242 4242 4242',
                }}
                cardStyle={styles.cardField}
                style={styles.cardFieldContainer}
                onCardChange={(cardDetails) => {
                  setCardDetails(cardDetails);
                }}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.confirmButton, loading && styles.disabledButton]}
                onPress={handlePayment}
                disabled={loading || !cardDetails?.complete}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Confirm Payment
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closePaymentModal}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  payButton: {
    backgroundColor: '#635BFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    padding: 8,
  },
  paymentInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  amountText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  feeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  cardContainer: {
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  cardField: {
    backgroundColor: '#f8f9fa',
    textColor: '#000000',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardFieldContainer: {
    height: 50,
    marginVertical: 8,
  },
  buttonContainer: {
    gap: 12,
  },
  confirmButton: {
    backgroundColor: '#635BFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StripePaymentComponent;