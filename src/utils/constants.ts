import {RFValue} from 'react-native-responsive-fontsize';

// Height of the Figma frames (iPhone 16 Pro, 402×874). Calibrating RFValue
// against it means sizeLevel.S16 === 16pt on that device and scales elsewhere.
const DESIGN_HEIGHT = 874;

// Responsive size scale (same convention as La-Kala): sizeLevel.S16 ≈ 16pt.
const SIZES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30, 32, 34, 35, 36, 38, 40, 41, 44, 48, 50, 56, 60,
  64, 70, 80, 100, 112, 120, 280, 324, 398,
] as const;

type SizeKey = `S${(typeof SIZES)[number]}`;

export const sizeLevel = Object.fromEntries(
  SIZES.map(size => [`S${size}`, RFValue(size, DESIGN_HEIGHT)]),
) as Record<SizeKey, number>;

export type FontSizeType = SizeKey;

export const IMAGES = {
  HERO: require('./../assets/Images/hero.png'),
  LOOK_1: require('./../assets/Images/look1.jpg'),
  LOOK_2: require('./../assets/Images/look2.jpg'),
  LOOK_3: require('./../assets/Images/look3.jpg'),
};

export const ICONS = {
  APPLE: require('./../assets/Images/apple.png'),
};

export const APP_NAME = 'HI FRANKIE';
