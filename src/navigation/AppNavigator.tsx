import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { CreateProfileScreen } from "../screens/auth";
import { getOnboardingStatus } from "../utils/helper";
import AuthNavigator from "./AuthNavigator";
import { linking } from "./linking";
import MainNavigator from "./MainNavigator";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { user, isAuthenticated } = useSelector(
    (state: RootState) => state.user,
  );

  // Determine onboarding status
  const onboardingStatus = getOnboardingStatus(user);

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: "flip" }}
      >
        {!isAuthenticated ? (
          // Not logged in - show auth flow
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ animationTypeForReplace: "pop" }}
          />
        ) : onboardingStatus === "CreateProfile" ? (
          // Verified but no profile yet
          <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
