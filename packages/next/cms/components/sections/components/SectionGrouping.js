import {SimpleGrid} from "@mantine/core";
import toKebabCase from "../../../utils/formatters/toKebabCase";

export default function SectionGrouping({children, layout}) {
  const layoutClass = `cp-${toKebabCase(layout)}-section-grouping`;

  return (
    <div className={`cp-section-grouping ${layoutClass}`}>
      <SimpleGrid
        breakpoints={[
          {minWidth: "xs", cols: 1},
          {minWidth: "md", cols: 3},
        ]}
        className={`cp-section-grouping-inner ${layoutClass}-inner`}
      >
        {children}
      </SimpleGrid>
    </div>
  );
}