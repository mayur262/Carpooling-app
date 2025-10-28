import React from 'react';
import { TextInput as NativeTextInput, Platform } from 'react-native';

/**
 * SafeTextInput - A wrapper around TextInput that ensures
 * boolean and enum props are never passed as strings (which causes Android crashes)
 */
const SafeTextInput = (props) => {
  const {
    autoCapitalize,
    autoCorrect,
    autoFocus,
    blurOnSubmit,
    editable,
    multiline,
    secureTextEntry,
    selectTextOnFocus,
    ...rest
  } = props;

  // Ensure boolean props are strictly booleans
  const safeProps = {
    ...rest,
    autoCorrect: autoCorrect === true || autoCorrect === 'true',
    autoFocus: autoFocus === true || autoFocus === 'true',
    blurOnSubmit: blurOnSubmit === true || blurOnSubmit === 'true',
    editable: editable === true || editable === 'true',
    multiline: multiline === true || multiline === 'true',
    secureTextEntry: secureTextEntry === true || secureTextEntry === 'true',
    selectTextOnFocus: selectTextOnFocus === true || selectTextOnFocus === 'true',
  };

  // Only add boolean props to safeProps if they are explicitly set to avoid undefined values
  if (autoCorrect !== undefined) safeProps.autoCorrect = autoCorrect === true || autoCorrect === 'true';
  if (autoFocus !== undefined) safeProps.autoFocus = autoFocus === true || autoFocus === 'true';
  if (blurOnSubmit !== undefined) safeProps.blurOnSubmit = blurOnSubmit === true || blurOnSubmit === 'true';
  if (editable !== undefined) safeProps.editable = editable === true || editable === 'true';
  if (multiline !== undefined) safeProps.multiline = multiline === true || multiline === 'true';
  if (secureTextEntry !== undefined) safeProps.secureTextEntry = secureTextEntry === true || secureTextEntry === 'true';
  if (selectTextOnFocus !== undefined) safeProps.selectTextOnFocus = selectTextOnFocus === true || selectTextOnFocus === 'true';

  // Handle autoCapitalize enum values properly
  if (autoCapitalize !== undefined) {
    // Ensure autoCapitalize is a valid enum value, not a string that could cause issues
    const validValues = ['none', 'sentences', 'words', 'characters'];
    if (validValues.includes(autoCapitalize)) {
      safeProps.autoCapitalize = autoCapitalize;
    } else if (autoCapitalize === true || autoCapitalize === 'true') {
      safeProps.autoCapitalize = 'sentences'; // Default behavior
    } else if (autoCapitalize === false || autoCapitalize === 'false') {
      safeProps.autoCapitalize = 'none';
    }
  }

  return <NativeTextInput {...safeProps} />;
};

export default SafeTextInput;