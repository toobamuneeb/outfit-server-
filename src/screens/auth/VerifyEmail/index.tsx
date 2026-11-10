import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import AuthHeader from "../../../components/AuthHeader";
import CustomButton from "../../../components/CustomButton";
import CustomOTPInput from "../../../components/CustomOTPInput";
import CustomSvg from "../../../components/CustomSvg";
import { CustomText } from "../../../components/CustomText";
import MainWrapper from "../../../components/MainWrapper";
import type { AuthStackScreenProps } from "../../../navigation/types";
import { sizeLevel } from "../../../utils/constants";
import { COLORS } from "../../../utils/theme";
import { useAuth } from "../hooks/useAuth";

// Matches the "6-digit verification code" copy on Forgot password.
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const formatCountdown = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

type Props = AuthStackScreenProps<"VerifyEmail">;

const VerifyEmailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email, purpose } = route.params;
  const { verifyOTP, resendCode, isLoading } = useAuth();
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleVerify = async (value: string = code) => {
    if (value.length !== OTP_LENGTH || isLoading) return;
    const result = await verifyOTP(email, value, purpose);
    if (!result.success) {
      setCode("");
      return;
    }
    // Sign-up: the stored session moves AppNavigator on to Create Your Profile.
    if (purpose === "recovery") {
      navigation.navigate("ResetPassword", { email });
    }
  };

  const handleResend = async () => {
    const result = await resendCode(email, purpose);
    if (result.success) {
      setCode("");
      setSecondsLeft(RESEND_SECONDS);
    }
  };

  const canResend = secondsLeft <= 0 && !isLoading;

  return (
    <MainWrapper>
      <View style={styles.container}>
        <AuthHeader
          title="Enter Verification Code"
          subtitle={"We’ve sent a verification code to your\nemail address."}
        />

        <View style={styles.otpSection}>
          <CustomOTPInput
            length={OTP_LENGTH}
            value={code}
            onChangeText={setCode}
            onComplete={handleVerify}
          />

          <View style={styles.timerRow}>
            <CustomText
              fontSize="S12"
              fontFamily="medium"
              color={COLORS.timer}
              tracking={0.24}
            >
              Resend in{" "}
              <CustomText fontSize="S12" numeric color={COLORS.otpDigit}>
                {formatCountdown(secondsLeft)}
              </CustomText>
            </CustomText>
            <TouchableOpacity
              onPress={handleResend}
              disabled={!canResend}
              hitSlop={8}
            >
              <CustomText
                fontSize="S12"
                fontFamily="semiBold"
                color={canResend ? COLORS.link : COLORS.linkDisabled}
                tracking={0.24}
              >
                Resend Code
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actions}>
          <CustomButton
            title="Verify and Proceed"
            onPress={() => handleVerify()}
            loading={isLoading}
            disabled={code.length !== OTP_LENGTH}
            rightIcon={<CustomSvg name="arrowRight" />}
          />
          <View style={styles.securityRow}>
            <CustomSvg name="lockSmall" />
            <CustomText
              fontSize="S10"
              fontFamily="semiBold"
              color={COLORS.security}
              tracking={0.4}
            >
              <CustomText fontSize="S10" numeric color={COLORS.security}>
                256
              </CustomText>
              -bit encrypted neuro-telemetry authentication
            </CustomText>
          </View>
        </View>
      </View>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: sizeLevel.S12,
    paddingHorizontal: sizeLevel.S6,
    // justifyContent: "center",
  },
  otpSection: {
    marginTop: sizeLevel.S56,
    gap: sizeLevel.S20,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: {
    marginTop: sizeLevel.S50,
    paddingHorizontal: sizeLevel.S21,
    gap: sizeLevel.S14,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sizeLevel.S4,
  },
});

export default VerifyEmailScreen;
