import React, {useRef, useState} from 'react';
import {Keyboard, Platform, Pressable, StyleSheet, TextInput, View} from 'react-native';
import {CustomText} from '../CustomText';
import {COLORS, SHADOW} from '../../utils/theme';
import {sizeLevel} from '../../utils/constants';

interface CustomOTPInputProps {
  length?: number;
  value: string;
  onChangeText: (code: string) => void;
  onComplete?: (code: string) => void;
}

/**
 * Pill-shaped code boxes (filled / active-with-cursor / empty-with-dot).
 * A single hidden TextInput captures typing, paste and SMS/email autofill.
 */
const CustomOTPInput: React.FC<CustomOTPInputProps> = ({
  length = 6,
  value,
  onChangeText,
  onComplete,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChangeText(digits);
    if (digits.length === length) {
      Keyboard.dismiss();
      onComplete?.(digits);
    }
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.container}>
      {Array.from({length}, (_, index) => {
        const digit = value[index];
        const isActive = isFocused && index === Math.min(value.length, length - 1) && !digit;

        if (digit) {
          return (
            <View key={index} style={[styles.box, styles.boxFilled]}>
              <CustomText fontSize="S24" numeric color={COLORS.otpDigit} tracking={-0.24}>
                {digit}
              </CustomText>
            </View>
          );
        }

        return (
          <View key={index} style={[styles.box, isActive ? styles.boxActive : styles.boxEmpty]}>
            {isActive ? <View style={styles.cursor} /> : <View style={styles.dot} />}
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        caretHidden
        textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
        autoComplete="one-time-code"
        style={styles.hiddenInput}
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: sizeLevel.S4,
    width: '100%',
  },
  box: {
    flex: 1,
    height: sizeLevel.S56,
    borderRadius: sizeLevel.S48,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.field,
  },
  boxFilled: {
    backgroundColor: COLORS.staticWhite,
  },
  boxActive: {
    backgroundColor: COLORS.otpActive,
  },
  boxEmpty: {
    backgroundColor: COLORS.otpEmpty,
  },
  cursor: {
    width: 2,
    height: sizeLevel.S24,
    borderRadius: 1,
    backgroundColor: COLORS.staticBlack,
  },
  dot: {
    width: sizeLevel.S8,
    height: sizeLevel.S8,
    borderRadius: sizeLevel.S4,
    backgroundColor: 'rgba(198, 198, 206, 0.6)',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
  },
});

export default CustomOTPInput;
