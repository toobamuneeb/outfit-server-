import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AuthHeader from "../../../components/AuthHeader";
import CustomButton from "../../../components/CustomButton";
import CustomInput from "../../../components/CustomInput";
import CustomSvg from "../../../components/CustomSvg";
import MainWrapper from "../../../components/MainWrapper";
import { sizeLevel } from "../../../utils/constants";
import { COLORS, SHADOW } from "../../../utils/theme";
import { useAuth } from "../hooks/useAuth";

interface ProfileFormData {
  displayName: string;
}

const CreateProfileScreen: React.FC = () => {
  const { user, updateProfile, uploadAvatar, isLoading } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | undefined>();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    defaultValues: { displayName: user?.full_name ?? "" },
  });

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const onSubmit = async ({ displayName }: ProfileFormData) => {
    if (!avatarUri) return;
    if (avatarUri) {
      const upload = await uploadAvatar(avatarUri);
      if (!upload.success) return;
    }
    await updateProfile({ display_name: displayName.trim() });
  };

  return (
    <MainWrapper paddingHorizontal={sizeLevel.S36}>
      <View style={styles.container}>
        <AuthHeader
          title="Create Your Profile"
          subtitle="Upload your profile photo"
        />

        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={pickPhoto}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Choose profile photo"
        >
          <View style={styles.avatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <>
                <CustomSvg name="portrait" />
                <Text style={styles.portraitLabel}>PORTRAIT</Text>
              </>
            )}
          </View>
          <View style={styles.cameraBadge}>
            <CustomSvg name="camera" />
          </View>
        </TouchableOpacity>

        <CustomInput
          name="displayName"
          control={control}
          type="name"
          label="Display Name"
          leftIcon="idCard"
          tall
          placeholder="Profile Name"
          placeholderTextColor="rgba(118, 116, 111, 0.6)"
          error={errors.displayName}
          rules={{ required: "Display name is required" }}
          textContentType="nickname"
        />

        <CustomButton
          title="Continue"
          uppercase
          fontSize="S11"
          tracking={1.54}
          backgroundColor={COLORS.staticBlack}
          iconGap={sizeLevel.S8}
          rightIcon={<CustomSvg name="arrowRightSmall" />}
          onPress={handleSubmit(onSubmit)}
          loading={isLoading}
          style={styles.submit}
        />
      </View>
    </MainWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: sizeLevel.S12,
    paddingBottom: sizeLevel.S40,
    // justifyContent: "center",
  },
  avatarWrapper: {
    alignSelf: "center",
    marginTop: sizeLevel.S40,
    marginBottom: sizeLevel.S40,
  },
  avatar: {
    width: sizeLevel.S112,
    height: sizeLevel.S112,
    borderRadius: sizeLevel.S56,
    backgroundColor: COLORS.sand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...SHADOW.field,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  // Figma uses Nimbus Sans here; the system sans is the closest bundled match.
  portraitLabel: {
    marginTop: 2,
    fontSize: sizeLevel.S9,
    letterSpacing: 0.45,
    color: COLORS.stone,
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: sizeLevel.S36,
    height: sizeLevel.S36,
    borderRadius: sizeLevel.S18,
    backgroundColor: COLORS.staticBlack,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  submit: {
    marginTop: sizeLevel.S32,
    paddingVertical: sizeLevel.S16,
  },
});

export default CreateProfileScreen;
