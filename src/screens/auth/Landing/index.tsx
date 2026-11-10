import React, { useRef, useState } from "react";
import {
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import CustomImage from "../../../components/CustomImage";
import CustomSvg from "../../../components/CustomSvg";
import { CustomText } from "../../../components/CustomText";
import type { AuthStackScreenProps } from "../../../navigation/types";
import { APP_NAME, IMAGES, sizeLevel } from "../../../utils/constants";
import { COLORS } from "../../../utils/theme";

const LOOKS = [
  { id: "01", title: "Tonal ease", image: IMAGES.LOOK_1 },
  { id: "02", title: "Soft layers", image: IMAGES.LOOK_2 },
  { id: "03", title: "Oat milk, no rush", image: IMAGES.LOOK_3 },
];

const SCREEN_PADDING = sizeLevel.S16;
const CARD_GAP = sizeLevel.S12;

type Props = AuthStackScreenProps<"Landing">;

const LandingScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [statementY, setStatementY] = useState(0);
  const [activeLook, setActiveLook] = useState(0);

  // Figma: card 01 spans ~73% of the content width so the next card peeks in.
  const cardWidth = (width - SCREEN_PADDING * 2) * 0.733;

  const handleLooksScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(
      e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP),
    );
    setActiveLook(Math.max(0, Math.min(index, LOOKS.length - 1)));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <CustomText
          fontSize="S18"
          fontFamily="black"
          color={COLORS.inkSoft}
          tracking={3.6}
          uppercase
        >
          {APP_NAME}
        </CustomText>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero */}
        <ImageBackground
          source={IMAGES.HERO}
          style={styles.hero}
          resizeMode="cover"
        >
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.4327" stopColor="#000" stopOpacity={0} />
                <Stop offset="0.7404" stopColor="#000" stopOpacity={0.6} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.6} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#vignette)" />
          </Svg>
          <View style={styles.heroHeadline}>
            <CustomText
              fontSize="S36"
              fontFamily="black"
              color={COLORS.staticWhite}
              tracking={5}
              lineHeight={38.88}
              uppercase
              center
              textStyle={styles.heroText}
            >
              {"What are\nyou\nwearing\ntoday?"}
            </CustomText>
          </View>
        </ImageBackground>

        {/* Call to action */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Signup")}
            accessibilityRole="button"
          >
            <CustomText
              fontSize="S15"
              fontFamily="bold"
              color={COLORS.cream}
              tracking={0.75}
            >
              Join {APP_NAME}
            </CustomText>
            <CustomSvg name="arrowLong" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.learnMore}
            onPress={() =>
              scrollRef.current?.scrollTo({ y: statementY, animated: true })
            }
            accessibilityRole="button"
          >
            <CustomText
              fontSize="S11"
              color={COLORS.stoneLight}
              tracking={2.64}
              uppercase
            >
              Learn more
            </CustomText>
          </TouchableOpacity>
        </View>

        <View style={styles.fineDivider} />

        {/* Editorial statement */}
        <View
          style={styles.statement}
          onLayout={(e) => setStatementY(e.nativeEvent.layout.y)}
        >
          <CustomText
            fontSize="S32"
            fontFamily="extraBold"
            color={COLORS.inkSoft}
            tracking={-0.8}
            lineHeight={35.84}
            uppercase
            center
          >
            {"You don't\nhave to\ntell\nFrankie."}
          </CustomText>
          <View style={styles.knowsRow}>
            <CustomText
              fontSize="S20"
              fontFamily="medium"
              italic
              color="rgba(26, 25, 23, 0.9)"
              lineHeight={30}
            >
              Frankie already knows.
            </CustomText>
            <CustomText
              fontSize="S14"
              color={COLORS.inkSoft}
              textStyle={styles.sparkle}
            >
              ✦
            </CustomText>
          </View>
          <CustomText
            fontSize="S13"
            italic
            color={COLORS.stoneLight}
            tracking={0.325}
            lineHeight={19.5}
            center
            textStyle={styles.poetic}
          >
            Your wardrobe. Your style. Your day. The weather.
          </CustomText>
          <CustomText
            fontSize="S11"
            fontFamily="bold"
            color={COLORS.stoneLight}
            tracking={2.42}
            uppercase
            center
            textStyle={styles.eyebrow}
          >
            Three looks. Zero overthinking.
          </CustomText>
        </View>

        {/* Three looks carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + CARD_GAP}
          decelerationRate="fast"
          onMomentumScrollEnd={handleLooksScroll}
          contentContainerStyle={styles.looksContent}
        >
          {LOOKS.map((look) => (
            <View key={look.id} style={[styles.lookCard, { width: cardWidth }]}>
              <CustomText
                fontSize="S11"
                color={COLORS.stoneLight}
                lineHeight={16.5}
              >
                {look.id}
              </CustomText>
              <View style={styles.photoContainer}>
                <CustomImage
                  source={look.image}
                  style={styles.lookPhoto}
                  resizeMode="cover"
                />
              </View>
              <CustomText
                fontSize="S12"
                italic
                color="rgba(26, 25, 23, 0.9)"
                tracking={0.3}
                center
                textStyle={styles.lookCaption}
              >
                {look.title}
              </CustomText>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {LOOKS.map((look, index) => (
            <View
              key={look.id}
              style={[styles.dot, index === activeLook && styles.dotActive]}
            />
          ))}
        </View>

        {/* Editorial footer */}
        <View style={[styles.footer, { marginBottom: insets.bottom }]}>
          <CustomText
            fontSize="S14"
            fontFamily="black"
            color={COLORS.inkSoft}
            tracking={2.52}
            uppercase
          >
            {APP_NAME}
          </CustomText>
          <CustomText
            fontSize="S10"
            color={COLORS.stoneLight}
            tracking={2.4}
            uppercase
          >
            Made with love
          </CustomText>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  navHeader: {
    paddingHorizontal: sizeLevel.S20,
    paddingTop: sizeLevel.S14,
    paddingBottom: sizeLevel.S15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
    backgroundColor: COLORS.cream,
  },
  hero: {
    height: sizeLevel.S398,
    backgroundColor: "#D6D3D1",
    justifyContent: "flex-end",
  },
  heroHeadline: {
    alignItems: "center",
    paddingHorizontal: sizeLevel.S16,
    paddingBottom: sizeLevel.S13,
  },
  heroText: {
    textShadowColor: "rgba(0, 0, 0, 0.07)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 1.5,
  },
  ctaSection: {
    alignItems: "center",
    paddingTop: sizeLevel.S28,
    paddingBottom: sizeLevel.S40,
    paddingHorizontal: sizeLevel.S24,
  },
  ctaButton: {
    width: sizeLevel.S280,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sizeLevel.S10,
    paddingVertical: sizeLevel.S16,
    paddingHorizontal: sizeLevel.S24,
    backgroundColor: COLORS.inkSoft,
  },
  learnMore: {
    marginTop: sizeLevel.S16,
    paddingVertical: sizeLevel.S4,
  },
  fineDivider: {
    height: 1,
    backgroundColor: "rgba(26, 25, 23, 0.15)",
  },
  statement: {
    alignItems: "center",
    paddingTop: sizeLevel.S32,
    paddingBottom: sizeLevel.S32,
    paddingHorizontal: sizeLevel.S24,
  },
  knowsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sizeLevel.S6,
    marginTop: sizeLevel.S24,
  },
  sparkle: {
    fontFamily: undefined,
  },
  poetic: {
    marginTop: sizeLevel.S12,
  },
  eyebrow: {
    marginTop: sizeLevel.S19,
  },
  looksContent: {
    paddingHorizontal: SCREEN_PADDING,
    gap: CARD_GAP,
    paddingTop: sizeLevel.S4,
  },
  lookCard: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: sizeLevel.S15,
    paddingTop: sizeLevel.S14,
    paddingBottom: sizeLevel.S15,
    gap: sizeLevel.S12,
  },
  photoContainer: {
    backgroundColor: COLORS.photoPlaceholder,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: 1,
  },
  lookPhoto: {
    width: "100%",
    height: sizeLevel.S324,
  },
  lookCaption: {
    marginTop: sizeLevel.S14,
    paddingBottom: sizeLevel.S4,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: sizeLevel.S6,
    paddingTop: sizeLevel.S20,
    paddingBottom: sizeLevel.S27,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(26, 25, 23, 0.25)",
  },
  dotActive: {
    backgroundColor: COLORS.inkSoft,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sizeLevel.S24,
    paddingTop: sizeLevel.S21,
    paddingBottom: sizeLevel.S20,
    borderTopWidth: 1,
    borderTopColor: COLORS.inkSoft,
  },
});

export default LandingScreen;
