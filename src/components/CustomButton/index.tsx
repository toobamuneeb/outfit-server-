import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {CustomText} from '../CustomText';
import {FontWeightsType} from '../CustomText/interface';
import {COLORS, SHADOW} from '../../utils/theme';
import {FontSizeType, sizeLevel} from '../../utils/constants';

interface CustomButtonProps {
  title: string;
  onPress?: () => void;
  /** primary: solid ink button. outline: white button with dark hairline (social logins). */
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconGap?: number;
  fontSize?: FontSizeType;
  fontFamily?: FontWeightsType;
  tracking?: number;
  uppercase?: boolean;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  iconGap = sizeLevel.S10,
  fontSize = 'S12',
  fontFamily = variant === 'primary' ? 'bold' : 'medium',
  tracking = variant === 'primary' ? 0.6 : 0,
  uppercase,
  backgroundColor,
  textColor,
  style,
  textStyle,
}) => {
  const contentColor =
    textColor || (variant === 'primary' ? COLORS.staticWhite : COLORS.ink);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' ? styles.primary : styles.outline,
        backgroundColor ? {backgroundColor} : null,
        {gap: iconGap},
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}>
      {loading ? (
        <ActivityIndicator color={contentColor} size="small" />
      ) : (
        <>
          {leftIcon && <View>{leftIcon}</View>}
          <CustomText
            fontSize={fontSize}
            fontFamily={fontFamily}
            color={contentColor}
            tracking={tracking}
            uppercase={uppercase}
            textStyle={textStyle}>
            {title}
          </CustomText>
          {rightIcon && <View>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizeLevel.S44,
    paddingHorizontal: sizeLevel.S16,
    width: '100%',
    ...SHADOW.button,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  outline: {
    backgroundColor: COLORS.staticWhite,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default CustomButton;
