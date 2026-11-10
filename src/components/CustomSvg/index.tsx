import React from 'react';
import {SvgXml} from 'react-native-svg';
import {SVGS, SvgName} from '../../assets/svgs';

interface CustomSvgProps {
  name: SvgName;
  /** Only pass to deliberately resize; by default the Figma export's own size is used. */
  scale?: number;
}

const ROOT_SIZE = /<svg[^>]*?\swidth="([\d.]+)"[^>]*?\sheight="([\d.]+)"/;

/** Renders an icon exported from Figma (see src/assets/svgs) at its native size. */
const CustomSvg: React.FC<CustomSvgProps> = ({name, scale = 1}) => {
  const xml = SVGS[name];
  const match = xml.match(ROOT_SIZE);
  const width = match ? Number(match[1]) * scale : undefined;
  const height = match ? Number(match[2]) * scale : undefined;

  return <SvgXml xml={xml} width={width} height={height} />;
};

export default CustomSvg;
