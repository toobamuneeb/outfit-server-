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
import { showToast } from "../../../utils/helper";
import { COLORS } from "../../../utils/theme";
import { useAuth } from "../hooks/useAuth";

interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type Props = AuthStackScreenProps<"Signup">;

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const { signUp, isLoading } = useAuth();

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SignupFormData>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    const email = data.email.trim();
    const result = await signUp(data.fullName.trim(), email, data.password);
    if (result.success) {
      navigation.navigate("VerifyEmail", { email, purpose: "signup" });
    }
  };

  // TODO: link to the Terms / Privacy Policy screens once they exist.
  const openLegal = (doc: string) => showToast("info", `${doc} coming soon`);

  return (
    <MainWrapper>
      <View style={styles.container}>
        <AuthHeader
          title="Create your account"
          subtitle="Sign up to get started"
        />

        <View style={styles.card}>
          <SocialButtons />
          <OrDivider />

          <View style={styles.form}>
            <CustomInput
              name="fullName"
              control={control}
              type="name"
              label="Full Name"
              leftIcon="user"
              placeholder="Your full name"
              error={errors.fullName}
              textContentType="name"
              autoComplete="name"
            />

            <CustomInput
              name="email"
              control={control}
              type="email"
              label="Email"
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
              leftIcon="lock"
              placeholder="••••••••"
              error={errors.password}
              textContentType="newPassword"
              autoComplete="new-password"
            />

            <CustomInput
              name="confirmPassword"
              control={control}
              type="password"
              label="Confirm Password"
              leftIcon="lock"
              placeholder="••••••••"
              error={errors.confirmPassword}
              rules={{
                required: "Please confirm your password",
                validate: (value) =>
                  value === getValues("password") || "Passwords do not match",
              }}
              textContentType="newPassword"
            />

            <CustomButton
              title="Create account"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={styles.submit}
            />

            <CustomText
              fontSize="S10"
              color={COLORS.legal}
              lineHeight={16.25}
              center
            >
              By creating an account, you agree to our{" "}
              <CustomText
                fontSize="S10"
                color={COLORS.legalLink}
                underline
                onPress={() => openLegal("Terms")}
              >
                Terms
              </CustomText>{" "}
              and{" "}
              <CustomText
                fontSize="S10"
                color={COLORS.legalLink}
                underline
                onPress={() => openLegal("Privacy Policy")}
              >
                Privacy Policy
              </CustomText>
              .
            </CustomText>
          </View>
        </View>

        <View style={styles.footer}>
          <CustomText fontSize="S16" color={COLORS.inkMuted}>
            Already have an account?
          </CustomText>
          <TouchableOpacity
            onPress={() => navigation.popTo("Login")}
            hitSlop={8}
          >
            <CustomText fontSize="S16" fontFamily="bold" underline>
              Log in
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
    paddingTop: sizeLevel.S12,
    paddingBottom: sizeLevel.S24,
    // justifyContent: "center",
  },
  card: {
    marginTop: sizeLevel.S20,
    padding: sizeLevel.S21,
    gap: sizeLevel.S24,
  },
  form: {
    gap: sizeLevel.S14,
  },
  submit: {
    marginTop: sizeLevel.S8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: sizeLevel.S4,
    minHeight: sizeLevel.S44,
  },
});

export default SignupScreen;
