import {
  Grid, Group, SimpleGrid, Stack,
} from "@mantine/core";
import React, {useRef, useContext} from "react";
import Viz from "../Viz/Viz";
import ProfileContext from "../ProfileContext";

const VizMemo = React.memo(Viz);

/**
 *
 */
export default function Default({
  slug,
  heading,
  hideOptions,
  title,
  paragraphs,
  configOverride,
  loading,
  filters,
  resetButton,
  stats,
  sources,
  visualizations,
  vizHeadingLevel,
  updateSource,
  onSetVariables,
}) {
  const section = useRef(null);
  const {comparison, profileId} = useContext(ProfileContext);
  return (
    <Grid
      className={`cp-section-inner cp-default-section-inner cp-${slug}-section-inner ${loading ? "is-loading" : ""}`}
      ref={section}
      my="md"
    >
      {/* sidebar */}
      <Grid.Col
        md={comparison ? 12 : 4}
        sm={12}
        span={12}
        className="cp-section-content cp-default-section-caption"
      >
        <Stack spacing="xs">
          {heading}
          {filters}
          {stats}
          {paragraphs}
          {sources}

        </Stack>
      </Grid.Col>

      {/* caption */}
      {visualizations.length
        ? (
          <Grid.Col
            md={comparison ? 12 : 8}
            sm={12}
            span={12}
            className={`cp-default-section-figure${
              visualizations.length > 1 ? " cp-multicolumn-default-section-figure" : ""
            }${
              visualizations.filter(
                (viz) => viz.logic_simple && viz.logic_simple.type === "Graphic",
              ).length ? " cp-graphic-viz-grid" : ""
            }`}
          >
            <SimpleGrid
              breakpoints={[
                {minWidth: "sm", cols: 1},
                {minWidth: "md", cols: visualizations.length >= 2 ? 2 : 1},
              ]}
            >
              {visualizations.map((visualization) => (
                <VizMemo
                  section={section}
                  config={visualization}
                  headingLevel={vizHeadingLevel}
                  sectionTitle={title}
                  slug={slug}
                  hideOptions={hideOptions}
                  configOverride={configOverride}
                  updateSource={updateSource}
                  onSetVariables={onSetVariables}
                  key={`${profileId}-${visualization.id}`}
                />
              ))}
            </SimpleGrid>
            <Group align="flex-end">{resetButton}</Group>
          </Grid.Col>
        )
        : ""}
    </Grid>
  );
}
