import {NavigatorScreenParams} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {OtpPurpose} from '../services/auth.service';

// Auth Stack Param List
export type AuthStackParamList = {
  Landing: undefined;
  Signup: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  VerifyEmail: {email: string; purpose: OtpPurpose};
  ResetPassword: {email: string};
};

// Main Stack Param List
export type MainStackParamList = {
  Home: undefined;
};

// Root Stack Param List
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  CreateProfile: undefined;
  Main: NavigatorScreenParams<MainStackParamList>;
};

// Screen Props Types
export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type MainStackScreenProps<T extends keyof MainStackParamList> =
  NativeStackScreenProps<MainStackParamList, T>;

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// Declare global types for navigation
declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
