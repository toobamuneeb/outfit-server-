import React from "react";
import { useForm, useWatch } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import AuthHeader from "../../../components/AuthHeader";
import BackToLogin from "../../../components/BackToLogin";
import CustomButton from "../../../components/CustomButton";
import { CustomIcon } from "../../../components/CustomIcon";
import CustomInput, { PASSWORD_RULES } from "../../../components/CustomInput";
import CustomSvg from "../../../components/CustomSvg";
import { CustomText } from "../../../components/CustomText";
import MainWrapper from "../../../components/MainWrapper";
import OrDivider from "../../../components/OrDivider";
import type { AuthStackScreenProps } from "../../../navigation/types";
import { sizeLevel } from "../../../utils/constants";
import { COLORS } from "../../../utils/theme";
import { useAuth } from "../hooks/useAuth";

interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

const REQUIREMENTS = [
  { label: "At least 8 characters in length", test: PASSWORD_RULES.minLength },
  {
    label: "Includes a number or unique symbol",
    test: PASSWORD_RULES.numberOrSymbol,
  },
];

// Three-segment bar: one segment per requirement met, plus one for length ≥ 12.
const getStrength = (value: string) =>
  REQUIREMENTS.filter((r) => r.test(value)).length +
  (value.length >= 12 ? 1 : 0);

type Props = AuthStackScreenProps<"ResetPassword">;

const ResetPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { updatePasswordWithCode, isLoading } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const [newPassword, confirmPassword] = useWatch({
    control,
    name: ["newPassword", "confirmPassword"],
  });
  const strength = getStrength(newPassword);
  const passwordsMatch = !!confirmPassword && confirmPassword === newPassword;

  const onSubmit = async (data: ResetPasswordFormData) => {
    // The recovery session from the verified code identifies the user.
    const result = await updatePasswordWithCode(data.newPassword);
    if (result.success) {
      navigation.popTo("Login");
    }
  };

  return (
    <MainWrapper paddingHorizontal={sizeLevel.S40}>
      <View style={styles.container}>
        <AuthHeader
          title="Create new password"
          subtitle={
            "Choose a strong password to secure your\npersonal wardrobe and consultations."
          }
        />

        <View style={styles.form}>
          <View>
            <CustomInput
              name="newPassword"
              control={control}
              type="password"
              label="New Password"
              labelVariant="caps"
              labelRight={
                <CustomText
                  fontSize="S10"
                  fontFamily="medium"
                  color={COLORS.stone}
                  tracking={0.5}
                  uppercase
                >
                  Required
                </CustomText>
              }
              leftIcon="lockAlt"
              eyeIcon="eyeAlt"
              placeholder="••••••••••••"
              error={errors.newPassword}
              textContentType="newPassword"
              autoComplete="new-password"
            />

            <View style={styles.strengthBar}>
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.strengthSegment,
                    index < strength && styles.strengthSegmentOn,
                  ]}
                />
              ))}
            </View>

            <View style={styles.checklist}>
              {REQUIREMENTS.map((requirement) => {
                const met = requirement.test(newPassword);
                return (
                  <View key={requirement.label} style={styles.requirement}>
                    {met ? (
                      <CustomIcon
                        type="Ionicons"
                        icon="checkmark-circle"
                        size={13}
                        color={COLORS.primary}
                      />
                    ) : (
                      <CustomSvg name="circle" />
                    )}
                    <CustomText
                      fontSize="S12"
                      color={met ? COLORS.primary : COLORS.stone}
                      lineHeight={18}
                    >
                      {requirement.label}
                    </CustomText>
                  </View>
                );
              })}
            </View>
          </View>

          <View>
            <CustomInput
              name="confirmPassword"
              control={control}
              type="password"
              label="Confirm New Password"
              labelVariant="caps"
              leftIcon="lockClock"
              eyeIcon="eyeAlt"
              placeholder="••••••••••••"
              error={errors.confirmPassword}
              rules={{
                required: "Please confirm your password",
                validate: (value) =>
                  value === newPassword || "Passwords do not match",
              }}
              textContentType="newPassword"
            />
            {passwordsMatch && !errors.confirmPassword && (
              <CustomText
                fontSize="S12"
                italic
                color={COLORS.stone}
                lineHeight={18}
                textStyle={styles.match}
              >
                Passwords match perfectly
              </CustomText>
            )}
          </View>

          <CustomButton
            title="Update Password"
            uppercase
            fontSize="S11"
            tracking={1.76}
            backgroundColor={COLORS.staticBlack}
            iconGap={sizeLevel.S8}
            rightIcon={<CustomSvg name="arrowRightSmall" />}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.submit}
          />

          <OrDivider chipColor={null} />

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
    paddingBottom: sizeLevel.S24,
    // justifyContent: "center",
  },
  form: {
    marginTop: sizeLevel.S40,
    gap: sizeLevel.S20,
  },
  strengthBar: {
    flexDirection: "row",
    gap: sizeLevel.S4,
    height: sizeLevel.S4,
    marginTop: sizeLevel.S8,
    backgroundColor: COLORS.sand,
  },
  strengthSegment: {
    flex: 1,
  },
  strengthSegmentOn: {
    backgroundColor: COLORS.stone,
  },
  checklist: {
    marginTop: sizeLevel.S14,
    gap: sizeLevel.S6,
  },
  requirement: {
    flexDirection: "row",
    alignItems: "center",
    gap: sizeLevel.S8,
  },
  match: {
    marginTop: sizeLevel.S10,
  },
  submit: {
    marginTop: sizeLevel.S28,
    paddingVertical: sizeLevel.S16,
  },
});

export default ResetPasswordScreen;
