import {ReactNode} from 'react';
import {StyleProp, TextProps, TextStyle} from 'react-native';
import type {FontSizeType} from '../../utils/constants';

export type {FontSizeType};

export type FontWeightsType =
  | 'regular'
  | 'medium'
  | 'semiBold'
  | 'bold'
  | 'extraBold'
  | 'black';

export interface CustomTextProps extends TextProps {
  children: ReactNode;
  underline?: boolean;
  color?: string;
  onPress?: () => void;
  textStyle?: StyleProp<TextStyle>;
  center?: boolean;
  uppercase?: boolean;
  italic?: boolean;
  /** Use the numeric face (Platypi) — for digits like OTP codes and timers. */
  numeric?: boolean;
  fontSize?: FontSizeType;
  fontFamily?: FontWeightsType;
  /** Letter spacing in Figma px (scaled with the font size). */
  tracking?: number;
  /** Line height in Figma px (scaled with the font size). */
  lineHeight?: number;
}
