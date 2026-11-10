import React from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import AuthHeader from "../../../components/AuthHeader";
import CustomButton from "../../../components/CustomButton";
import CustomInput from "../../../components/CustomInput";
import { CustomText } from "../../../components/CustomText";
import MainWrapper from "../../../components/MainWrapper";
import OrDivider from "../../../components/OrDivider";
import SocialButtons from "../../../components/SocialButtons";
import type { AuthStackScreenProps } from "../../../navigation/types";
import { sizeLevel } from "../../../utils/constants";
import { COLORS } from "../../../utils/theme";
import { useAuth } from "../hooks/useAuth";

interface LoginFormData {
  email: string;
  password: string;
}

type Props = AuthStackScreenProps<"Login">;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn, isLoading } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ defaultValues: { email: "", password: "" } });

  const onSubmit = async (data: LoginFormData) => {
    // On success AppNavigator switches to the Main stack automatically.
    await signIn(data.email.trim(), data.password);
  };

  return (
    <MainWrapper>
      <View style={styles.container}>
        <AuthHeader title="Welcome back" subtitle="Log in to your account" />

        <View style={styles.card}>
          <SocialButtons />
          <OrDivider />

          <View style={styles.form}>
            <CustomInput
              name="email"
              control={control}
              type="email"
              label="Email"
              labelVariant="small"
              leftIcon="mail"
              placeholder="Enter your email"
              error={errors.email}
              textContentType="emailAddress"
              autoComplete="email"
            />

            <CustomInput
              name="password"
              control={control}
              type="password"
              label="Password"
              labelVariant="small"
              labelRight={
                <TouchableOpacity
                  onPress={() => navigation.navigate("ForgotPassword")}
                  hitSlop={8}
                >
                  <CustomText
                    fontSize="S10"
                    color={COLORS.divider}
                    lineHeight={16}
                  >
                    Forgot password?
                  </CustomText>
                </TouchableOpacity>
              }
              leftIcon="lock"
              placeholder="••••••••"
              error={errors.password}
              // Login only checks presence; strength rules apply at sign-up.
              rules={{ required: "Password is required" }}
              textContentType="password"
              autoComplete="password"
            />

            <CustomButton
              title="Log in"
              tracking={0.35}
              backgroundColor={COLORS.staticBlack}
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={styles.submit}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <CustomText fontSize="S16" color={COLORS.inkMuted}>
            Don&apos;t have an account?{" "}
          </CustomText>
          <TouchableOpacity
            onPress={() => navigation.popTo("Signup")}
            hitSlop={8}
          >
            <CustomText
              fontSize="S16"
              fontFamily="bold"
              color={COLORS.inkStrong}
            >
              Sign Up
            </CustomText>
          </TouchableOpacity>
        </View>
      </View>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: sizeLevel.S24,
    paddingBottom: sizeLevel.S24,
    // justifyContent: "center",
  },
  card: {
    marginTop: sizeLevel.S24,
    padding: sizeLevel.S24,
    gap: sizeLevel.S24,
  },
  form: {
    gap: sizeLevel.S16,
  },
  submit: {
    marginTop: sizeLevel.S8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: sizeLevel.S16,
  },
});

export default LoginScreen;
