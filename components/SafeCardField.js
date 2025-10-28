import React from 'react';
import { CardField } from '../utils/StripeWebCompat'
import { Platform } from 'react-native';

/**
 * SafeCardField - A wrapper around Stripe's CardField that ensures
 * boolean props are never passed as strings (which causes Android crashes)
 */
const SafeCardField = ({ postalCodeEnabled, autofocus = false, dangerouslyGetFullCardDetails = false, ...props }) => {
  // Ensure boolean props are never passed as strings (which causes Android crashes)
  const safeProps = { ...props };
  
  // Handle postalCodeEnabled
  if (postalCodeEnabled !== undefined) {
    safeProps.postalCodeEnabled = postalCodeEnabled === 'true' ? true : postalCodeEnabled === 'false' ? false : Boolean(postalCodeEnabled);
  }
  
  // Handle autofocus
  if (autofocus !== undefined) {
    safeProps.autofocus = autofocus === 'true' ? true : autofocus === 'false' ? false : Boolean(autofocus);
  }
  
  // Handle dangerouslyGetFullCardDetails
  if (dangerouslyGetFullCardDetails !== undefined) {
    safeProps.dangerouslyGetFullCardDetails = dangerouslyGetFullCardDetails === 'true' ? true : dangerouslyGetFullCardDetails === 'false' ? false : Boolean(dangerouslyGetFullCardDetails);
  }
  
  return <CardField {...safeProps} />;
};

export default SafeCardField;
