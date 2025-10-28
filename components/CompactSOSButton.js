import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import SOSButton from './SOSButton';

const CompactSOSButton = ({ style, textStyle, onPress, onSuccess, onError }) => {
  return (
    <SOSButton
      compact={true}
      style={[styles.button, style]}
      textStyle={[styles.text, textStyle]}
      onPress={onPress}
      onSuccess={onSuccess}
      onError={onError}
      showConfirmation={true}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FF4444',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default CompactSOSButton;