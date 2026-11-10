import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import {
  ForgotPasswordScreen,
  LandingScreen,
  LoginScreen,
  ResetPasswordScreen,
  SignupScreen,
  VerifyEmailScreen,
} from "../screens/auth";
import { COLORS } from "../utils/theme";
import { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // animation: 'slide_from_right',
        contentStyle: { backgroundColor: COLORS.base },
      }}
      initialRouteName="Landing"
    >
      <Stack.Screen
        name="Landing"
        component={LandingScreen}
        options={{ animation: "simple_push" }}
      />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
