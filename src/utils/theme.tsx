import React from 'react';
import {StatusBar, TextStyle} from 'react-native';
import {BaseToast, ErrorToast, InfoToast} from 'react-native-toast-message';

// Tokens taken from the HI FRANKIE Figma file (OutfitStudioApp).
export const COLORS = {
  // Base Colors
  staticBlack: '#000000',
  staticWhite: '#FFFFFF',

  // Surfaces
  base: '#F4F2EF', // auth screen background
  cream: '#FCF9F2', // landing / chips
  creamDark: '#FAF7F0',
  sand: '#F1EEE7', // avatar + icon circles, strength bar track
  photoPlaceholder: '#E7E5E4',
  otpEmpty: '#F0F4F8',
  otpActive: '#DEE3E5',

  // Ink
  primary: '#0F0E0C', // primary buttons, headings
  ink: '#1C1917',
  inkSoft: '#1A1917',
  inkStrong: '#111111',
  inkMuted: '#2E2C2A',

  // Text tones
  subtitle: '#76746F',
  stone: '#655D55',
  stoneDark: '#494740',
  stoneLight: '#686661',
  divider: '#57534E',
  placeholder: '#737373',
  timer: '#45464D',
  otpDigit: '#171C1F',
  legal: '#757168',
  legalLink: '#4A4740',
  security: '#76767E',
  link: 'rgb(0, 103, 127)',
  linkDisabled: 'rgba(0, 103, 127, 0.5)',

  // Borders
  border: '#292524',
  borderMuted: '#6B7280',
  borderCard: '#E5E0D5',
  hairline: 'rgba(26, 25, 23, 0.1)',
  cardBorder: '#23221E',

  // Status
  error_Red50: '#C8372D',
  success: '#2E7D4F',

  // Aliases
  white: '#FFFFFF',
  textPrimary: '#0F0E0C',
  textSecondary: '#76746F',
};

// Playfair Display is the design's only typeface (loaded in App.tsx).
export const FONTS = {
  regular: 'PlayfairDisplay_400Regular',
  medium: 'PlayfairDisplay_500Medium',
  semiBold: 'PlayfairDisplay_600SemiBold',
  bold: 'PlayfairDisplay_700Bold',
  extraBold: 'PlayfairDisplay_800ExtraBold',
  black: 'PlayfairDisplay_900Black',
};

export const FONTS_ITALIC = {
  regular: 'PlayfairDisplay_400Regular_Italic',
  medium: 'PlayfairDisplay_500Medium_Italic',
  semiBold: 'PlayfairDisplay_600SemiBold_Italic',
  bold: 'PlayfairDisplay_700Bold_Italic',
  extraBold: 'PlayfairDisplay_800ExtraBold_Italic',
  black: 'PlayfairDisplay_900Black_Italic',
};

// Platypi is used only for numerals (OTP digits, countdown).
export const FONTS_NUMERIC = {
  semiBold: 'Platypi_600SemiBold',
};

export const SHADOW = {
  // 0 4 4 rgba(0,0,0,.25): inputs, buttons, avatar
  field: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  // 0 4 2 rgba(0,0,0,.25): social + primary buttons
  button: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 4,
  },
};

const toastStyle = {
  marginTop: StatusBar.currentHeight || 0,
  width: '90%' as const,
  borderRadius: 0,
};

const toastText1: TextStyle = {fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary};
const toastText2: TextStyle = {fontSize: 12, fontFamily: FONTS.regular, color: COLORS.stone};

export const toastConfig = {
  success: (props: any) =>
    React.createElement(BaseToast, {
      ...props,
      text1NumberOfLines: 2,
      text2NumberOfLines: 2,
      style: {...toastStyle, borderLeftColor: COLORS.success},
      text1Style: toastText1,
      text2Style: toastText2,
    }),
  error: (props: any) =>
    React.createElement(ErrorToast, {
      ...props,
      text1NumberOfLines: 2,
      text2NumberOfLines: 2,
      style: {...toastStyle, borderLeftColor: COLORS.error_Red50},
      text1Style: toastText1,
      text2Style: toastText2,
    }),
  info: (props: any) =>
    React.createElement(InfoToast, {
      ...props,
      text1NumberOfLines: 2,
      text2NumberOfLines: 2,
      style: {...toastStyle, borderLeftColor: COLORS.primary},
      text1Style: toastText1,
      text2Style: toastText2,
    }),
};
