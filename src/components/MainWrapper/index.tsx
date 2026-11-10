import React, { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sizeLevel } from "../../utils/constants";
import { COLORS } from "../../utils/theme";

interface MainWrapperProps {
  children: ReactNode;
  backgroundColor?: string;
  scrollEnabled?: boolean;
  keyboardAvoidingEnabled?: boolean;
  bottom?: boolean;
  /** Horizontal screen padding; auth screens use 16 like the Figma frames. */
  paddingHorizontal?: number;
}

const MainWrapper: React.FC<MainWrapperProps> = ({
  children,
  backgroundColor = COLORS.base,
  scrollEnabled = true,
  keyboardAvoidingEnabled = true,
  bottom = true,
  paddingHorizontal = sizeLevel.S16,
}) => {
  const insets = useSafeAreaInsets();

  const content = scrollEnabled ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scrollContent, { paddingHorizontal }]}>
      {children}
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor, paddingTop: insets.top },
        bottom && { paddingBottom: insets.bottom },
      ]}
    >
      {keyboardAvoidingEnabled ? (
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default MainWrapper;
