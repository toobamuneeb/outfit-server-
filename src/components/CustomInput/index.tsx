import React, {useState} from 'react';
import {StyleSheet, TextInput, TextInputProps, TouchableOpacity, View} from 'react-native';
import {Control, Controller, FieldError, FieldValues, Path, RegisterOptions} from 'react-hook-form';
import {COLORS, FONTS, SHADOW} from '../../utils/theme';
import {sizeLevel} from '../../utils/constants';
import {CustomText} from '../CustomText';
import CustomSvg from '../CustomSvg';
import type {SvgName} from '../../assets/svgs';

export type InputType = 'email' | 'password' | 'text' | 'name';

interface CustomInputProps<T extends FieldValues>
  extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  /**
   * default: 14pt medium label (Create account, Forgot password, Create profile).
   * small: 12pt regular label (Login). caps: uppercase tracked label (Create new password).
   */
  labelVariant?: 'default' | 'small' | 'caps';
  /** Rendered at the right end of the label row (e.g. "Forgot password?" link). */
  labelRight?: React.ReactNode;
  type?: InputType;
  error?: FieldError;
  leftIcon?: SvgName;
  eyeIcon?: SvgName;
  /** Taller field used on Forgot password / Create profile. */
  tall?: boolean;
  helperText?: string;
  rules?: RegisterOptions<T, Path<T>>;
}

const REGEX_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

const REQUIRED_LABELS: Record<InputType, string> = {
  email: 'Email',
  password: 'Password',
  text: 'This field',
  name: 'Name',
};

export const PASSWORD_RULES = {
  minLength: (value: string) => value.length >= 8,
  numberOrSymbol: (value: string) => /[\d\W_]/.test(value),
};

export const getValidationRules = (type: InputType = 'text') => {
  const rules: Record<string, unknown> = {
    required: `${REQUIRED_LABELS[type]} is required`,
  };

  if (type === 'email') {
    rules.pattern = {value: REGEX_PATTERNS.email, message: 'Please enter a valid email address'};
  } else if (type === 'password') {
    rules.validate = {
      minLength: (v: string) =>
        PASSWORD_RULES.minLength(v) || 'Password must be at least 8 characters',
      numberOrSymbol: (v: string) =>
        PASSWORD_RULES.numberOrSymbol(v) || 'Include a number or unique symbol',
    };
  }

  return rules;
};

const CustomInput = <T extends FieldValues>({
  name,
  control,
  label,
  labelVariant = 'default',
  labelRight,
  type = 'text',
  error,
  leftIcon,
  eyeIcon = 'eye',
  tall,
  helperText,
  placeholder,
  rules,
  style,
  ...rest
}: CustomInputProps<T>) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <View style={styles.container}>
      {(label || labelRight) && (
        <View style={styles.labelRow}>
          {label &&
            (labelVariant === 'small' ? (
              <CustomText fontSize="S12" color={COLORS.ink} tracking={-0.3} lineHeight={16}>
                {label}
              </CustomText>
            ) : labelVariant === 'caps' ? (
              <CustomText
                fontSize="S11"
                fontFamily="semiBold"
                color={COLORS.stoneDark}
                tracking={1.54}
                uppercase>
                {label}
              </CustomText>
            ) : (
              <CustomText fontSize="S14" fontFamily="medium" color={COLORS.inkStrong} lineHeight={21}>
                {label}
              </CustomText>
            ))}
          {labelRight}
        </View>
      )}
      <Controller
        control={control}
        name={name}
        rules={rules || (getValidationRules(type) as RegisterOptions<T, Path<T>>)}
        render={({field: {onChange, onBlur, value}}) => (
          <View
            style={[
              styles.inputContainer,
              tall && styles.inputContainerTall,
              error && styles.inputError,
            ]}>
            {leftIcon && (
              <View style={styles.leftIcon}>
                <CustomSvg name={leftIcon} />
              </View>
            )}
            <TextInput
              style={[styles.input, tall && styles.inputTall, style]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder={placeholder}
              placeholderTextColor={COLORS.placeholder}
              keyboardType={type === 'email' ? 'email-address' : 'default'}
              autoCapitalize={type === 'name' ? 'words' : 'none'}
              autoCorrect={false}
              secureTextEntry={isPassword && !isPasswordVisible}
              {...rest}
            />
            {isPassword && (
              <TouchableOpacity
                onPress={() => setIsPasswordVisible(prev => !prev)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                style={[styles.eyeButton, !isPasswordVisible && styles.eyeHidden]}>
                <CustomSvg name={eyeIcon} />
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      {error?.message ? (
        <CustomText fontSize="S11" color={COLORS.error_Red50} textStyle={styles.helper}>
          {error.message}
        </CustomText>
      ) : helperText ? (
        <CustomText fontSize="S11" color={COLORS.subtitle} lineHeight={18.69} textStyle={styles.helper}>
          {helperText}
        </CustomText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: sizeLevel.S6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizeLevel.S44,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.staticWhite,
    paddingLeft: sizeLevel.S14,
    paddingRight: sizeLevel.S14,
    ...SHADOW.field,
  },
  inputContainerTall: {
    minHeight: sizeLevel.S50,
    borderColor: COLORS.borderMuted,
  },
  leftIcon: {
    marginRight: sizeLevel.S10,
  },
  input: {
    flex: 1,
    paddingVertical: sizeLevel.S11,
    fontSize: sizeLevel.S12,
    fontFamily: FONTS.regular,
    color: COLORS.ink,
  },
  inputTall: {
    fontSize: sizeLevel.S14,
  },
  eyeButton: {
    marginLeft: sizeLevel.S8,
  },
  eyeHidden: {
    opacity: 0.55,
  },
  inputError: {
    borderColor: COLORS.error_Red50,
  },
  helper: {
    marginTop: sizeLevel.S6,
  },
});

export default CustomInput;
