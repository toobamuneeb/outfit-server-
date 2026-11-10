import React from 'react';
import {StyleSheet, View} from 'react-native';
import {CustomText} from '../CustomText';
import {COLORS} from '../../utils/theme';
import {sizeLevel} from '../../utils/constants';

interface OrDividerProps {
  /** Background of the "OR" chip; pass null for a plain gap (Create new password). */
  chipColor?: string | null;
}

/** Hairline divider with a centred "OR" label. */
const OrDivider: React.FC<OrDividerProps> = ({chipColor = COLORS.cream}) => {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={[styles.chip, chipColor ? {backgroundColor: chipColor} : null]}>
        <CustomText fontSize="S11" fontFamily="bold" color={COLORS.divider} tracking={1.1} uppercase>
          OR
        </CustomText>
      </View>
      <View style={styles.line} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  chip: {
    paddingHorizontal: sizeLevel.S12,
  },
});

export default OrDivider;
