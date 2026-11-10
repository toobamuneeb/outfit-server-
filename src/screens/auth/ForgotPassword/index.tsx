import React from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import AuthHeader from "../../../components/AuthHeader";
import BackToLogin from "../../../components/BackToLogin";
import CustomButton from "../../../components/CustomButton";
import CustomInput from "../../../components/CustomInput";
import CustomSvg from "../../../components/CustomSvg";
import MainWrapper from "../../../components/MainWrapper";
import OrDivider from "../../../components/OrDivider";
import type { AuthStackScreenProps } from "../../../navigation/types";
import { sizeLevel } from "../../../utils/constants";
import { COLORS, SHADOW } from "../../../utils/theme";
import { useAuth } from "../hooks/useAuth";

interface ForgotPasswordFormData {
  email: string;
}

type Props = AuthStackScreenProps<"ForgotPassword">;

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { resetPassword, isLoading } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({ defaultValues: { email: "" } });

  const onSubmit = async ({ email }: ForgotPasswordFormData) => {
    const trimmedEmail = email.trim();
    const result = await resetPassword(trimmedEmail);
    if (result.success) {
      navigation.navigate("VerifyEmail", {
        email: trimmedEmail,
        purpose: "recovery",
      });
    }
  };

  return (
    <MainWrapper paddingHorizontal={sizeLevel.S20}>
      <View style={styles.container}>
        <AuthHeader
          title="Forgot password"
          subtitle={"Enter your email to receive recovery\ninstructions"}
        />

        <View style={styles.card}>
          <View style={styles.emblem}>
            <CustomSvg name="keyhole" />
          </View>

          <View style={styles.form}>
            <CustomInput
              name="email"
              control={control}
              type="email"
              label="Email"
              leftIcon="mail18"
              tall
              placeholder="Enter your email"
              helperText="We'll send a 6-digit verification code to your email."
              error={errors.email}
              textContentType="emailAddress"
              autoComplete="email"
            />

            <CustomButton
              title="Send Code"
              fontSize="S15"
              fontFamily="semiBold"
              tracking={0.375}
              backgroundColor={COLORS.inkStrong}
              iconGap={sizeLevel.S8}
              rightIcon={<CustomSvg name="arrowRightThin" />}
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={styles.submit}
            />
          </View>

          <OrDivider chipColor={COLORS.creamDark} />

          <BackToLogin onPress={() => navigation.popTo("Login")} />
        </View>
      </View>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: sizeLevel.S12,
  },
  card: {
    marginTop: sizeLevel.S32,
    borderWidth: 1,
    borderColor: COLORS.borderCard,
    paddingHorizontal: sizeLevel.S25,
    paddingVertical: sizeLevel.S32,
    gap: sizeLevel.S24,
  },
  emblem: {
    alignSelf: "center",
    width: sizeLevel.S56,
    height: sizeLevel.S56,
    borderRadius: sizeLevel.S28,
    backgroundColor: COLORS.sand,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.button,
  },
  form: {
    gap: sizeLevel.S28,
  },
  submit: {
    paddingVertical: sizeLevel.S14,
  },
});

export default ForgotPasswordScreen;
